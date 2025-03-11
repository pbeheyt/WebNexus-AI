// src/popup.js
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
  
  // Storage constants
  const STORAGE_KEY = 'custom_prompts_by_type';
  
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
   * Load custom prompts by type
   */
  async function loadCustomPromptsByType() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading custom prompts:', chrome.runtime.lastError);
          resolve({});
        } else if (result && result[STORAGE_KEY]) {
          resolve(result[STORAGE_KEY]);
        } else {
          resolve({});
        }
      });
    });
  }
  
  /**
   * Get preferred prompt ID for a content type
   */
  async function getPreferredPromptId(contentType) {
    const customPromptsByType = await loadCustomPromptsByType();
    
    // If we have custom prompts for this type with a preferred prompt set
    if (customPromptsByType[contentType] && customPromptsByType[contentType].preferredPromptId) {
      return customPromptsByType[contentType].preferredPromptId;
    }
    
    // Default to the default prompt ID (same as the content type)
    return contentType;
  }
  
  /**
   * Update the prompt selector dropdown with prompts for the current content type
   */
  async function updatePromptSelector(contentType) {
    try {
      // Get custom prompts by type
      const customPromptsByType = await loadCustomPromptsByType();
      const preferredPromptId = await getPreferredPromptId(contentType);
      
      // Clear existing options
      promptType.innerHTML = '';
      
      // Add default prompt option
      const defaultOption = document.createElement('option');
      defaultOption.value = contentType; // Default prompt has same ID as content type
      defaultOption.textContent = contentType === CONTENT_TYPES.GENERAL 
                               ? 'Web Content Summary (Default)' 
                               : contentType === CONTENT_TYPES.REDDIT 
                               ? 'Reddit Post Analysis (Default)' 
                               : 'YouTube Video Summary (Default)';
      promptType.appendChild(defaultOption);
      
      // Add custom prompts for this content type if any
      if (customPromptsByType[contentType] && customPromptsByType[contentType].prompts) {
        const customPrompts = customPromptsByType[contentType].prompts;
        
        if (Object.keys(customPrompts).length > 0) {
          // Add a separator
          const separator = document.createElement('option');
          separator.disabled = true;
          separator.textContent = '─────────────────';
          promptType.appendChild(separator);
          
          // Add custom prompts
          Object.entries(customPrompts).forEach(([id, prompt]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = prompt.name;
            promptType.appendChild(option);
          });
        }
      }
      
      // Set the selected option to the preferred prompt
      promptType.value = preferredPromptId;
      
    } catch (error) {
      console.error('Error updating prompt selector:', error);
    }
  }
  
  /**
   * Display the current content type in the UI
   */
  async function updateContentTypeDisplay(contentType) {
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
    
    // Update the dropdown with prompts for this content type
    // and select the preferred one
    await updatePromptSelector(contentType);
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
   * Get prompt content by ID
   */
  async function getPromptContentById(promptId, contentType) {
    // If the promptId is the same as contentType, it's a default prompt
    if (promptId === contentType) {
      try {
        const response = await fetch(chrome.runtime.getURL('config.json'));
        const config = await response.json();
        
        if (config.defaultPrompts && config.defaultPrompts[contentType]) {
          return config.defaultPrompts[contentType].content;
        }
      } catch (error) {
        console.error('Error loading default prompt:', error);
        return null;
      }
    }
    
    // Otherwise, it's a custom prompt
    const customPromptsByType = await loadCustomPromptsByType();
    
    if (customPromptsByType[contentType] && 
        customPromptsByType[contentType].prompts && 
        customPromptsByType[contentType].prompts[promptId]) {
      return customPromptsByType[contentType].prompts[promptId].content;
    }
    
    return null;
  }
  
  /**
   * Handle summarize button click
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
      
      // Get the selected prompt ID
      const selectedPromptId = promptType.value;
      
      // Get the actual prompt content
      const promptContent = await getPromptContentById(selectedPromptId, type);
      
      if (!promptContent) {
        statusMessage.textContent = 'Error: Could not load prompt content';
        summarizeBtn.disabled = false;
        return;
      }
      
      // Clear any existing content in storage
      await chrome.storage.local.set({ 
        contentReady: false,
        extractedContent: null,
        claudeTabId: null,
        scriptInjected: false,
        promptContent: promptContent
      });
      
      // Extract content and open Claude
      statusMessage.textContent = 'Processing content...';
      
      chrome.runtime.sendMessage({
        action: 'summarizeContent',
        tabId: tabId,
        contentType: type,
        promptId: selectedPromptId,
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
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
      // Fallback to direct navigation
      chrome.tabs.create({
        url: chrome.runtime.getURL('settings.html')
      });
    }
  }
  
  // Initialize popup
  async function initializePopup() {
    try {
      // Check current content type
      const { type, isSupported } = await checkCurrentContentType();
      
      // Update UI to show content type and prompt selector
      await updateContentTypeDisplay(type);
      
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