/**
 * Background Script
 * 
 * Handles all background operations for the extension.
 * Manages context menus, tab management, and content script injection.
 */

// Import modules
const storageManager = require('./utils/storageManager');
const promptManager = require('./utils/promptManager');

/**
 * Check if a content script is loaded in a tab
 * @param {number} tabId - The tab ID to check
 * @param {string} action - The action name to send
 * @returns {Promise<boolean>} Whether the content script is loaded
 */
async function isContentScriptLoaded(tabId, action = 'ping') {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { action }, (response) => {
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
 * Determine content script file based on URL
 * @param {string} url - The URL to check
 * @returns {string|null} The content script file to inject or null if not applicable
 */
function getContentScriptForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return 'dist/youtube-content.bundle.js';
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return 'dist/reddit-content.bundle.js';
  } else if (url.startsWith('http')) {
    return 'dist/general-content.bundle.js';
  }
  return null;
}

/**
 * Determine content type based on URL
 * @param {string} url - The URL to check
 * @returns {string} The content type (youtube, reddit, general)
 */
function getContentTypeForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return storageManager.CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return storageManager.CONTENT_TYPES.REDDIT;
  } else {
    return storageManager.CONTENT_TYPES.GENERAL;
  }
}

/**
 * Inject content script into tab if needed
 * @param {number} tabId - The tab ID to inject into
 * @param {string} url - The URL of the tab
 * @returns {Promise<boolean>} Whether the injection was successful
 */
async function injectContentScriptIfNeeded(tabId, url) {
  try {
    // Check if content script is already loaded
    const isLoaded = await isContentScriptLoaded(tabId);
    
    if (!isLoaded) {
      // Determine which content script to inject
      const scriptFile = getContentScriptForUrl(url);
      
      if (!scriptFile) {
        console.log('No applicable content script for URL:', url);
        return false;
      }
      
      console.log('Injecting content script:', scriptFile);
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify injection
      const verifyLoaded = await isContentScriptLoaded(tabId);
      return verifyLoaded;
    }
    
    return true;
  } catch (error) {
    console.error('Error injecting content script:', error);
    return false;
  }
}

/**
 * Get prompt content for a content type
 * @param {string} contentType - The content type
 * @returns {Promise<string>} The prompt content
 */
async function getPromptForContentType(contentType) {
  try {
    // Get selected prompt ID for this content type
    const selectedPromptId = await storageManager.getSelectedPrompt(contentType);
    
    // Get prompt content
    return await promptManager.getPromptContent(contentType, selectedPromptId);
  } catch (error) {
    console.error('Error getting prompt for content type:', error);
    
    // Fallback to default prompt from config
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    return config.defaultPrompts[contentType]?.content || '';
  }
}

/**
 * Extract content from a tab
 * @param {number} tabId - The tab ID to extract from
 * @param {string} url - The URL of the tab
 * @returns {Promise<boolean>} Whether the extraction was successful
 */
async function extractContent(tabId, url) {
  try {
    // Inject content script if needed
    const injected = await injectContentScriptIfNeeded(tabId, url);
    
    if (!injected) {
      console.error('Failed to inject content script');
      return false;
    }
    
    // Send message to extract content
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    
    // Wait for content to be extracted (with timeout)
    let extractionSuccess = false;
    let retryCount = 0;
    const MAX_RETRIES = 15;
    
    while (!extractionSuccess && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { contentReady } = await chrome.storage.local.get(['contentReady']);
      
      if (contentReady) {
        extractionSuccess = true;
        break;
      }
      
      retryCount++;
    }
    
    return extractionSuccess;
  } catch (error) {
    console.error('Error extracting content:', error);
    return false;
  }
}

/**
 * Open Claude with extracted content
 * @param {string} contentType - The content type
 * @returns {Promise<void>}
 */
async function openClaudeWithContent(contentType) {
  try {
    // Get prompt for content type
    const promptContent = await getPromptForContentType(contentType);
    
    // Get Claude URL from config
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    const claudeUrl = config.claudeUrl;
    
    // Save prompt to storage
    await chrome.storage.local.set({ prePrompt: promptContent });
    
    // Create new tab with Claude
    const newTab = await chrome.tabs.create({ url: claudeUrl });
    
    // Save Claude state
    await storageManager.saveClaudeState({
      tabId: newTab.id,
      scriptInjected: false
    });
  } catch (error) {
    console.error('Error opening Claude with content:', error);
  }
}

/**
 * Handle context menu click
 * @param {Object} info - Context menu info
 * @param {Object} tab - The tab where the click occurred
 * @returns {Promise<void>}
 */
async function handleContextMenuClick(info, tab) {
  try {
    console.log('Context menu clicked:', info.menuItemId);
    
    // Clear any existing content
    await storageManager.clearContent();
    
    // Determine content type
    const contentType = getContentTypeForUrl(tab.url);
    
    // Extract content
    const extracted = await extractContent(tab.id, tab.url);
    
    if (!extracted) {
      console.error('Failed to extract content');
      return;
    }
    
    // Open Claude with content
    await openClaudeWithContent(contentType);
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
}

/**
 * Initialize the extension
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    // Initialize prompts
    const prompts = await promptManager.loadAllPrompts();
    console.log('Loaded prompts:', Object.keys(prompts));
    
    // Create context menu items
    chrome.contextMenus.create({
      id: 'summarizeContent',
      title: 'Summarize with Claude',
      contexts: ['page', 'selection']
    });
    
    console.log('Context menu items created');
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Tab update listener for Claude integration
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Check if this is a Claude tab we need to inject into
      const claudeState = await storageManager.getClaudeState();
      
      if (claudeState && 
          tabId === claudeState.tabId && 
          !claudeState.scriptInjected && 
          tab.url.includes('claude.ai')) {
        
        console.log('Injecting Claude content script');
        
        // Inject the Claude content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['dist/claude-content.bundle.js']
        });
        
        // Update Claude state
        await storageManager.saveClaudeState({
          ...claudeState,
          scriptInjected: true
        });
      }
    } catch (error) {
      console.error('Error in tab update listener:', error);
    }
  }
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Extension installation listener
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  await initialize();
});