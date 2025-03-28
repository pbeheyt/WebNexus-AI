// src/background/core/message-router.js - Centralized message handling

import logger from '../../utils/logger.js';
import { determineContentType } from '../../shared/content-utils.js';
import { handleCredentialOperation } from '../services/credential-manager.js';
import { handleApiModelRequest } from '../api/api-coordinator.js';
import { handleProcessContentRequest, handleProcessContentViaApiRequest } from '../services/content-processing.js';
import { toggleSidebar, getSidebarState } from '../services/sidebar-manager.js';
import { clearQuickPrompt } from '../services/prompt-resolver.js';
import { handleThemeOperation } from '../services/theme-service.js';
import { getExtractionPreference, setExtractionPreference } from '../services/tab-extraction-preference.js';

// Store for message handlers
const messageHandlers = new Map();

/**
 * Sets up message routing system
 */
export function setupMessageRouter() {
  // Register all message handlers
  registerCoreHandlers();
  registerApiHandlers();
  registerServiceHandlers();
  registerPreferenceHandlers(); // Register handlers for preference functions

  // Set up the message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Log the message for debugging
    logger.background.info('Message received in background', {
      message,
      sender: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
    });

    // Handle the message based on its action
    const handler = messageHandlers.get(message.action);

    if (handler) {
      // Call the handler and inform if it's async
      const result = handler(message, sender, sendResponse);
      return result === true; // Keep channel open for async response if needed
    }

    // Default simple responses
    if (message.action === 'checkStatus') {
      sendResponse({ status: 'ok' });
      return false;
    }

    // Handle getCurrentTabId for tab-specific sidebar functionality
    if (message.action === 'getCurrentTabId') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          sendResponse({ tabId: null, error: chrome.runtime.lastError.message });
        } else if (tabs && tabs.length > 0) {
          sendResponse({ tabId: tabs[0].id });
        } else {
          sendResponse({ tabId: null, error: "No active tab found" });
        }
      });
      return true; // Async response needed
    }


    logger.background.warn(`No handler registered for message action: ${message.action}`);
    return false;
  });

  logger.background.info('Message router initialized');
}

/**
 * Register core message handlers
 */
function registerCoreHandlers() {
  // Content type detection handler
  messageHandlers.set('getContentType', (message, sender, sendResponse) => {
    const contentType = determineContentType(message.url, false); // Ignore selection here
    sendResponse({ contentType });
    return false;
  });

  // Status check handler
  messageHandlers.set('checkStatus', (message, sender, sendResponse) => {
    sendResponse({ status: 'ok' });
    return false;
  });

  // Error notification handler
  messageHandlers.set('notifyError', (message, sender, sendResponse) => {
    logger.background.error('Error from content script:', message.error);
    return false;
  });

  // Tab ID provider for content scripts - Removed explicit handler, handled in main listener now
}

/**
 * Register API-related message handlers
 */
function registerApiHandlers() {
  // API mode availability check
  messageHandlers.set('checkApiModeAvailable', (message, sender, sendResponse) => {
    handleApiModelRequest('checkApiModeAvailable', message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get API models
  messageHandlers.set('getApiModels', (message, sender, sendResponse) => {
    handleApiModelRequest('getApiModels', message, sendResponse);
    return true; // Keep channel open for async response
  });

  // API credential operations
  messageHandlers.set('credentialOperation', (message, sender, sendResponse) => {
    handleCredentialOperation(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // API content processing
  messageHandlers.set('processContentViaApi', (message, sender, sendResponse) => {
    handleProcessContentViaApiRequest(message, sendResponse);
    return true; // Keep channel open for async response
  });

  messageHandlers.set('cancelStream', (message, sender, sendResponse) => {
    handleApiModelRequest('cancelStream', message, sendResponse);
    return true; // Keep channel open for async response
  });
}

/**
 * Register service-related message handlers
 */
function registerServiceHandlers() {
  // Process content
  messageHandlers.set('processContent', (message, sender, sendResponse) => {
    handleProcessContentRequest(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Clear quick prompt
  messageHandlers.set('clearQuickPrompt', (message, sender, sendResponse) => {
    clearQuickPrompt(message.contentType, sendResponse);
    return true; // Keep channel open for async response
  });

  // YouTube notifications
  messageHandlers.set('youtubeCommentsNotLoaded', (message, sender, sendResponse) => {
    // Relay to popup if open
    chrome.runtime.sendMessage({
      action: 'youtubeCommentsNotLoaded'
    });
    return false;
  });

  // Toggle sidebar
  messageHandlers.set('toggleSidebar', (message, sender, sendResponse) => {
    toggleSidebar(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get sidebar state
  messageHandlers.set('getSidebarState', (message, sender, sendResponse) => {
    getSidebarState(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get theme
  messageHandlers.set('getTheme', (message, sender, sendResponse) => {
    handleThemeOperation(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Set theme
  messageHandlers.set('setTheme', (message, sender, sendResponse) => {
    handleThemeOperation(message, sendResponse);
    return true; // Keep channel open for async response
  });
}

/**
 * Register preference-related message handlers
 */
function registerPreferenceHandlers() {
    // Get extraction preference
    messageHandlers.set('getTabExtractionPreference', async (message, sender, sendResponse) => {
        try {
            // Prioritize message.tabId, fallback to sender.tab.id
            const tabId = message.tabId ?? sender?.tab?.id;
            const isEnabled = await getExtractionPreference(tabId); // Use imported function
            sendResponse({ success: true, isEnabled });
        } catch (error) {
            logger.background.error('Error getting tab extraction preference:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Async
    });

    // Set extraction preference
    messageHandlers.set('setTabExtractionPreference', async (message, sender, sendResponse) => {
        try {
            // Prioritize message.tabId, fallback to sender.tab.id
            const tabId = message.tabId ?? sender?.tab?.id;
            const success = await setExtractionPreference(tabId, message.isEnabled); // Use imported function
            sendResponse({ success });
        } catch (error) {
            logger.background.error('Error setting tab extraction preference:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Async
    });
}