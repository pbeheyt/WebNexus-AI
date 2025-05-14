// src/background/listeners/tab-listener.js - Tab update monitoring

// In-memory sets to track processing state for tabs during a load sequence
const platformScriptInjectedTabs = new Set();
const sidePanelOptionsSetForLoad = new Set(); // Renamed for clarity

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
 * Handle tab removal events to clean up in-memory sets
 * @param {number} tabId - The ID of the tab that was removed
 */
function handleTabRemoval(tabId) {
  if (platformScriptInjectedTabs.has(tabId)) {
    platformScriptInjectedTabs.delete(tabId);
    logger.background.info(`Removed tab ${tabId} from platformScriptInjectedTabs.`);
  }
  if (sidePanelOptionsSetForLoad.has(tabId)) {
    sidePanelOptionsSetForLoad.delete(tabId);
    logger.background.info(`Removed tab ${tabId} from sidePanelOptionsSetForLoad.`);
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
      logger.background.warn(`URL parsing failed during navigation check for tab ${tabId}: ${e.message}. Assuming significant change.`);
      isNewPageLoadOrDomainChange = true;
    }
  }

  // Clear platformScriptInjectedTabs on any URL change or loading status (existing broader logic)
  if (changeInfo.status === 'loading' || (changeInfo.url && tab.url !== changeInfo.url)) {
    if (platformScriptInjectedTabs.has(tabId)) {
      platformScriptInjectedTabs.delete(tabId);
      logger.background.info(`Cleared platformScriptInjectedTabs flag for tab ${tabId} due to navigation/load.`);
    }
  }

  // Clear sidePanelOptionsSetForLoad only on new page load or domain change
  if (isNewPageLoadOrDomainChange) {
    if (sidePanelOptionsSetForLoad.has(tabId)) {
      sidePanelOptionsSetForLoad.delete(tabId);
      logger.background.info(`Cleared sidePanelOptionsSetForLoad flag for tab ${tabId} due to new page load or domain change.`);
    }
  }

  // --- Side Panel State Check on Completion ---
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Guard against setting side panel options multiple times for the same load
      if (sidePanelOptionsSetForLoad.has(tabId)) {
        logger.background.info(`Side panel options already set for tab ${tabId} during this load sequence. Skipping.`);
        // We still need to let the platform injection logic run below, so don't return entirely.
      } else {
        logger.background.info(`Tab ${tabId} finished loading (${tab.url}). Setting final side panel state.`);
        const isAllowed = isSidePanelAllowedPage(tab.url);
        const isVisible = await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);

        if (isAllowed) {
          await chrome.sidePanel.setOptions({
            tabId: tabId,
            path: `sidepanel.html?tabId=${tabId}`, // Always set path when allowed
            enabled: isVisible, // Enable based on stored visibility
          });
          logger.background.info(`Side Panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${isVisible}`);
        } else {
          await chrome.sidePanel.setOptions({
            tabId: tabId,
            enabled: false, // Force disable if not allowed
          });
          logger.background.info(`Side Panel explicitly disabled for completed tab ${tabId} (URL not allowed).`);
        }
        sidePanelOptionsSetForLoad.add(tabId);
        logger.background.info(`Marked sidePanelOptionsSetForLoad for tab ${tabId}.`);
      }
    } catch (error) {
      logger.background.error(`Error setting side panel options during onUpdated for tab ${tabId}:`, error);
    }
  }

  // --- Platform Tab Injection Logic ---
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      
      // Get the current AI platform tab information
      const {
        tabId: aiPlatformTabId,
        platformId,
        scriptInjected,
      } = await getPlatformTabInfo();

      // Check if this is our AI platform tab
      if (tabId !== aiPlatformTabId || scriptInjected) {
        return;
      }

      // Check if this is a platform tab based on URL
      const isPlatform = isPlatformTab(tabId, tab.url, platformId);
      if (!isPlatform) {
        return;
      }

      logger.background.info(
        `${platformId} tab detected and loaded: ${tabId}`,
        { url: tab.url }
      );

      // Get the appropriate content script
      const contentScript = getPlatformContentScript(platformId);

      // Final guard before actual injection
      if (platformScriptInjectedTabs.has(tabId)) {
        logger.background.info(`Platform script injection already attempted for tab ${tabId} in this load sequence. Skipping actual injection.`);
        return; // Exit this specific logic block if already attempted
      }
      platformScriptInjectedTabs.add(tabId);
      logger.background.info(`Marked platformScriptInjectedTabs for tab ${tabId} before injection attempt.`);

      // Inject content script
      logger.background.info(
        `Injecting ${platformId} content script into tab: ${tabId}`
      );
      const injectionSuccess = await injectContentScript(tabId, contentScript);

      if (!injectionSuccess) {
        logger.background.error(
          `Failed to inject platform content script for ${platformId}`
        );
        return;
      }

      logger.background.info(
        `Setting scriptInjected flag to true for tab: ${tabId}`
      );
      await updateScriptInjectionStatus(true);

      // Verify extracted content is available
      const { extractedContent } = await chrome.storage.local.get(
        STORAGE_KEYS.EXTRACTED_CONTENT
      );
      logger.background.info('Content available for AI platform:', {
        hasContent: !!extractedContent,
        contentType: extractedContent?.contentType,
      });
    } catch (error) {
      logger.background.error(
        `Error handling platform tab injection for tab ${tabId}:`,
        error
      );
    }
  }

  // --- Side Panel Navigation Detection Logic ---
  // Check if the URL changed or the tab finished loading (status === 'complete')
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    try {
      // Check if the side panel is *intended* to be visible for this tab
      const isVisible =
        await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);

      if (isVisible) {
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
      logger.background.info(`Tab ${tabId} activated but still loading. Deferring side panel check to onUpdated.`);
      return; // Exit early, onUpdated will handle it
    }
    if (!activatedTab || (!activatedTab.url && activatedTab.status !== 'loading')) {
      logger.background.warn(`Could not get URL for activated tab ${tabId}`);
      return;
    }

    // Check if side panel is allowed on this page
    const isAllowed = isSidePanelAllowedPage(activatedTab.url);
    if (!isAllowed) {
      logger.background.info(
        `Tab ${tabId} activated on restricted page (${activatedTab.url}). Forcing side panel disable.`
      );
      await chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
      return;
    }

    // Retrieve the intended visibility state for the activated tab
    const isVisible =
      await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);

    // Conditionally set side panel options based on stored visibility
    if (isVisible) {
      // Enable and set the path ONLY if it should be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: `sidepanel.html?tabId=${tabId}`,
        enabled: true,
      });
      logger.background.info(`Side Panel enabled for activated tab ${tabId}`);
    } else {
      // Disable the panel if it shouldn't be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false,
      });
      logger.background.info(`Side Panel disabled for activated tab ${tabId}`);
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
    await SidePanelStateManager.setSidePanelVisibilityForTab(newTab.id, false);
    logger.background.info(
      `Initial sidepanel state (visible: false) stored for new tab ${newTab.id}`
    );
  } catch (error) {
    logger.background.error(
      `Error storing initial sidepanel state for new tab ${newTab.id}:`,
      error
    );
  }
}
