// src/background/index.js - Entry point for background service worker

import SidebarStateManager from '../services/SidebarStateManager.js';
import { logger } from '../shared/logger.js';

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
import {
  setupTabStateListener,
  performStaleTabCleanup,
} from './listeners/tab-state-listener.js';
import { setupContextMenuListener } from './listeners/context-menu-listener.js';
import { processWithDefaultPromptWebUI } from './services/content-processing.js';

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

    // Set up context menu listener
    setupContextMenuListener();

    // Set up command listener
    await setupCommandListener();

    // This runs every time the service worker starts (initial load, wake-up, after browser start)
    // It complements the onStartup listener.
    logger.background.info(
      'Running stale tab cleanup on service worker start...'
    );
    try {
      await performStaleTabCleanup(); // Call the cleanup function
      logger.background.info(
        'Service worker start stale tab cleanup completed.'
      );
    } catch (cleanupError) {
      logger.background.error(
        'Error during service worker start stale tab cleanup:',
        cleanupError
      );
    }

    // 4. Add the onStartup listener for cleanup
    // This listener persists across service worker restarts.
    chrome.runtime.onStartup.addListener(async () => {
      logger.background.info(
        'Browser startup detected via onStartup listener. Running stale tab cleanup...'
      );
      try {
        // Call the cleanup function directly
        await performStaleTabCleanup();
        logger.background.info('Startup stale tab cleanup completed.');
      } catch (cleanupError) {
        logger.background.error(
          'Error during startup stale tab cleanup:',
          cleanupError
        );
      }
    });
    logger.background.info('onStartup listener registered for cleanup.');

    logger.background.info(
      'Service worker started successfully and listeners are set up.'
    );
  } catch (error) {
    logger.background.error('Error starting background service:', error);
  }
}

/**
 * Sets up the listener for runtime connections (e.g., from side panel).
 */
/**
 * Sets up the listener for keyboard commands
 */
async function setupCommandListener() {
  chrome.commands.onCommand.addListener(async (command) => {
    logger.background.info(`Command received: ${command}`);
    if (command === 'process-default-prompt') {
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (activeTab && activeTab.id && activeTab.url) {
          logger.background.info(
            `Triggering default web UI processing for active tab ${activeTab.id} via command.`
          );
          await processWithDefaultPromptWebUI(activeTab);
        } else {
          logger.background.warn(
            'No active tab found to execute command:',
            command
          );
        }
      } catch (error) {
        logger.background.error(`Error handling command ${command}:`, error);
      }
    }
    // Note: No need to handle _execute_action here, Chrome does it automatically
  });
  logger.background.info('Command listener registered.');
}

function setupConnectionListener() {
  // This listener also persists across service worker restarts
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
            logger.background.info(
              `Set sidebar visibility to true for tab ${tabId}`
            );
          })
          .catch((error) => {
            logger.background.error(
              `Error setting sidebar visibility to true for tab ${tabId}:`,
              error
            );
          });

        // Handle disconnection
        port.onDisconnect.addListener(() => {
          logger.background.info(`Side panel disconnected for tab ${tabId}`);
          if (chrome.runtime.lastError) {
            // Log error but don't crash the extension
            logger.background.error(
              `Port disconnect error for tab ${tabId}: ${chrome.runtime.lastError.message}`
            );
          }
          // Mark sidebar as not visible upon disconnection
          SidebarStateManager.setSidebarVisibilityForTab(tabId, false)
            .then(() => {
              logger.background.info(
                `Set sidebar visibility to false for tab ${tabId}`
              );
            })
            .catch((error) => {
              logger.background.error(
                `Error setting sidebar visibility to false for tab ${tabId}:`,
                error
              );
            });
        });
      } else {
        logger.background.error(
          `Could not parse tabId from port name: ${port.name}`
        );
      }
    } else {
      logger.background.info(
        `Ignoring connection from non-sidepanel source: ${port.name}`
      );
    }
  });
  logger.background.info('Runtime connection listener set up.');
}

// Start the background service when the file is loaded
// This runs every time the service worker starts (initial load, wake-up)
startBackgroundService();
