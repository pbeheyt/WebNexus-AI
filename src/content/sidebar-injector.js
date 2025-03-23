import { STORAGE_KEYS } from '../shared/constants';

/**
 * Manages sidebar iframe injection and communication with singleton pattern enforcement
 * Now supports tab-specific visibility state
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
    this.tabId = null;
    this.currentTheme = 'light'; // Default cached theme
    
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
      // Get current tab ID
      try {
        // This only works if called from a content script
        this.tabId = await this._getCurrentTabId();
        console.log(`SidebarInjector: Current tab ID: ${this.tabId}`);
      } catch (err) {
        console.error('SidebarInjector: Failed to get tab ID:', err);
      }
      
      // Check if sidebar should be visible for this tab
      const visible = await this._getTabVisibilityState();
      this.visible = visible;
      
      console.log(`SidebarInjector: Initial visibility for tab: ${this.visible}`);
      
      // Preload theme cache before iframe creation
      try {
        await this._preloadTheme();
      } catch (err) {
        console.warn('SidebarInjector: Failed to preload theme:', err);
      }
      
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
   * Get current tab ID using chrome runtime API
   * @private
   * @returns {Promise<number>} Tab ID
   */
  async _getCurrentTabId() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (response) => {
          if (chrome.runtime.lastError) {
            // Alternative method if message fails
            chrome.runtime.sendMessage({ action: 'ping' }, { frameId: 0 }, (pingResponse) => {
              if (chrome.runtime.lastError || !pingResponse || !pingResponse.tabId) {
                reject(new Error('Could not determine tab ID'));
              } else {
                resolve(pingResponse.tabId);
              }
            });
          } else if (response && response.tabId) {
            resolve(response.tabId);
          } else {
            reject(new Error('Invalid response for tab ID request'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Get visibility state for current tab
   * @private
   * @returns {Promise<boolean>} Visibility state
   */
  async _getTabVisibilityState() {
    try {
      // Request visibility state from background
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { 
            action: 'getSidebarState',
            tabId: this.tabId 
          }, 
          (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              console.warn('SidebarInjector: Failed to get tab visibility state, defaulting to hidden');
              resolve(false);
            } else {
              resolve(response.state.visible === true);
            }
          }
        );
      });
    } catch (error) {
      console.error('SidebarInjector: Error getting tab visibility state:', error);
      return false;
    }
  }
  
  /**
   * Preload theme to avoid extension context issues
   * @private
   */
  async _preloadTheme() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ action: 'getTheme' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          if (response && response.theme) {
            this.currentTheme = response.theme;
            console.log(`SidebarInjector: Preloaded theme: ${this.currentTheme}`);
            resolve(this.currentTheme);
          } else {
            // Fallback to storage directly if background service isn't responding
            chrome.storage.sync.get(STORAGE_KEYS.THEME, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              this.currentTheme = result[STORAGE_KEYS.THEME] || 'light';
              console.log(`SidebarInjector: Fallback theme loaded: ${this.currentTheme}`);
              resolve(this.currentTheme);
            });
          }
        });
      } catch (err) {
        console.warn('SidebarInjector: Theme preload failed, using default:', err);
        resolve('light'); // Default fallback
      }
    });
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
        
      case 'THEME_CHANGED':
        // Handle theme change notification from iframe
        console.log(`SidebarInjector: Theme change from iframe: ${event.data.theme}`);
        this.currentTheme = event.data.theme;
        
        // Propagate to background for storage
        try {
          chrome.runtime.sendMessage({ 
            action: 'setTheme', 
            theme: event.data.theme 
          });
        } catch (error) {
          console.warn('SidebarInjector: Failed to propagate theme change:', error);
        }
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
        sendResponse({ ready: true, tabId: this.tabId });
        return false;
        
      case 'toggleSidebar':
        console.log(`SidebarInjector: Toggle request from extension, visible: ${message.visible}`);
        this.toggle(message.visible);
        
        // Ensure we always respond to the toggle message
        if (sendResponse) {
          sendResponse({ 
            success: true, 
            visible: this.visible,
            initialized: this.initialized,
            tabId: this.tabId
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
        
      case 'themeUpdated':
        // Theme was updated from background service
        console.log(`SidebarInjector: Theme update from background: ${message.theme}`);
        this.currentTheme = message.theme;
        
        // Forward to iframe if available
        if (this.iframe) {
          this._syncTheme();
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
   * Toggle sidebar visibility with tab-specific state handling
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
    
    // Persist state for this tab
    console.log(`SidebarInjector: Saving visibility state for tab ${this.tabId}: ${visible}`);
    chrome.runtime.sendMessage({
      action: 'toggleSidebar',
      visible: visible,
      tabId: this.tabId
    });
    
    // Notify iframe of state change
    if (this.iframe) {
      this.iframe.contentWindow.postMessage({
        type: 'SIDEBAR_VISIBILITY_CHANGED',
        visible
      }, '*');
    }
  }
  
  /**
   * Sync theme with iframe using cached theme to avoid direct Chrome API calls
   * @private
   */
  _syncTheme() {
    try {
      // Use cached theme value to avoid Chrome API direct access
      console.log(`SidebarInjector: Syncing theme: ${this.currentTheme}`);
      
      if (this.iframe) {
        this.iframe.contentWindow.postMessage({
          type: 'THEME_CHANGED',
          theme: this.currentTheme
        }, '*');
      }
      
      // Asynchronously refresh cached theme from background
      this._refreshCachedTheme().catch(err => {
        console.warn('SidebarInjector: Failed to refresh theme cache:', err);
      });
    } catch (error) {
      console.error('SidebarInjector: Error syncing theme:', error);
    }
  }
  
  /**
   * Refresh cached theme value via background service
   * @private
   * @returns {Promise<string>} Current theme
   */
  async _refreshCachedTheme() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ action: 'getTheme' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          if (response && response.theme) {
            this.currentTheme = response.theme;
            resolve(this.currentTheme);
          } else {
            reject(new Error('Invalid theme response'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
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