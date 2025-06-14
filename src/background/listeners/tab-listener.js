// src/background/listeners/tab-listener.js - Tab update monitoring

// In-memory sets to track processing state for tabs during a load sequence
const platformScriptInjectedTabs = new Set();
const sidePanelOptionsSetForLoad = new Set();

// In-memory store for dynamically created context menu item IDs
let createdMenuIDs = [];

// Create a debounced version of the context menu update function to prevent race conditions
const debouncedUpdateContextMenuForTab = debounce(async (tab) => {
  // Use a try-catch block as this is an async operation that can fail
  try {
    await updateContextMenuForTab(tab);
  } catch (error) {
    logger.background.error('Error in debounced context menu update:', error);
  }
}, 150); // 150ms delay is a good balance

import {
  loadRelevantPrompts,
} from '../../shared/utils/prompt-utils.js';
import { debounce } from '../../shared/utils/debounce-utils.js';
import {
  isPlatformTab,
  getPlatformContentScript,
} from '../services/platform-integration.js';
import { injectContentScript } from '../services/content-extraction.js';
import {
  getPlatformTabInfo,
  updateScriptInjectionStatus,
} from '../core/state-manager.js';
import SidePanelStateManager from '../../services/SidePanelStateManager.js';
import { logger } from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import {
  determineContentType,
  isSidePanelAllowedPage,
  isInjectablePage,
} from '../../shared/utils/content-utils.js';

/**
 * Set up tab update and activation listeners
 */
export function setupTabListener() {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onActivated.addListener(handleTabActivation); // Add activation listener
  chrome.tabs.onCreated.addListener(handleTabCreation); // Add creation listener
  chrome.tabs.onRemoved.addListener(handleTabRemoval); // Add removal listener
  logger.background.info(
    'Tab update, activation, creation, and removal listeners initialized'
  ); // Update log message
}

/**
 * Updates the context menu with relevant prompts for the given tab.
 * @param {chrome.tabs.Tab} tab - The tab object to create the context menu for.
 */
async function updateContextMenuForTab(tab) {
  // Clear previous dynamic items to prevent duplicates
  for (const id of createdMenuIDs) {
    try {
      // Use a simple try-catch as remove can fail if the item was already removed
      await chrome.contextMenus.remove(id);
    } catch (e) {
      // It's safe to ignore "No such context menu item" errors here.
    }
  }
  createdMenuIDs = []; // Reset the list of created IDs

  // Do not show the menu on pages where the side panel is not allowed (e.g., chrome://)
  if (!tab || !tab.id || !isSidePanelAllowedPage(tab.url)) {
    await chrome.contextMenus.update('parent-menu', { visible: false });
    return;
  }
  // Ensure the parent menu is visible for allowed pages
  await chrome.contextMenus.update('parent-menu', { visible: true });

  const selectionResult = await chrome.storage.local.get(
    STORAGE_KEYS.TAB_SELECTION_STATES
  );
  const hasSelection = !!(
    selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES] || {}
  )[tab.id];
  const contentType = determineContentType(tab.url, hasSelection);
  const prompts = await loadRelevantPrompts(contentType);

  if (prompts.length > 0) {
    for (const prompt of prompts) {
      const menuId = `prompt-item-${prompt.id}`;
      createdMenuIDs.push(menuId);
      await chrome.contextMenus.create({
        id: menuId,
        title: prompt.name,
        parentId: 'parent-menu',
        contexts: ['page', 'selection'],
      });
    }
  } else {
    // Add a disabled item to inform the user if no prompts are available
    const menuId = 'no-prompts-item';
    createdMenuIDs.push(menuId);
    await chrome.contextMenus.create({
      id: menuId,
      title: 'No prompts for this content type',
      enabled: false,
      parentId: 'parent-menu',
      contexts: ['page', 'selection'],
    });
  }
}

/**
 * Handle tab removal events to clean up in-memory sets
 * @param {number} tabId - The ID of the tab that was removed
 */
function handleTabRemoval(tabId) {
  if (platformScriptInjectedTabs.has(tabId)) {
    platformScriptInjectedTabs.delete(tabId);
    logger.background.info(
      `Removed tab ${tabId} from platformScriptInjectedTabs.`
    );
  }
  if (sidePanelOptionsSetForLoad.has(tabId)) {
    sidePanelOptionsSetForLoad.delete(tabId);
    logger.background.info(
      `Removed tab ${tabId} from sidePanelOptionsSetForLoad.`
    );
  }
  // Note: Persistent storage cleanup for tab removal is handled in tab-state-listener.js
}

/**
 * Handle tab update events
 * @param {number} tabId - Tab ID that was updated
 * @param {Object} changeInfo - Information about the change
 * @param {Object} tab - Tab information
 */
async function handleTabUpdate(tabId, changeInfo, tab) {
  // Determine if a significant navigation event has occurred
  let isNewPageLoadOrDomainChange = false;
  if (changeInfo.status === 'loading') {
    isNewPageLoadOrDomainChange = true;
  } else if (changeInfo.url && tab.url) {
    try {
      const oldUrl = new URL(tab.url);
      const newUrl = new URL(changeInfo.url);
      if (oldUrl.hostname !== newUrl.hostname) {
        isNewPageLoadOrDomainChange = true;
      }
    } catch (e) {
      // If URL parsing fails, assume it's a significant change to be safe
      logger.background.warn(
        `URL parsing failed during navigation check for tab ${tabId}: ${e.message}. Assuming significant change.`
      );
      isNewPageLoadOrDomainChange = true;
    }
  }

  // Clear platformScriptInjectedTabs on any URL change or loading status (existing broader logic)
  if (
    changeInfo.status === 'loading' ||
    (changeInfo.url && tab.url !== changeInfo.url)
  ) {
    if (platformScriptInjectedTabs.has(tabId)) {
      platformScriptInjectedTabs.delete(tabId);
      logger.background.info(
        `Cleared platformScriptInjectedTabs flag for tab ${tabId} due to navigation/load.`
      );
    }
  }

  // Clear sidePanelOptionsSetForLoad only on new page load or domain change
  if (isNewPageLoadOrDomainChange) {
    if (sidePanelOptionsSetForLoad.has(tabId)) {
      sidePanelOptionsSetForLoad.delete(tabId);
      logger.background.info(
        `Cleared sidePanelOptionsSetForLoad flag for tab ${tabId} due to new page load or domain change.`
      );
    }
  }

  // --- Side Panel State Check on Completion ---
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Guard against setting side panel options multiple times for the same load
      if (sidePanelOptionsSetForLoad.has(tabId)) {
        logger.background.info(
          `Side panel options already set for tab ${tabId} during this load sequence. Skipping.`
        );
        // We still need to let the platform injection logic run below, so don't return entirely.
      } else {
        logger.background.info(
          `Tab ${tabId} finished loading (${tab.url}). Setting final side panel state.`
        );
        const isAllowed = isSidePanelAllowedPage(tab.url);
        const tabUIState =
          await SidePanelStateManager.getTabUIState(tabId);

        if (
          chrome.sidePanel &&
          typeof chrome.sidePanel.setOptions === 'function'
        ) {
          if (isAllowed) {
            await chrome.sidePanel.setOptions({
              tabId: tabId,
              path: `sidepanel.html?tabId=${tabId}`, // Always set path when allowed
              enabled: tabUIState.isVisible, // Enable based on stored visibility
            });
            logger.background.info(
              `Side Panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${tabUIState.isVisible}`
            );
          } else {
            await chrome.sidePanel.setOptions({
              tabId: tabId,
              enabled: false, // Force disable if not allowed
            });
            logger.background.info(
              `Side Panel explicitly disabled for completed tab ${tabId} (URL not allowed).`
            );
          }
        } else {
          logger.background.warn(
            `Side Panel API not available. Skipping setOptions for tab ${tabId} in handleTabUpdate.`
          );
        }
        sidePanelOptionsSetForLoad.add(tabId);
        logger.background.info(
          `Marked sidePanelOptionsSetForLoad for tab ${tabId}.`
        );
      }
    } catch (error) {
      logger.background.error(
        `Error setting side panel options during onUpdated for tab ${tabId}:`,
        error
      );
    }

    // Update context menu with relevant prompts using the debounced function
    debouncedUpdateContextMenuForTab(tab);
  }

  // --- Platform Tab Injection Logic ---
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we've already initiated platform script injection for this tab in this load sequence.
    if (platformScriptInjectedTabs.has(tabId)) {
      logger.background.info(
        `Platform script injection sequence already processed for tab ${tabId} during this load. Skipping platform injection block.`
      );
    } else {
      // Only proceed if we haven't started injection for this tab in this sequence.
      try {
        const {
          tabId: aiPlatformTabIdFromStorage,
          platformId,
          scriptInjected, // Persistent flag from storage
        } = await getPlatformTabInfo();

        // Ensure this is the specific tab we are targeting for AI platform interaction
        // and that the persistent scriptInjected flag indicates it's not yet done.
        if (tabId === aiPlatformTabIdFromStorage && !scriptInjected) {
          const isPlatform = isPlatformTab(tabId, tab.url, platformId);

          if (isPlatform) {
            // If all conditions match (correct tab, not yet injected persistently, is a platform URL),
            // then mark this tab in our in-memory set to prevent re-entry from rapid 'complete' events
            // for THIS specific load sequence.
            platformScriptInjectedTabs.add(tabId);
            logger.background.info(
              `Marked platformScriptInjectedTabs for tab ${tabId} as injection sequence is now starting.`
            );

            logger.background.info(
              `${platformId} tab detected and loaded: ${tabId}`,
              { url: tab.url }
            );

            const contentScript = getPlatformContentScript(platformId);

            logger.background.info(
              `Injecting ${platformId} content script into tab: ${tabId}`
            );
            const injectionSuccess = await injectContentScript(
              tabId,
              contentScript
            );

            if (!injectionSuccess) {
              logger.background.error(
                `Failed to inject platform content script for ${platformId}`
              );
              // If injection fails, remove from the in-memory set so it can be retried on a *genuinely new* load.
              // The persistent 'scriptInjected' flag remains false.
              platformScriptInjectedTabs.delete(tabId);
              logger.background.info(
                `Cleared platformScriptInjectedTabs for tab ${tabId} due to injection failure.`
              );
            } else {
              logger.background.info(
                `Setting scriptInjected (persistent) flag to true for tab: ${tabId}`
              );
              await updateScriptInjectionStatus(true); // Update persistent storage

              // Verify extracted content is available (or any other post-injection logic)
              const {
                [STORAGE_KEYS.EXTRACTED_CONTENT]:
                  extractedContentAfterInjection,
              } = await chrome.storage.local.get(
                STORAGE_KEYS.EXTRACTED_CONTENT
              );
              logger.background.info(
                'Content available for AI platform after injection:',
                {
                  hasContent: !!extractedContentAfterInjection,
                  contentType: extractedContentAfterInjection?.contentType,
                }
              );
            }
          }
        } else if (tabId === aiPlatformTabIdFromStorage && scriptInjected) {
          logger.background.info(
            `Platform script already persistently injected in tab ${tabId} (${platformId || 'unknown platform'}). Skipping platform injection block.`
          );
          // Ensure it's marked in the in-memory set as well if it wasn't already,
          // to prevent re-entry even if the onUpdated fires again for this load.
          if (!platformScriptInjectedTabs.has(tabId)) {
            platformScriptInjectedTabs.add(tabId);
            logger.background.info(
              `Ensured platformScriptInjectedTabs is set for tab ${tabId} as script was already persistently injected.`
            );
          }
        }
      } catch (error) {
        logger.background.error(
          `Error during platform tab injection logic for tab ${tabId}:`,
          error
        );
      }
    }
  }

  // --- Side Panel Navigation Detection Logic ---
  // Check if the URL changed or the tab finished loading (status === 'complete')
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    try {
      // Check if the side panel is *intended* to be visible for this tab
      const tabUIState =
        await SidePanelStateManager.getTabUIState(tabId);

      if (tabUIState.isVisible) {
        logger.background.info(
          `Tab ${tabId} navigated to ${tab.url}. Side panel is relevant. Checking content type.`
        );
        const newContentType = determineContentType(tab.url);

        // Send message to the runtime (listened to by SidePanelApp)
        chrome.runtime.sendMessage({
          action: 'pageNavigated',
          tabId: tabId,
          newUrl: tab.url,
          newContentType: newContentType,
        });
        logger.background.info(
          `Sent 'pageNavigated' message for tab ${tabId} with new URL and type: ${newContentType}`
        );
      }
      // No need for an else block, if not visible, we do nothing.
    } catch (error) {
      logger.background.error(
        `Error handling side panel navigation detection for tab ${tabId}:`,
        error
      );
    }
  }

  // --- Inject Selection Listener on Navigation ---
  // This ensures that new tabs or tabs navigating to a new page get the listener.
  // The content script itself has a guard to prevent it from running more than once.
  if (changeInfo.status === 'complete' && tab.url) {
    if (isInjectablePage(tab.url)) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['dist/selection-listener.bundle.js'],
        });
      } catch (err) {
        // This error is expected on certain pages (e.g., chrome web store)
        // where content script injection is forbidden. We can safely ignore it.
        if (
          err.message &&
          !err.message.includes('Cannot access a chrome:// URL') &&
          !err.message.includes('The extensions gallery cannot be scripted') &&
          !err.message.includes('No tab with id')
        ) {
          logger.background.warn(
            `Could not inject selection listener into tab ${tabId} during navigation: ${err.message}`
          );
        }
      }
    }
  }
}

/**
 * Handle tab activation events to set the side panel state
 * @param {Object} activeInfo - Information about the activated tab
 * @param {number} activeInfo.tabId - The ID of the activated tab
 */
async function handleTabActivation(activeInfo) {
  const { tabId } = activeInfo;
  logger.background.info(`Tab activation handler running for tabId: ${tabId}`);

  try {
    // Get the full tab object to check URL
    const activatedTab = await chrome.tabs.get(tabId);
    if (!activatedTab.url && activatedTab.status === 'loading') {
      logger.background.info(
        `Tab ${tabId} activated but still loading. Deferring side panel check to onUpdated.`
      );
      return; // Exit early, onUpdated will handle it
    }
    // Update context menu for the newly activated tab using the debounced function
    debouncedUpdateContextMenuForTab(activatedTab);

    if (
      !activatedTab ||
      (!activatedTab.url && activatedTab.status !== 'loading')
    ) {
      logger.background.warn(`Could not get URL for activated tab ${tabId}`);
      return;
    }

    // Check if side panel is allowed on this page
    const isAllowed = isSidePanelAllowedPage(activatedTab.url);
    if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
      if (!isAllowed) {
        logger.background.info(
          `Tab ${tabId} activated on restricted page (${activatedTab.url}). Forcing side panel disable.`
        );
        await chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
        return;
      }

      // Retrieve the intended visibility state for the activated tab
      const tabUIState =
        await SidePanelStateManager.getTabUIState(tabId);

      // Conditionally set side panel options based on stored visibility
      if (tabUIState.isVisible) {
        // Enable and set the path ONLY if it should be visible
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          path: `sidepanel.html?tabId=${tabId}`,
          enabled: true, // Use tabUIState.isVisible
        });
        logger.background.info(`Side Panel enabled for activated tab ${tabId}`);
      } else {
        // Disable the panel if it shouldn't be visible
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          enabled: false, // Use tabUIState.isVisible
        });
        logger.background.info(
          `Side Panel disabled for activated tab ${tabId}`
        );
      }
    } else {
      logger.background.warn(
        `Side Panel API not available. Skipping setOptions for tab ${tabId} in handleTabActivation.`
      );
    }
  } catch (error) {
    logger.background.error(
      `Error setting side panel options for activated tab ${tabId}:`,
      error
    );
  }
}

/**
 * Handle tab creation events to initialize side panel state
 * @param {Object} newTab - Information about the newly created tab
 */
async function handleTabCreation(newTab) {
  logger.background.info(
    `Tab creation handler running for new tabId: ${newTab.id}`
  );
  try {
    // Store the initial visibility state (false) without enabling/disabling the panel itself
  } catch (error) {
    logger.background.error(
      `Error storing initial sidepanel state for new tab ${newTab.id}:`,
      error
    );
  }
}
