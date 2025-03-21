// src/background/core/message-router.js - Centralized message handling

import logger from '../../utils/logger.js';
import { determineContentType } from '../../shared/content-utils.js';
import { handleCredentialOperation } from '../services/credential-manager.js';
import { handleApiModelRequest } from '../api/api-coordinator.js';
import { handleSummarizeContentRequest, handleSummarizeContentViaApiRequest } from '../services/summarization.js';
import { toggleSidebar, getSidebarState } from '../services/sidebar-manager.js';
import { clearQuickPrompt } from '../services/prompt-resolver.js';

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
    const contentType = determineContentType(message.url, message.hasSelection);
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
  
  // API summarization
  messageHandlers.set('summarizeContentViaApi', (message, sender, sendResponse) => {
    handleSummarizeContentViaApiRequest(message, sendResponse);
    return true; // Keep channel open for async response
  });
  
  // Get API response
  messageHandlers.set('getApiResponse', (message, sender, sendResponse) => {
    handleApiModelRequest('getApiResponse', message, sendResponse);
    return true; // Keep channel open for async response
  });
  
  // Sidebar API process
  messageHandlers.set('sidebarApiProcess', (message, sender, sendResponse) => {
    handleApiModelRequest('sidebarApiProcess', message, sendResponse);
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
  // Summarize content
  messageHandlers.set('summarizeContent', (message, sender, sendResponse) => {
    handleSummarizeContentRequest(message, sendResponse);
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
}