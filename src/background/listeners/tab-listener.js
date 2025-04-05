// src/background/listeners/tab-listener.js - Tab update monitoring

import { isPlatformTab, getPlatformContentScript } from '../services/platform-integration.js';
import { injectContentScript } from '../services/content-extraction.js';
import { getPlatformTabInfo, updateScriptInjectionStatus } from '../core/state-manager.js';
import SidebarStateManager from '../../services/SidebarStateManager.js'; // Import the state manager
import logger from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

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
  // This part handles injecting the content script into the specific AI platform tab when it loads.
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

  // Removed the old sidebar handling logic that checked SidebarStateManager,
  // called ensureSidebarScriptInjected, and sent 'pageNavigated' messages.
  // The native Side Panel API handles its own lifecycle and doesn't require this specific logic on tab updates.
  // Platform tab injection logic above remains unchanged.
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
