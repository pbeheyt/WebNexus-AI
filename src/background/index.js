// src/background/index.js - Entry point for background service worker

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
// Import the specific cleanup function and the listener setup
import { setupTabStateListener, performStaleTabCleanup } from './listeners/tab-state-listener.js';
import SidebarStateManager from '../services/SidebarStateManager.js';
import logger from '../shared/logger.js';
import { determineContentType } from '../shared/utils/content-utils.js';
import { processContent } from './services/content-processing.js'; // Adjust path if needed
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'nexusai-quick-process') {
    logger.background.info('Context menu clicked:', { menuItemId: info.menuItemId, tabId: tab?.id, url: tab?.url });
    if (!tab || !tab.id || !tab.url) {
      logger.background.error('Context menu click missing tab information.');
      return;
    }

    try {
      const contentType = determineContentType(tab.url);
      logger.background.info(`Determined content type: ${contentType} for URL: ${tab.url}`);

      // 1. Get the default prompt ID for this content type
      const defaultsResult = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
      const defaultPrompts = defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
      const defaultPromptId = defaultPrompts[contentType];

      if (!defaultPromptId) {
        logger.background.warn(`No default prompt set for content type: ${contentType}. Aborting quick process.`);
        // Optional: Notify user (consider if this is too noisy)
        // try {
        //   await chrome.notifications.create({
        //     type: 'basic',
        //     iconUrl: chrome.runtime.getURL('images/icon48.png'),
        //     title: 'Nexus AI',
        //     message: `No default prompt set for ${contentType} content. Configure one in Settings > Prompts.`
        //   });
        // } catch (notifError) {
        //   logger.background.error('Failed to show notification:', notifError);
        // }
        return;
      }
      logger.background.info(`Found default prompt ID: ${defaultPromptId}`);

      // 2. Get the actual prompt content
      const promptsResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const promptsByType = promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
      // Make sure to check the prompts object exists for the content type
      const promptObject = promptsByType[contentType]?.prompts?.[defaultPromptId];

      if (!promptObject || !promptObject.content) {
        logger.background.error(`Default prompt object or content not found for ID: ${defaultPromptId} under type ${contentType}`);
        return;
      }
      const promptContent = promptObject.content;
      logger.background.info(`Found default prompt content (length: ${promptContent.length}).`);

      // 3. Get the last used popup platform
      const platformResult = await chrome.storage.sync.get(STORAGE_KEYS.POPUP_PLATFORM);
      // Provide a fallback platform if none is stored (e.g., 'chatgpt')
      const platformId = platformResult[STORAGE_KEYS.POPUP_PLATFORM] || 'chatgpt'; // Ensure a default exists
      logger.background.info(`Using platform: ${platformId} for popup flow.`);

      // 4. Call processContent (ensure it's imported correctly)
      logger.background.info(`Calling processContent for tab ${tab.id} with default prompt.`);
      // Call the existing processContent function which handles the web UI flow
      await processContent({
        tabId: tab.id,
        url: tab.url,
        platformId: platformId,
        promptContent: promptContent,
        useApi: false // Explicitly use the Web UI interaction flow
      });
      logger.background.info(`processContent call initiated via context menu.`);

    } catch (error) {
      logger.background.error('Error handling context menu action:', error);
      // Optional: Notify user of failure
      // try {
      //   await chrome.notifications.create({ ... basic error notification ... });
      // } catch (notifError) { logger.background.error(...) }
    }
  }
}


/**
 * Main entry point for the background service worker
 */
async function startBackgroundService() {
  try {
    logger.background.info('Starting background service...');
    // 1. Initialize extension configuration and state
    await initializeExtension();

    // 2. Set up message router to handle communication
    setupMessageRouter();

    // 3. Set up event listeners
    setupTabListener();
    setupTabStateListener(); // Sets up onRemoved listener
    setupConnectionListener(); // Add connection listener setup

    // Add the context menu listener
    if (chrome.contextMenus && chrome.contextMenus.onClicked) {
       chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
       logger.background.info('Context menu click listener registered.');
    } else {
       logger.background.error('Context Menus API not available to register listener.');
    }

    // This runs every time the service worker starts (initial load, wake-up, after browser start)
    // It complements the onStartup listener.
    logger.background.info('Running stale tab cleanup on service worker start...');
    try {
      await performStaleTabCleanup(); // Call the cleanup function
      logger.background.info('Service worker start stale tab cleanup completed.');
    } catch (cleanupError) {
      logger.background.error('Error during service worker start stale tab cleanup:', cleanupError);
    }

    // 4. Add the onStartup listener for cleanup (Keep this!)
    // This listener persists across service worker restarts.
    chrome.runtime.onStartup.addListener(async () => {
      logger.background.info('Browser startup detected via onStartup listener. Running stale tab cleanup...');
      try {
        // Call the cleanup function directly
        await performStaleTabCleanup();
        logger.background.info('Startup stale tab cleanup completed.');
      } catch (cleanupError) {
        logger.background.error('Error during startup stale tab cleanup:', cleanupError);
      }
    });
    logger.background.info('onStartup listener registered for cleanup.');

    logger.background.info('Service worker started successfully and listeners are set up.');
  } catch (error) {
    logger.background.error('Error starting background service:', error);
  }
}

/**
 * Sets up the listener for runtime connections (e.g., from side panel).
 */
function setupConnectionListener() {
  // This listener also persists across service worker restarts.
  chrome.runtime.onConnect.addListener((port) => {
    logger.background.info(`Connection received: ${port.name}`);

    if (port.name.startsWith('sidepanel-connect-')) {
      const parts = port.name.split('-');
      const tabIdStr = parts[parts.length - 1];
      const tabId = parseInt(tabIdStr, 10);

      if (!isNaN(tabId)) {
        logger.background.info(`Side panel connected for tab ${tabId}`);

        // Mark sidebar as visible upon connection
        SidebarStateManager.setSidebarVisibilityForTab(tabId, true)
          .then(() => {
            logger.background.info(`Set sidebar visibility to true for tab ${tabId}`);
          })
          .catch(error => {
            logger.background.error(`Error setting sidebar visibility to true for tab ${tabId}:`, error);
          });

        // Handle disconnection
        port.onDisconnect.addListener(() => {
          logger.background.info(`Side panel disconnected for tab ${tabId}`);
          if (chrome.runtime.lastError) {
            // Log error but don't crash the extension
            logger.background.error(`Port disconnect error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
          }
          // Mark sidebar as not visible upon disconnection
          SidebarStateManager.setSidebarVisibilityForTab(tabId, false)
            .then(() => {
              logger.background.info(`Set sidebar visibility to false for tab ${tabId}`);
            })
            .catch(error => {
              logger.background.error(`Error setting sidebar visibility to false for tab ${tabId}:`, error);
            });
        });

      } else {
        logger.background.error(`Could not parse tabId from port name: ${port.name}`);
      }
    } else {
      logger.background.info(`Ignoring connection from non-sidepanel source: ${port.name}`);
    }
  });
  logger.background.info('Runtime connection listener set up.');
}

// Start the background service when the file is loaded
// This runs every time the service worker starts (initial load, wake-up)
startBackgroundService();
