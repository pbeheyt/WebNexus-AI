// src/background/listeners/tab-listener.js - Tab update monitoring

import { isPlatformTab, getPlatformContentScript } from '../services/platform-integration.js';
import { injectContentScript } from '../services/content-extraction.js';
import { getPlatformTabInfo, updateScriptInjectionStatus, storeFormattedContentForTab } from '../core/state-manager.js';
import SidebarStateManager from '../../services/SidebarStateManager.js'; // Added
import { ensureSidebarScriptInjected } from '../services/sidebar-manager.js'; // Added for navigation handling
import { determineContentType } from '../../shared/utils/content-utils.js'; // Added
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

  // This part handles updating the sidebar context when navigation occurs in *any* tab where the sidebar is open.
  // Run if URL changes OR status is complete (and URL exists)
  if (tab.url && (changeInfo.url || changeInfo.status === 'complete')) {
    try {
      const isSidebarVisible = await SidebarStateManager.getSidebarVisibilityForTab(tabId);
      if (isSidebarVisible) {
        logger.background.info(`Sidebar visible for tab ${tabId}, handling navigation/load.`);

        // --- New logic for ensuring sidebar visibility after navigation ---
        logger.background.info(`Navigation/load in tab ${tabId} while sidebar state is true. Ensuring script and visibility.`);
        await ensureSidebarScriptInjected(tabId);

        // Attempt to explicitly show the sidebar after ensuring script injection
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'toggleSidebar',
            visible: true,
            tabId: tabId
          });
          logger.background.info(`Sent explicit 'toggleSidebar visible: true' message to tab ${tabId} after navigation.`);
        } catch (error) {
          // Log errors if the content script isn't ready, but don't stop execution.
          if (error.message?.includes('Receiving end does not exist') || error.message?.includes('Could not establish connection')) {
             logger.background.warn(`Could not send explicit 'toggleSidebar visible: true' message to tab ${tabId} (content script likely not ready): ${error.message}`);
          } else {
             logger.background.error(`Error sending explicit 'toggleSidebar visible: true' message to tab ${tabId}:`, error);
          }
        }
        // --- End of new logic ---

        const newContentType = determineContentType(tab.url);

        try {
          // Send message to the content script in the target tab to update its context
          await chrome.tabs.sendMessage(tabId, {
            action: 'pageNavigated',
            newUrl: tab.url,
            newContentType: newContentType
          });
          logger.background.info(`Sent 'pageNavigated' message to tab ${tabId}.`);
        } catch (error) {
          // It's common for sendMessage to fail if the content script isn't ready or injected yet,
          // especially on initial page loads before the sidebar injector runs or if the tab is discarded.
          if (error.message?.includes('Receiving end does not exist') || error.message?.includes('Could not establish connection')) {
            logger.background.info(`Could not send 'pageNavigated' message to tab ${tabId} (content script likely not ready/injected): ${error.message}`);
          } else {
            // Log other errors as warnings as they might indicate a different issue.
            logger.background.warn(`Error sending 'pageNavigated' message to tab ${tabId}:`, error);
          }
        }
      }
    } catch (error) {
      logger.background.error(`Error handling sidebar update logic for tab ${tabId}:`, error);
    }
  }
}
