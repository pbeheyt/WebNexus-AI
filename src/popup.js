// src/popup.js (updated with settings button functionality)
document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const contentTypeDisplay = document.getElementById('contentTypeDisplay');
  const promptType = document.getElementById('promptType');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  const settingsBtn = document.getElementById('settingsBtn');
  
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
   * Load available custom prompts for the dropdown
   */
  async function loadCustomPrompts() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('custom_prompts', (result) => {
        const customPrompts = result.custom_prompts || {};
        resolve(customPrompts);
      });
    });
  }
  
  /**
   * Update the prompt selector dropdown to include custom prompts
   */
  async function updatePromptSelector(contentType) {
    try {
      // Get custom prompts
      const customPrompts = await loadCustomPrompts();
      
      // Clear existing options except the default ones
      while (promptType.options.length > 3) {
        promptType.remove(3);
      }
      
      // If we have custom prompts for this content type, add them
      const customPromptsForType = Object.entries(customPrompts)
        .filter(([_, prompt]) => prompt.type === contentType);
      
      if (customPromptsForType.length > 0) {
        // Add a separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─────────────────';
        promptType.appendChild(separator);
        
        // Add custom prompts
        customPromptsForType.forEach(([id, prompt]) => {
          const option = document.createElement('option');
          option.value = `custom:${id}`;
          option.textContent = `${prompt.name} (Custom)`;
          promptType.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error updating prompt selector:', error);
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
      
      // Update the dropdown with custom prompts for this content type
      updatePromptSelector(contentType);
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
   * Handle summarize button click - UPDATED to support custom prompts
   */
  async function handleSummarize() {
    try {
      statusMessage.textContent = 'Checking page content...';
      summarizeBtn.disabled = true;
      
      // Get current tab info
      const { type, tabId, url, isSupported } = await checkCurrentContentType();
      
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
      
      // Get the selected prompt type
      const selectedValue = promptType.value;
      
      // Determine if it's a custom prompt and which type
      let promptTypeToUse = type;
      let customPromptId = null;
      
      if (selectedValue.startsWith('custom:')) {
        // It's a custom prompt
        customPromptId = selectedValue.split(':')[1];
      } else {
        // It's a default prompt type
        promptTypeToUse = selectedValue;
      }
      
      // Clear any existing content in storage
      await chrome.storage.local.set({ 
        contentReady: false,
        extractedContent: null,
        claudeTabId: null,
        scriptInjected: false,
        customPromptId // Store the custom prompt ID if selected
      });
      
      // Use the background script to handle the summarization
      statusMessage.textContent = 'Processing content...';
      chrome.runtime.sendMessage({
        action: 'summarizeContent',
        tabId: tabId,
        contentType: type,
        promptType: promptTypeToUse,
        customPromptId: customPromptId,
        url: url
      }, response => {
        if (response && response.success) {
          statusMessage.textContent = 'Opening Claude...';
        } else {
          statusMessage.textContent = `Error: ${response?.error || 'Unknown error'}`;
          summarizeBtn.disabled = false;
        }
      });
      
      // Close popup after a brief delay
      setTimeout(() => window.close(), 2000);
    } catch (error) {
      console.error('Error:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      summarizeBtn.disabled = false;
    }
  }
  
  /**
   * Handle settings button click - Opens settings page
   */
  function handleSettingsClick() {
    chrome.runtime.openOptionsPage();
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
  settingsBtn.addEventListener('click', handleSettingsClick);
  
  // Initialize the popup
  initializePopup();
});