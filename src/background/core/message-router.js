// src/background/core/message-router.js - Centralized message handling

import { logger } from '../../shared/logger.js';
import {
  determineContentType,
  isSidePanelAllowedPage,
} from '../../shared/utils/content-utils.js';
import { handleCredentialOperation } from '../services/credential-manager.js';
import { handleFetchPdfRequest } from '../services/file-access-service.js';
import { handleApiModelRequest } from '../api/api-coordinator.js';
import {
  handleProcessContentRequest,
  handleProcessContentViaApiRequest,
} from '../services/content-processing.js';
import { handleToggleNativeSidePanelAction, handleCloseCurrentSidePanelRequest } from '../services/sidepanel-manager.js';
import { handleThemeOperation } from '../services/theme-service.js';
import { handleClearTabDataRequest } from '../listeners/tab-state-listener.js';

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

  // Set up the message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Log the message for debugging
    logger.background.info('Message received in background', {
      message,
      sender: sender.tab ? `Tab ${sender.tab.id}` : 'Extension',
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

    // Handle getCurrentTabId for tab-specific sidepanel functionality
    if (message.action === 'getCurrentTabId') {
      sendResponse({ tabId: sender.tab ? sender.tab.id : null });
      return false;
    }

    logger.background.warn(
      `No handler registered for message action: ${message.action}`
    );
    return false;
  });

  logger.background.info('Message router initialized');
}

/**
 * Register core message handlers
 */
function registerCoreHandlers() {
  // Content type detection handler
  messageHandlers.set('getContentType', (message, _sender, sendResponse) => {
    const contentType = determineContentType(message.url, message.hasSelection);
    sendResponse({ contentType });
    return false;
  });

  // Status check handler
  messageHandlers.set('checkStatus', (_message, _sender, sendResponse) => {
    sendResponse({ status: 'ok' });
    return false;
  });

  // Error notification handler
  messageHandlers.set('notifyError', (message, _sender, _sendResponse) => {
    logger.background.error('Error from content script:', message.error);
    return false;
  });

  // Side panel allowed check
  messageHandlers.set(
    'isSidePanelAllowedPage',
    (message, sender, sendResponse) => {
      try {
        const isAllowed = isSidePanelAllowedPage(message.url);
        sendResponse(isAllowed);
      } catch (error) {
        logger.background.error('Error checking side panel allowance:', error);
        sendResponse(false);
      }
      return false;
    }
  );

  // Tab ID provider for content scripts
  messageHandlers.set('getCurrentTabId', (_message, sender, sendResponse) => {
    if (sender.tab) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      sendResponse({ tabId: null, error: 'Not in a tab context' });
    }
    return false;
  });
}

/**
 * Register API-related message handlers
 */
function registerApiHandlers() {
  // Get API models
  messageHandlers.set('getApiModels', (message, _sender, sendResponse) => {
    handleApiModelRequest('getApiModels', message, sendResponse);
    return true; // Keep channel open for async response
  });

  // API credential operations
  messageHandlers.set(
    'credentialOperation',
    (message, _sender, sendResponse) => {
      handleCredentialOperation(message, sendResponse);
      return true; // Keep channel open for async response
    }
  );

  // API content processing
  messageHandlers.set(
    'processContentViaApi',
    (message, _sender, sendResponse) => {
      handleProcessContentViaApiRequest(message, sendResponse);
      return true; // Keep channel open for async response
    }
  );

  messageHandlers.set('cancelStream', (message, _sender, sendResponse) => {
    handleApiModelRequest('cancelStream', message, sendResponse);
    return true; // Keep channel open for async response
  });
}

/**
 * Register service-related message handlers
 */
function registerServiceHandlers() {
  // Process content
  messageHandlers.set('processContent', (message, _sender, sendResponse) => {
    handleProcessContentRequest(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get theme
  messageHandlers.set('getTheme', (message, _sender, sendResponse) => {
    handleThemeOperation(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Set theme
  messageHandlers.set('setTheme', (message, _sender, sendResponse) => {
    handleThemeOperation(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Clear specific tab data (for sidepanel refresh)
  messageHandlers.set('clearTabData', handleClearTabDataRequest);

  // Handle requests to toggle the native side panel
  messageHandlers.set(
    'toggleNativeSidePanelAction',
    handleToggleNativeSidePanelAction
  );

  // Add this line within registerServiceHandlers
  messageHandlers.set('closeCurrentSidePanel', handleCloseCurrentSidePanelRequest);

  // Handle PDF fetch requests for file:// URLs
  messageHandlers.set('fetchPdfAsBase64', (message, _sender, sendResponse) => {
    handleFetchPdfRequest(message, sendResponse); 
    return true; // Keep channel open for async response
  });

}
