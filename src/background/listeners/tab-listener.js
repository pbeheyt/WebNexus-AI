// src/background/listeners/tab-listener.js - Tab update monitoring

import { isPlatformTab, getPlatformContentScript } from '../services/platform-integration.js';
import { injectContentScript } from '../services/content-extraction.js';
import { getPlatformTabInfo, updateScriptInjectionStatus } from '../core/state-manager.js'; // Removed storeFormattedContentForTab import (if unused elsewhere)
// Removed SidebarStateManager, ensureSidebarScriptInjected, determineContentType imports as they are no longer needed here
import logger from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Set up tab update listener
 */
export function setupTabListener() {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  logger.background.info('Tab listener initialized');
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
