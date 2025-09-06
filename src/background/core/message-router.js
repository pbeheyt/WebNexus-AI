// src/background/core/message-router.js - Centralized message handling

import { logger } from '../../shared/logger.js';
import { handleCredentialOperation } from '../services/credential-manager.js';
import { handleFetchPdfRequest } from '../services/file-access-service.js';
import { handleApiModelRequest } from '../api/api-coordinator.js';
import {
  handleProcessContentRequest,
  handleProcessContentViaApiRequest,
  handleGetContentTypeRequest,
} from '../services/content-processing.js';
import {
  handleToggleSidePanelAction,
  handleCloseCurrentSidePanelRequest,
  handleIsSidePanelAllowedPageRequest,
} from '../services/sidepanel-manager.js';
import { handleThemeOperation } from '../services/theme-service.js';
import {
  handleClearTabDataRequest,
  handleUpdateSelectionStatusRequest,
} from '../listeners/tab-state-listener.js';

import {
  handleCheckStatus,
  handleNotifyError,
  handleGetCurrentTabId,
} from './core-handlers.js';

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
  messageHandlers.set('getContentType', handleGetContentTypeRequest);

  // Status check handler
  messageHandlers.set('checkStatus', handleCheckStatus);

  // Error notification handler
  messageHandlers.set('notifyError', handleNotifyError);

  // Side panel allowed check
  messageHandlers.set(
    'isSidePanelAllowedPage',
    handleIsSidePanelAllowedPageRequest
  );

  // Tab ID provider for content scripts
  messageHandlers.set('getCurrentTabId', handleGetCurrentTabId);
}

/**
 * Register API-related message handlers
 */
function registerApiHandlers() {
  if (process.env.BUILD_MODE === 'full') {
    // Get API models
    messageHandlers.set('getApiModels', (message, _sender, sendResponse) => {
      handleApiModelRequest('getApiModels', message, sendResponse);
      return true; // Keep channel open for async response
    });

    // API credential operations
    messageHandlers.set(
      'credentialOperation',
      (message, sender, sendResponse) => {
        handleCredentialOperation(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
    );

    // API content processing
    messageHandlers.set(
      'processContentViaApi',
      (message, sender, sendResponse) => {
        handleProcessContentViaApiRequest(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
    );

    messageHandlers.set('cancelStream', (message, _sender, sendResponse) => {
      handleApiModelRequest('cancelStream', message, sendResponse);
      return true; // Keep channel open for async response
    });
  }
}

/**
 * Register service-related message handlers
 */
function registerServiceHandlers() {
  // Process content
  messageHandlers.set('processContent', (message, sender, sendResponse) => {
    handleProcessContentRequest(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get theme
  messageHandlers.set('getTheme', (message, sender, sendResponse) => {
    handleThemeOperation(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Set theme
  messageHandlers.set('setTheme', (message, sender, sendResponse) => {
    handleThemeOperation(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Clear specific tab data (for sidepanel refresh)
  messageHandlers.set('clearTabData', (message, sender, sendResponse) => {
    handleClearTabDataRequest(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  // Selection status update from content script
  messageHandlers.set(
    'updateSelectionStatus',
    (message, sender, sendResponse) => {
      handleUpdateSelectionStatusRequest(message, sender, sendResponse);
      return true; // Keep channel open for async response
    }
  );

  if (process.env.BUILD_MODE === 'full') {
    // Handle requests to toggle the side panel
    messageHandlers.set('toggleSidePanelAction', handleToggleSidePanelAction);

    // Handle requests to close the current side panel
    messageHandlers.set(
      'closeCurrentSidePanel',
      (message, sender, sendResponse) => {
        handleCloseCurrentSidePanelRequest(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
    );
  }

  // Handle PDF fetch requests for file:// URLs
  messageHandlers.set('fetchPdfAsBase64', (message, sender, sendResponse) => {
    handleFetchPdfRequest(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });
}
