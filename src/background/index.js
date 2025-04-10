// src/background/index.js - Entry point for background service worker

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
// Import the specific cleanup function and the listener setup
import { setupTabStateListener, performStaleTabCleanup } from './listeners/tab-state-listener.js';
import SidebarStateManager from '../services/SidebarStateManager.js';
import logger from '../shared/logger.js';

/**
 * Main entry point for the background service worker
 */
async function startBackgroundService() {
  try {
    logger.background.info('Starting background service...');
    // 1. Initialize extension configuration and state
    // Note: initializeExtension is also called within onInstalled listener
    //       but it's safe to run multiple times as it primarily resets state.
    await initializeExtension();

    // 2. Set up message router to handle communication
    setupMessageRouter();

    // 3. Set up event listeners
    setupTabListener();
    setupTabStateListener(); // Sets up onRemoved listener
    setupConnectionListener(); // Add connection listener setup

    // Listener for keyboard shortcuts
    chrome.commands.onCommand.addListener(async (command) => {
      logger.background.info(`Command received: ${command}`);
      if (command === "open_nexusai_sidebar") {
        try {
          // Get the current active tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            logger.background.info(`Command: Opening side panel for active tab: ${tab.id}`);
            // Open the side panel for the current tab
            await chrome.sidePanel.open({ tabId: tab.id });
            // Update internal state to reflect the panel should be visible
            await SidebarStateManager.setSidebarVisibilityForTab(tab.id, true);
            logger.background.info(`Command: Side panel opened and visibility state updated for tab ${tab.id}.`);
          } else {
            logger.background.warn("Command: No active tab found to open the side panel for.");
          }
        } catch (error) {
          logger.background.error(`Command: Error opening side panel via command for tab ${tab?.id}:`, error);
        }
      }
    });
    logger.background.info('Keyboard command listener registered.');

    // Listener for context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      logger.background.info(`Context menu item clicked: ${info.menuItemId}`);
      if (info.menuItemId === "nexusai_open_sidebar") {
        if (tab?.id) {
          try {
            logger.background.info(`Context Menu: Opening side panel for tab: ${tab.id}`);
            // Open the side panel for the clicked tab context
            await chrome.sidePanel.open({ tabId: tab.id });
            // Update internal state to reflect the panel should be visible
            await SidebarStateManager.setSidebarVisibilityForTab(tab.id, true);
            logger.background.info(`Context Menu: Side panel opened and visibility state updated for tab ${tab.id}.`);
          } catch (error) {
            logger.background.error(`Context Menu: Error opening side panel via context menu for tab ${tab.id}:`, error);
          }
        } else {
          logger.background.warn("Context Menu: Click received but no valid tab context found.");
        }
      }
    });
    logger.background.info('Context menu click listener registered.');

    // 4. Add the onStartup listener for cleanup
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
