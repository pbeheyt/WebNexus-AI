// src/background/index.js - Entry point for background service worker

import { initializeExtension } from './initialization.js';
import { setupMessageRouter } from './core/message-router.js';
import { setupTabListener } from './listeners/tab-listener.js';
import { setupCommandListener } from './listeners/command-listener.js';
import { setupContextMenuListener } from './listeners/context-menu-listener.js';
import { createContextMenus } from './listeners/context-menu-listener.js';

/**
 * Main entry point for the background service worker
 */
async function startBackgroundService() {
  try {
    // 1. Initialize extension configuration and state
    await initializeExtension();
    
    // 2. Set up message router to handle communication
    setupMessageRouter();
    
    // 3. Create context menus explicitly
    await createContextMenus();
    
    // 4. Set up event listeners
    setupTabListener();
    setupCommandListener();
    setupContextMenuListener();

    console.log('[Background] Service worker started successfully');
  } catch (error) {
    console.error('[Background] Error starting background service:', error);
  }
}

// Start the background service when the file is loaded
startBackgroundService();