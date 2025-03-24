import { MESSAGE_TYPES } from '../constants';

/**
 * Service for managing communication between the sidebar iframe and parent window
 * Implements a singleton pattern with proper initialization lifecycle management
 */
class IframeMessaging {
  constructor() {
    this._handlers = new Map();
    this._tabId = null;
    this._initialized = false;
    this._boundHandleMessage = null; // Store bound handler reference for proper cleanup
  }
  
  /**
   * Initialize message handlers and communication channel
   * @param {number} tabId - The tab ID for context-aware messaging
   * @returns {IframeMessaging} - Returns this instance for method chaining
   */
  initialize(tabId = null) {
    // Guard against multiple initializations
    if (this._initialized) {
      console.log('IframeMessaging: Already initialized');
      return this;
    }
    
    // Store tab ID for contextual operations
    this._tabId = tabId;
    console.log(`IframeMessaging: Initializing with tabId: ${this._tabId}`);
    
    // Create bound handler with proper context binding
    this._boundHandleMessage = this._handleMessage.bind(this);
    
    // Set up message listener with bound handler for proper cleanup
    window.addEventListener('message', this._boundHandleMessage);
    
    // Signal to parent that sidebar is ready with tab context
    this.sendMessage(MESSAGE_TYPES.SIDEBAR_READY, { tabId: this._tabId });
    
    this._initialized = true;
    return this;
  }
  
  /**
   * Clean up resources to prevent memory leaks
   */
  dispose() {
    if (this._boundHandleMessage) {
      window.removeEventListener('message', this._boundHandleMessage);
      this._boundHandleMessage = null;
    }
    
    this._handlers.clear();
    this._initialized = false;
    console.log('IframeMessaging: Disposed resources');
  }
  
  /**
   * Update the current tab ID for contextual operations
   * @param {number} tabId - The new tab ID
   */
  setTabId(tabId) {
    if (this._tabId !== tabId) {
      console.log(`IframeMessaging: Updating tabId from ${this._tabId} to ${tabId}`);
      this._tabId = tabId;
      
      // Notify parent of tab context change
      if (this._initialized) {
        this.sendMessage(MESSAGE_TYPES.SIDEBAR_READY, { tabId: this._tabId });
      }
    }
  }
  
  /**
   * Register a handler for a specific message type
   * @param {string} type - Message type identifier
   * @param {Function} handler - Handler function to process messages of this type
   * @returns {Function} - Unregister function for cleanup
   */
  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      console.error(`IframeMessaging: Invalid handler for message type "${type}"`);
      return () => {};
    }
    
    this._handlers.set(type, handler);
    console.log(`IframeMessaging: Registered handler for message type "${type}"`);
    
    // Return unregister function
    return () => {
      this._handlers.delete(type);
      console.log(`IframeMessaging: Unregistered handler for message type "${type}"`);
    };
  }
  
  /**
   * Send a message to the parent frame with appropriate context
   * @param {string} type - Message type identifier
   * @param {Object} data - Message payload data
   */
  sendMessage(type, data = {}) {
    if (!type) {
      console.error('IframeMessaging: Cannot send message without type');
      return;
    }
    
    // Always include tab ID in messages for contextual processing
    const messageData = {
      ...data,
      tabId: this._tabId,
      type
    };
    
    try {
      window.parent.postMessage(messageData, '*');
    } catch (error) {
      console.error(`IframeMessaging: Error sending message of type "${type}"`, error);
    }
  }
  
  /**
   * Toggle sidebar visibility with current tab context
   * @param {boolean} visible - Desired visibility state
   */
  toggleSidebar(visible) {
    this.sendMessage(MESSAGE_TYPES.TOGGLE_SIDEBAR, { 
      visible,
      tabId: this._tabId 
    });
  }
  
  /**
   * Process incoming messages from parent window
   * @private
   * @param {MessageEvent} event - DOM message event
   */
  _handleMessage(event) {
    // Validate message structure
    if (!event.data || typeof event.data !== 'object' || !event.data.type) {
      return;
    }
    
    const { type, tabId } = event.data;
    
    // Update tab ID if provided in message and different from current
    if (tabId && this._tabId !== tabId) {
      this._tabId = tabId;
    }
    
    // Invoke registered handler for this message type
    const handler = this._handlers.get(type);
    
    if (handler) {
      try {
        handler(event.data);
      } catch (error) {
        console.error(`IframeMessaging: Error in handler for message type "${type}"`, error);
      }
    }
  }
  
  /**
   * Check if the service has been initialized
   * @returns {boolean} - Initialization state
   */
  isInitialized() {
    return this._initialized;
  }
  
  /**
   * Get the current tab ID
   * @returns {number|null} - Current tab ID or null if not set
   */
  getTabId() {
    return this._tabId;
  }
}

// Create singleton instance
const messagingInstance = new IframeMessaging();

// Export the singleton instance as default
export default messagingInstance;

/**
 * Helper function to set up common message handlers with proper tab context
 * @param {number} tabId - The tab ID for contextual operations
 * @returns {IframeMessaging} - The initialized messaging service instance
 */
export function setupMessageHandlers(tabId = null) {
  // Initialize the singleton instance with tab context
  messagingInstance.initialize(tabId);
  
  // Register handlers for common message types
  messagingInstance.registerHandler(MESSAGE_TYPES.EXTRACTION_COMPLETE, (data) => {
    console.log('Content extraction complete for tab:', data.tabId, data.content);
    // Update local state or trigger callback
  });
  
  messagingInstance.registerHandler(MESSAGE_TYPES.PAGE_INFO_UPDATED, (data) => {
    console.log('Page info updated for tab:', data.tabId, data.pageInfo);
    // Update local state or trigger callback
  });
  
  messagingInstance.registerHandler(MESSAGE_TYPES.THEME_CHANGED, (data) => {
    console.log('Theme changed:', data.theme);
    document.documentElement.setAttribute('data-theme', data.theme);
  });
  
  messagingInstance.registerHandler(MESSAGE_TYPES.SIDEBAR_VISIBILITY_CHANGED, (data) => {
    console.log('Sidebar visibility changed:', data.visible);
    // Handle visibility state changes
  });
  
  // Return the initialized instance for further customization
  return messagingInstance;
}