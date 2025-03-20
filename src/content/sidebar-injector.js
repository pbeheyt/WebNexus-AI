import { STORAGE_KEYS } from '../sidebar/constants';

/**
 * Manages sidebar iframe injection and communication
 */
class SidebarInjector {
  constructor() {
    this.iframe = null;
    this.visible = false;
    this.initialized = false;
  }
  
  /**
   * Initialize the sidebar injector
   */
  async initialize() {
    if (this.initialized) return;
    
    // Check if sidebar should be visible
    const { [STORAGE_KEYS.SIDEBAR_VISIBLE]: sidebarVisible } = 
      await chrome.storage.local.get(STORAGE_KEYS.SIDEBAR_VISIBLE);
    
    this.visible = sidebarVisible === true;
    
    // Create and inject iframe
    this._createIframe();
    
    // Set up message listeners
    this._setupMessageHandlers();
    
    this.initialized = true;
  }
  
  /**
   * Create and inject iframe
   * @private
   */
  _createIframe() {
    // Create iframe element
    this.iframe = document.createElement('iframe');
    this.iframe.src = chrome.runtime.getURL('sidebar.html');
    this.iframe.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 360px;
      height: 100vh;
      border: none;
      z-index: 2147483647; /* Maximum z-index */
      box-shadow: -2px 0 10px rgba(0,0,0,0.2);
      transition: transform 0.3s ease;
      transform: translateX(${this.visible ? '0' : '100%'});
    `;
    
    // Add to document
    document.body.appendChild(this.iframe);
  }
  
  /**
   * Set up message handlers for iframe communication
   * @private
   */
  _setupMessageHandlers() {
    // Listen for messages from iframe
    window.addEventListener('message', this._handleIframeMessage.bind(this));
    
    // Listen for messages from extension
    chrome.runtime.onMessage.addListener(this._handleExtensionMessage.bind(this));
  }
  
  /**
   * Handle messages from iframe
   * @private
   * @param {MessageEvent} event - Message event
   */
  _handleIframeMessage(event) {
    // Verify message is from our iframe
    if (!event.source || event.source !== this.iframe.contentWindow) {
      return;
    }
    
    if (!event.data || typeof event.data !== 'object') {
      return;
    }
    
    const { type } = event.data;
    
    switch (type) {
      case 'SIDEBAR_READY':
        console.log('Sidebar iframe is ready');
        // Sync current theme
        this._syncTheme();
        break;
        
      case 'TOGGLE_SIDEBAR':
        // Toggle sidebar visibility
        this.toggle(event.data.visible);
        break;
        
      case 'REQUEST_EXTRACTION':
        // Relay to background script
        this._requestContentExtraction();
        break;
        
      default:
        // Unknown message type
        break;
    }
  }
  
  /**
   * Handle messages from extension (background script)
   * @private
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   * @returns {boolean} Keep channel open for async response
   */
  _handleExtensionMessage(message, sender, sendResponse) {
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    switch (message.action) {
      case 'toggleSidebar':
        this.toggle(message.visible);
        sendResponse({ success: true });
        return false;
        
      case 'sidebarExtraction':
        // Forward extraction result to iframe
        if (this.iframe) {
          this.iframe.contentWindow.postMessage({
            type: 'EXTRACTION_COMPLETE',
            content: message.content
          }, '*');
        }
        sendResponse({ success: true });
        return false;
        
      default:
        // Unknown message type
        return false;
    }
  }
  
  /**
   * Toggle sidebar visibility
   * @param {boolean} visible - Visibility state
   */
  toggle(visible = !this.visible) {
    this.visible = visible;
    
    if (this.iframe) {
      this.iframe.style.transform = `translateX(${visible ? '0' : '100%'})`;
    }
    
    // Persist state
    chrome.storage.local.set({ [STORAGE_KEYS.SIDEBAR_VISIBLE]: visible });
  }
  
  /**
   * Request content extraction from background script
   * @private
   */
  async _requestContentExtraction() {
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }
      
      // Request content extraction
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeContent',
        tabId: currentTab.id,
        url: currentTab.url,
        hasSelection: false,
        useApi: true
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Content extraction failed');
      }
      
      // Get extracted content
      const { extractedContent } = await chrome.storage.local.get('extractedContent');
      
      // Forward to iframe
      if (this.iframe && extractedContent) {
        this.iframe.contentWindow.postMessage({
          type: 'EXTRACTION_COMPLETE',
          content: extractedContent
        }, '*');
      }
    } catch (error) {
      console.error('Error requesting content extraction:', error);
      
      // Notify iframe of error
      if (this.iframe) {
        this.iframe.contentWindow.postMessage({
          type: 'EXTRACTION_ERROR',
          error: error.message || 'Content extraction failed'
        }, '*');
      }
    }
  }
  
  /**
   * Sync theme with iframe
   * @private
   */
  async _syncTheme() {
    try {
      const { [STORAGE_KEYS.THEME]: theme } = await chrome.storage.sync.get(STORAGE_KEYS.THEME);
      
      if (this.iframe && theme) {
        this.iframe.contentWindow.postMessage({
          type: 'THEME_CHANGED',
          theme
        }, '*');
      }
    } catch (error) {
      console.error('Error syncing theme:', error);
    }
  }
}

// Create instance and initialize
const sidebarInjector = new SidebarInjector();

// Initialize sidebar on content script load
sidebarInjector.initialize();

// Export for external use
export default sidebarInjector;