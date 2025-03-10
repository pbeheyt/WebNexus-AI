document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const contentTypeDisplay = document.getElementById('contentTypeDisplay');
  const promptType = document.getElementById('promptType');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  
  // Content type constants
  const CONTENT_TYPES = {
    GENERAL: 'general',
    REDDIT: 'reddit',
    YOUTUBE: 'youtube'
  };
  
  /**
   * Check the current tab to determine content type
   */
  async function checkCurrentContentType() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab) {
        return { 
          type: null, 
          url: null,
          isSupported: false 
        };
      }
      
      const url = currentTab.url;
      let type = CONTENT_TYPES.GENERAL;
      
      if (url.includes('youtube.com/watch')) {
        type = CONTENT_TYPES.YOUTUBE;
      } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
        type = CONTENT_TYPES.REDDIT;
      }
      
      return { 
        type, 
        url,
        tabId: currentTab.id,
        isSupported: true 
      };
    } catch (error) {
      console.error('Error checking content type:', error);
      return { 
        type: null, 
        url: null,
        isSupported: false 
      };
    }
  }
  
  /**
   * Display the current content type in the UI
   */
  function updateContentTypeDisplay(contentType) {
    if (!contentTypeDisplay) return;
    
    let typeText = 'Unknown Content';
    let typeClass = 'unknown';
    
    switch (contentType) {
      case CONTENT_TYPES.YOUTUBE:
        typeText = 'YouTube Video';
        typeClass = 'youtube';
        break;
      case CONTENT_TYPES.REDDIT:
        typeText = 'Reddit Post';
        typeClass = 'reddit';
        break;
      case CONTENT_TYPES.GENERAL:
        typeText = 'Web Content';
        typeClass = 'general';
        break;
      default:
        typeText = 'Unsupported Content';
        typeClass = 'unsupported';
    }
    
    contentTypeDisplay.textContent = typeText;
    contentTypeDisplay.className = `content-type ${typeClass}`;
    
    // Auto-select the appropriate prompt type
    if (promptType && contentType) {
      promptType.value = contentType;
    }
  }
  
  /**
   * Check if content script is loaded in tab
   */
  async function isContentScriptLoaded(tabId) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log('Content script is ready, received:', response);
            resolve(true);
          }
        });
      } catch (error) {
        console.error('Error checking content script:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Inject content script for content extraction
   */
  async function injectContentScript(tabId, contentType) {
    try {
      let scriptFile = 'dist/general-content.bundle.js';
      
      if (contentType === CONTENT_TYPES.YOUTUBE) {
        scriptFile = 'dist/youtube-content.bundle.js';
      } else if (contentType === CONTENT_TYPES.REDDIT) {
        scriptFile = 'dist/reddit-content.bundle.js';
      }
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error('Failed to inject content script:', error);
      return false;
    }
  }
  
  /**
   * Handle summarize button click
   */
  async function handleSummarize() {
    try {
      statusMessage.textContent = 'Checking page content...';
      summarizeBtn.disabled = true;
      
      // Get current tab info
      const { type, tabId, isSupported } = await checkCurrentContentType();
      
      if (!isSupported || !type || !tabId) {
        statusMessage.textContent = 'Unsupported content type or tab issue';
        summarizeBtn.disabled = false;
        return;
      }
      
      // Check if content script is loaded
      let isScriptLoaded = await isContentScriptLoaded(tabId);
      
      // If not loaded, inject it
      if (!isScriptLoaded) {
        statusMessage.textContent = 'Initializing content extraction...';
        const injected = await injectContentScript(tabId, type);
        
        if (!injected) {
          statusMessage.textContent = 'Failed to initialize content extraction';
          summarizeBtn.disabled = false;
          return;
        }
        
        // Verify script is now loaded
        isScriptLoaded = await isContentScriptLoaded(tabId);
        
        if (!isScriptLoaded) {
          statusMessage.textContent = 'Content script initialization failed';
          summarizeBtn.disabled = false;
          return;
        }
      }
      
      // Clear any existing content
      await chrome.storage.local.set({ 
        contentReady: false,
        extractedContent: null
      });
      
      // Extract content
      statusMessage.textContent = 'Extracting content...';
      chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
      
      // Wait for extraction to complete
      const maxAttempts = 15;
      let attempts = 0;
      let extractionComplete = false;
      
      while (!extractionComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { contentReady } = await chrome.storage.local.get('contentReady');
        if (contentReady) {
          extractionComplete = true;
        }
        
        attempts++;
      }
      
      if (!extractionComplete) {
        statusMessage.textContent = 'Timed out waiting for content extraction';
        summarizeBtn.disabled = false;
        return;
      }
      
      // Load the appropriate prompt
      const selectedPromptType = promptType.value || type;
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      const prePrompt = config.defaultPrompts[selectedPromptType].content;
      
      // Open Claude in a new tab
      statusMessage.textContent = 'Opening Claude...';
      const claudeTab = await chrome.tabs.create({ 
        url: 'https://claude.ai/new',
        active: true
      });
      
      // Save tab ID for later
      await chrome.storage.local.set({
        claudeTabId: claudeTab.id,
        scriptInjected: false,
        prePrompt
      });
      
      // Close popup
      window.close();
    } catch (error) {
      console.error('Error:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      summarizeBtn.disabled = false;
    }
  }
  
  // Initialize popup
  async function initializePopup() {
    try {
      // Check current content type
      const { type, isSupported } = await checkCurrentContentType();
      
      // Update UI to show content type
      updateContentTypeDisplay(type);
      
      // Enable/disable summarize button based on support
      summarizeBtn.disabled = !isSupported;
      
      if (!isSupported) {
        statusMessage.textContent = 'Unsupported page. Please navigate to a YouTube video, Reddit post, or regular web page.';
      } else {
        statusMessage.textContent = 'Ready to summarize content.';
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      statusMessage.textContent = `Error initializing: ${error.message}`;
    }
  }
  
  // Set up event listeners
  summarizeBtn.addEventListener('click', handleSummarize);
  
  // Initialize the popup
  initializePopup();
});