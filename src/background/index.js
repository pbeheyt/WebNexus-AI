// src/background/index.js - Entry point for background service worker

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
import { setupTabStateListener, performStaleTabCleanup } from './listeners/tab-state-listener.js';
import { setupCommandListener } from './listeners/command-listener.js';
import { setupContextMenuListener } from './listeners/contextmenu-listener.js';
import SidebarStateManager from '../services/SidebarStateManager.js';

/**
 * Main entry point for the background service worker
 */
async function startBackgroundService() {
  try {
    // 1. Initialize extension configuration and state
    await initializeExtension();
    
    // 2. Set up message router to handle communication
    setupMessageRouter();
    
    // 3. Set up event listeners
    setupTabListener();
    setupTabStateListener();
    setupCommandListener();
    setupContextMenuListener();
    setupConnectionListener(); // Add connection listener setup

    // Perform initial cleanup on startup
    console.log('[Background] Performing initial stale tab data cleanup...');
    try {
      await performStaleTabCleanup();
      console.log('[Background] Initial stale tab data cleanup completed.');
    } catch (cleanupError) {
      console.error('[Background] Error during initial stale tab data cleanup:', cleanupError);
    }

    console.log('[Background] Service worker started successfully');
  } catch (error) {
    console.error('[Background] Error starting background service:', error);
  }
}

/**
 * Sets up the listener for runtime connections (e.g., from side panel).
 */
function setupConnectionListener() {
  chrome.runtime.onConnect.addListener((port) => {
    console.log(`[Background] Connection received: ${port.name}`);

    if (port.name.startsWith('sidepanel-connect-')) {
      const parts = port.name.split('-');
      const tabIdStr = parts[parts.length - 1];
      const tabId = parseInt(tabIdStr, 10);

      if (!isNaN(tabId)) {
        console.log(`[Background] Side panel connected for tab ${tabId}`);

        // Mark sidebar as visible upon connection
        SidebarStateManager.setSidebarVisibilityForTab(tabId, true)
          .then(() => {
            console.log(`[Background] Set sidebar visibility to true for tab ${tabId}`);
          })
          .catch(error => {
            console.error(`[Background] Error setting sidebar visibility to true for tab ${tabId}:`, error);
          });

        // Handle disconnection
        port.onDisconnect.addListener(() => {
          console.log(`[Background] Side panel disconnected for tab ${tabId}`);
          if (chrome.runtime.lastError) {
            console.error(`[Background] Port disconnect error for tab ${tabId}:`, chrome.runtime.lastError.message);
          }
          // Mark sidebar as not visible upon disconnection
          SidebarStateManager.setSidebarVisibilityForTab(tabId, false)
            .then(() => {
              console.log(`[Background] Set sidebar visibility to false for tab ${tabId}`);
            })
            .catch(error => {
              console.error(`[Background] Error setting sidebar visibility to false for tab ${tabId}:`, error);
            });
        });

      } else {
        console.error(`[Background] Could not parse tabId from port name: ${port.name}`);
      }
    } else {
      console.log(`[Background] Ignoring connection from non-sidepanel source: ${port.name}`);
    }
  });
  console.log('[Background] Runtime connection listener set up.');
}


// Start the background service when the file is loaded
startBackgroundService();
