// src/background/index.js - Entry point for background service worker

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
import { setupTabStateListener, performStaleTabCleanup } from './listeners/tab-state-listener.js'; // Import the cleanup function
import { setupCommandListener } from './listeners/command-listener.js';
import { setupContextMenuListener } from './listeners/contextmenu-listener.js';

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

// Start the background service when the file is loaded
startBackgroundService();
