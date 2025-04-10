// src/background/listeners/tab-listener.js - Tab update monitoring

import { isPlatformTab, getPlatformContentScript } from '../services/platform-integration.js';
import { injectContentScript } from '../services/content-extraction.js';
import { getPlatformTabInfo, updateScriptInjectionStatus } from '../core/state-manager.js';
import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import { determineContentType } from '../../shared/utils/content-utils.js';

/**
 * Set up tab update and activation listeners
 */
export function setupTabListener() {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onActivated.addListener(handleTabActivation); // Add activation listener
  chrome.tabs.onCreated.addListener(handleTabCreation); // Add creation listener
  logger.background.info('Tab update, activation, and creation listeners initialized'); // Update log message
}

/**
 * Handle tab update events
 * @param {number} tabId - Tab ID that was updated
 * @param {Object} changeInfo - Information about the change
 * @param {Object} tab - Tab information
 */
async function handleTabUpdate(tabId, changeInfo, tab) {
  // --- Platform Tab Injection Logic ---
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Get the current AI platform tab information
    const { tabId: aiPlatformTabId, platformId, scriptInjected } = await getPlatformTabInfo();

    // Check if this is our AI platform tab
    if (tabId !== aiPlatformTabId || scriptInjected) {
      return;
    }

    // Check if this is a platform tab based on URL
    const isPlatform = isPlatformTab(tabId, tab.url, platformId);
    if (!isPlatform) {
      return;
    }

    logger.background.info(`${platformId} tab detected and loaded: ${tabId}`, { url: tab.url });

    // Get the appropriate content script
    const contentScript = getPlatformContentScript(platformId);

    // Inject content script
    logger.background.info(`Injecting ${platformId} content script into tab: ${tabId}`);
    const injectionSuccess = await injectContentScript(tabId, contentScript);

    if (!injectionSuccess) {
      logger.background.error(`Failed to inject platform content script for ${platformId}`);
      return;
    }

    logger.background.info(`Setting scriptInjected flag to true for tab: ${tabId}`);
    await updateScriptInjectionStatus(true);

    // Verify extracted content is available
    const { extractedContent } = await chrome.storage.local.get(STORAGE_KEYS.EXTRACTED_CONTENT);
    logger.background.info('Content available for AI platform:', {
      hasContent: !!extractedContent,
      contentType: extractedContent?.contentType
    });
  } catch (error) {
      logger.background.error(`Error handling platform tab injection for tab ${tabId}:`, error);
    }
  }

  // --- Side Panel Navigation Detection Logic ---
  // Check if the URL changed or the tab finished loading (status === 'complete')
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    try {
      // Check if the side panel is *intended* to be visible for this tab
      const isVisible = await SidebarStateManager.getSidebarVisibilityForTab(tabId);

      if (isVisible) {
        logger.background.info(`Tab ${tabId} navigated to ${tab.url}. Side panel is relevant. Checking content type.`);
        const newContentType = determineContentType(tab.url);

        // Send message to the runtime (listened to by SidebarApp)
        chrome.runtime.sendMessage({
          action: 'pageNavigated',
          tabId: tabId,
          newUrl: tab.url,
          newContentType: newContentType
        });
        logger.background.info(`Sent 'pageNavigated' message for tab ${tabId} with new URL and type: ${newContentType}`);
      }

      // --- Add FAB State Check on Tab Update ---
      try {
        const hasBeenOpenedOnce = await SidebarStateManager.getSidebarOpenedOnceState(tabId);

        if (hasBeenOpenedOnce && isVisible) {
          logger.background.info(`Tab ${tabId} updated and FAB should be visible. Sending showFab.`);
          try {
            await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['dist/content-script.bundle.js'] });
            chrome.tabs.sendMessage(tabId, { action: 'showFab', isVisible: true });
          } catch (scriptError) {
            if (scriptError.message.includes('Cannot access') || scriptError.message.includes('No tab with id')) {
              logger.background.warn(`Cannot inject/send showFab to tab ${tabId} on update (restricted page or closed tab): ${scriptError.message}`);
            } else {
              logger.background.error(`Error sending showFab on update to tab ${tabId}:`, scriptError);
            }
          }
        } else if (hasBeenOpenedOnce && !isVisible) {
          logger.background.info(`Tab ${tabId} updated and FAB should be hidden. Sending hideFab.`);
          try { 
            chrome.tabs.sendMessage(tabId, { action: 'hideFab', isVisible: false }); 
          } catch (msgError) {
            logger.background.warn(`Failed to send hideFab on update to tab ${tabId} (may be closed or restricted):`, msgError.message);
          }
        }
      } catch (error) { 
        logger.background.error(`Error checking FAB state on tab update for ${tabId}:`, error); 
      }
      // --- End FAB State Check ---
      // No need for an else block, if not visible, we do nothing.
    } catch (error) {
      logger.background.error(`Error handling side panel navigation detection for tab ${tabId}:`, error);
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
    // Retrieve the intended visibility state for the activated tab
    const isVisible = await SidebarStateManager.getSidebarVisibilityForTab(tabId);
    // Removed log printing retrieved visibility state

    // Conditionally set side panel options based on stored visibility
    if (isVisible) {
      // Enable and set the path ONLY if it should be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: `sidepanel.html?tabId=${tabId}`,
        enabled: true
      });
      logger.background.info(`Side panel enabled for activated tab ${tabId}`); // Simplified log
    } else {
      // Disable the panel if it shouldn't be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
      logger.background.info(`Side panel disabled for activated tab ${tabId}`);
    }

    // --- Add FAB State Check on Tab Activation ---
    const hasBeenOpenedOnce = await SidebarStateManager.getSidebarOpenedOnceState(tabId);

    if (hasBeenOpenedOnce && isVisible) {
      logger.background.info(`Tab ${tabId} activated and FAB should be visible. Sending showFab.`);
      try {
        await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['dist/content-script.bundle.js'] });
        chrome.tabs.sendMessage(tabId, { action: 'showFab', isVisible: true });
      } catch (scriptError) {
        if (scriptError.message.includes('Cannot access')) {
          logger.background.warn(`Cannot inject/send showFab to tab ${tabId} on activation (restricted page).`);
        } else {
          logger.background.error(`Error sending showFab on activation to tab ${tabId}:`, scriptError);
        }
      }
    } else if (hasBeenOpenedOnce && !isVisible) {
      logger.background.info(`Tab ${tabId} activated and FAB should be hidden. Sending hideFab.`);
      try { 
        chrome.tabs.sendMessage(tabId, { action: 'hideFab', isVisible: false }); 
      } catch (msgError) {
        logger.background.warn(`Failed to send hideFab on activation to tab ${tabId} (may be closed or restricted):`, msgError.message);
      }
    }
    // --- End FAB State Check ---

  } catch (error) {
    logger.background.error(`Error setting side panel options for activated tab ${tabId}:`, error);
  }
}

/**
 * Handle tab creation events to initialize side panel state
 * @param {Object} newTab - Information about the newly created tab
 */
async function handleTabCreation(newTab) {
  logger.background.info(`Tab creation handler running for new tabId: ${newTab.id}`);
  try {
    // Store the initial visibility state (false) without enabling/disabling the panel itself
    await SidebarStateManager.setSidebarVisibilityForTab(newTab.id, false);
    logger.background.info(`Initial sidebar state (visible: false) stored for new tab ${newTab.id}`);
  } catch (error) {
    logger.background.error(`Error storing initial side panel state for new tab ${newTab.id}:`, error);
  }
}
