import { MESSAGE_TYPES } from '../constants';

/**
 * Helper service for iframe-parent communication
 */
class IframeMessaging {
  constructor() {
    this._handlers = new Map();
  }
  
  /**
   * Initialize message handlers
   */
  initialize() {
    // Set up message listener
    window.addEventListener('message', this._handleMessage.bind(this));
    
    // Signal to parent that sidebar is ready
    this.sendMessage(MESSAGE_TYPES.SIDEBAR_READY);
    
    return this;
  }
  
  /**
   * Register a handler for a message type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  registerHandler(type, handler) {
    this._handlers.set(type, handler);
  }
  
  /**
   * Send a message to the parent frame
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  sendMessage(type, data = {}) {
    window.parent.postMessage({ type, ...data }, '*');
  }
  
  /**
   * Toggle sidebar visibility
   * @param {boolean} visible - Visibility state
   */
  toggleSidebar(visible) {
    this.sendMessage(MESSAGE_TYPES.TOGGLE_SIDEBAR, { visible });
  }
  
  /**
   * Handle incoming messages
   * @private
   * @param {MessageEvent} event - Message event
   */
  _handleMessage(event) {
    // Validate message
    if (!event.data || typeof event.data !== 'object' || !event.data.type) {
      return;
    }
    
    // Get handler for this message type
    const handler = this._handlers.get(event.data.type);
    
    if (handler) {
      handler(event.data);
    }
  }
}

// Export singleton instance
export default new IframeMessaging();

// Helper to set up common message handlers
export function setupMessageHandlers() {
  const messaging = IframeMessaging.initialize();
  
  // Register handlers for common message types
  messaging.registerHandler(MESSAGE_TYPES.EXTRACTION_COMPLETE, (data) => {
    console.log('Content extraction complete:', data.content);
    // Update local state or trigger callback
  });
  
  messaging.registerHandler(MESSAGE_TYPES.PAGE_INFO_UPDATED, (data) => {
    console.log('Page info updated:', data.pageInfo);
    // Update local state or trigger callback
  });
  
  messaging.registerHandler(MESSAGE_TYPES.THEME_CHANGED, (data) => {
    console.log('Theme changed:', data.theme);
    document.documentElement.setAttribute('data-theme', data.theme);
  });
  
  return messaging;
}