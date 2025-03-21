import { STORAGE_KEYS } from '../sidebar/constants';

/**
 * Manages sidebar iframe injection and communication with singleton pattern enforcement
 */
class SidebarInjector {
  constructor() {
    // Enforce singleton pattern
    if (SidebarInjector.instance) {
      console.log('SidebarInjector: Returning existing instance');
      return SidebarInjector.instance;
    }
    
    this.iframe = null;
    this.visible = false;
    this.initialized = false;
    this.pendingInitialization = false;
    
    // Store instance for singleton pattern
    SidebarInjector.instance = this;
    
    // Debugging information
    console.log('SidebarInjector: New instance created');
  }
  
  /**
   * Initialize the sidebar injector with guaranteed singleton behavior
   * @returns {Promise<SidebarInjector>} The singleton instance
   */
  async initialize() {
    // Prevent concurrent initialization
    if (this.pendingInitialization) {
      console.log('SidebarInjector: Initialization already in progress');
      return this;
    }
    
    if (this.initialized) {
      console.log('SidebarInjector: Already initialized');
      return this;
    }
    
    this.pendingInitialization = true;
    console.log('SidebarInjector: Initializing...');
    
    try {
      // Check if sidebar should be visible from storage
      const { [STORAGE_KEYS.SIDEBAR_VISIBLE]: sidebarVisible } = 
        await chrome.storage.local.get(STORAGE_KEYS.SIDEBAR_VISIBLE);
      
      this.visible = sidebarVisible === true;
      console.log(`SidebarInjector: Initial visibility from storage: ${this.visible}`);
      
      // Check for existing iframe before creating a new one
      const existingIframe = document.getElementById('ai-content-sidebar-iframe');
      if (existingIframe) {
        console.log('SidebarInjector: Found existing iframe, reusing');
        this.iframe = existingIframe;
        // Update visibility to match stored state
        this.iframe.style.transform = `translateX(${this.visible ? '0' : '100%'})`;
      } else {
        // Create and inject iframe
        console.log('SidebarInjector: Creating new iframe');
        this._createIframe();
      }
      
      // Set up message listeners
      this._setupMessageHandlers();
      
      this.initialized = true;
      this.pendingInitialization = false;
      console.log('SidebarInjector: Initialization complete');
    } catch (error) {
      this.pendingInitialization = false;
      console.error('SidebarInjector: Initialization failed', error);
    }
    
    return this;
  }
  
  /**
   * Create and inject iframe
   * @private
   */
  _createIframe() {
    // Create iframe element
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'ai-content-sidebar-iframe'; // Add ID for easier detection
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
    
    // Create wrapper to ensure proper cleanup
    const wrapper = document.createElement('div');
    wrapper.id = 'ai-content-sidebar-wrapper';
    wrapper.appendChild(this.iframe);
    
    // Add to document
    document.body.appendChild(wrapper);
    
    console.log(`SidebarInjector: Iframe created and injected with visibility: ${this.visible}`);
  }
  
  /**
   * Set up message handlers for iframe communication
   * @private
   */
  _setupMessageHandlers() {
    // Remove any existing listeners to prevent duplicates
    window.removeEventListener('message', this._boundIframeMessageHandler);
    
    // Create bound handler for removal reference
    this._boundIframeMessageHandler = this._handleIframeMessage.bind(this);
    
    // Listen for messages from iframe
    window.addEventListener('message', this._boundIframeMessageHandler);
    
    // Set up extension message listener with cleanup of previous listeners
    this._setupExtensionMessageListener();
    
    console.log('SidebarInjector: Message handlers set up');
  }
  
  /**
   * Set up extension message listener with safeguards
   * @private
   */
  _setupExtensionMessageListener() {
    // Chrome APIs handle duplicate listeners automatically, 
    // but we'll use a unique function name for clarity
    
    // First, create a named handler function for this instance
    const handlerName = `_handleExtensionMessage_${Date.now()}`;
    
    // Store reference on instance for debugging
    this[handlerName] = (message, sender, sendResponse) => {
      const result = this._handleExtensionMessage(message, sender, sendResponse);
      return result;
    };
    
    // Add the listener
    chrome.runtime.onMessage.addListener(this[handlerName]);
    
    console.log(`SidebarInjector: Extension message listener added as ${handlerName}`);
  }
  
  /**
   * Handle messages from iframe
   * @private
   * @param {MessageEvent} event - Message event
   */
  _handleIframeMessage(event) {
    // Verify message is from our iframe
    if (!event.source || !this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }
    
    if (!event.data || typeof event.data !== 'object') {
      return;
    }
    
    const { type } = event.data;
    console.log(`SidebarInjector: Received iframe message of type: ${type}`);
    
    switch (type) {
      case 'SIDEBAR_READY':
        console.log('SidebarInjector: Sidebar iframe is ready');
        // Sync current theme
        this._syncTheme();
        break;
        
      case 'TOGGLE_SIDEBAR':
        // Toggle sidebar visibility
        console.log(`SidebarInjector: Toggle request from iframe, visible: ${event.data.visible}`);
        this.toggle(event.data.visible);
        break;
        
      case 'REQUEST_EXTRACTION':
        // Relay to background script
        console.log('SidebarInjector: Content extraction requested from iframe');
        this._requestContentExtraction();
        break;
        
      default:
        // Unknown message type
        console.log(`SidebarInjector: Unknown iframe message type: ${type}`);
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
    
    console.log(`SidebarInjector: Received extension message: ${message.action}`);
    
    switch (message.action) {
      case 'ping':
        // Simple ping to check if content script is loaded
        console.log('SidebarInjector: Ping received, responding with ready status');
        sendResponse({ ready: true });
        return false;
        
      case 'toggleSidebar':
        console.log(`SidebarInjector: Toggle request from extension, visible: ${message.visible}`);
        this.toggle(message.visible);
        
        // Ensure we always respond to the toggle message
        if (sendResponse) {
          sendResponse({ 
            success: true, 
            visible: this.visible,
            initialized: this.initialized
          });
        }
        return false;
        
      case 'sidebarExtraction':
        // Forward extraction result to iframe
        console.log('SidebarInjector: Extraction result received from extension');
        if (this.iframe) {
          this.iframe.contentWindow.postMessage({
            type: 'EXTRACTION_COMPLETE',
            content: message.content
          }, '*');
        }
        
        if (sendResponse) {
          sendResponse({ success: true });
        }
        return false;
        
      default:
        // Unknown message type
        console.log(`SidebarInjector: Unknown extension message: ${message.action}`);
        return false;
    }
  }
  
  /**
   * Toggle sidebar visibility with improved state handling
   * @param {boolean} visible - Visibility state
   */
  toggle(visible = !this.visible) {
    console.log(`SidebarInjector: Toggling sidebar to ${visible} (current: ${this.visible})`);
    
    // Only proceed if state actually changes or first initialization
    if (this.visible === visible && this.initialized) {
      console.log('SidebarInjector: Visibility already matches requested state, no action needed');
      return;
    }
    
    this.visible = visible;
    
    if (this.iframe) {
      console.log(`SidebarInjector: Setting iframe transform to ${visible ? 'visible' : 'hidden'}`);
      this.iframe.style.transform = `translateX(${visible ? '0' : '100%'})`;
    } else {
      console.warn('SidebarInjector: No iframe available for toggle');
      // If toggle called before iframe is ready, initialize
      if (!this.initialized && !this.pendingInitialization) {
        console.log('SidebarInjector: Toggle called before initialization, initializing...');
        this.initialize().then(() => {
          // After initialization, set state correctly
          if (this.iframe) {
            this.iframe.style.transform = `translateX(${visible ? '0' : '100%'})`;
          }
        });
      }
    }
    
    // Persist state
    console.log(`SidebarInjector: Saving visibility state: ${visible}`);
    chrome.storage.local.set({ [STORAGE_KEYS.SIDEBAR_VISIBLE]: visible });
    
    // Notify iframe of state change
    if (this.iframe) {
      this.iframe.contentWindow.postMessage({
        type: 'SIDEBAR_VISIBILITY_CHANGED',
        visible
      }, '*');
    }
  }
  
  /**
   * Request content extraction from background script
   * @private
   */
  async _requestContentExtraction() {
    try {
      console.log('SidebarInjector: Requesting content extraction');
      
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
        console.log('SidebarInjector: Forwarding extracted content to iframe');
        this.iframe.contentWindow.postMessage({
          type: 'EXTRACTION_COMPLETE',
          content: extractedContent
        }, '*');
      }
    } catch (error) {
      console.error('SidebarInjector: Error requesting content extraction:', error);
      
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
        console.log(`SidebarInjector: Syncing theme: ${theme}`);
        this.iframe.contentWindow.postMessage({
          type: 'THEME_CHANGED',
          theme
        }, '*');
      }
    } catch (error) {
      console.error('SidebarInjector: Error syncing theme:', error);
    }
  }
}

// Create instance and initialize
console.log('Content script loaded: initializing SidebarInjector');
const sidebarInjector = new SidebarInjector();

// Initialize sidebar on content script load
sidebarInjector.initialize().then(() => {
  console.log('SidebarInjector: Initial setup complete');
  
  // Verify initialized state after a delay to catch potential race conditions
  setTimeout(() => {
    if (!sidebarInjector.initialized) {
      console.warn('SidebarInjector: Still not initialized after timeout, attempting re-initialization');
      sidebarInjector.initialize();
    }
  }, 1000);
});

// Handle extension startup and window object existence
if (typeof window !== 'undefined') {
  // Store instance on window for debugging and to prevent garbage collection
  window.__sidebarInjector = sidebarInjector;
  
  // Add a safety check to ensure proper initialization
  window.addEventListener('load', () => {
    if (!sidebarInjector.initialized) {
      console.warn('SidebarInjector: Not initialized after window load, re-initializing');
      sidebarInjector.initialize();
    }
  });
}

// Export for external use
export default sidebarInjector;