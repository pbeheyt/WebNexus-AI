/**
 * Enhanced Background Script with Improved Claude Integration
 * 
 * This background service worker handles:
 * 1. Extracting content from web pages
 * 2. Opening Claude AI in a new tab
 * 3. Injecting scripts to send the content to Claude
 * 4. Managing context menu integration
 */

// Import modules
const storageManager = require('./utils/storageManager');
const promptManager = require('./utils/promptManager');

// Constants for debugging
const DEBUG = true;

/**
 * Enhanced logging function for background script
 * @param {string} message - The log message
 * @param {any} data - Optional data to log
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  const prefix = `[${timestamp}][Background]`;
  
  if (data !== null) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
  
  // Also save to storage for viewing in the popup later
  try {
    chrome.storage.local.get(['debugLogs'], (result) => {
      const logs = result.debugLogs || [];
      logs.unshift({
        timestamp: new Date().toISOString(),
        context: 'background',
        message,
        data: data ? JSON.stringify(data) : null
      });
      
      // Keep only latest 100 logs
      if (logs.length > 100) logs.length = 100;
      
      chrome.storage.local.set({ debugLogs: logs });
    });
  } catch (e) {
    // Ignore storage errors for logging
  }
}

/**
 * Check if a content script is loaded in a tab
 * @param {number} tabId - The tab ID to check
 * @param {string} action - The action name to send
 * @returns {Promise<boolean>} Whether the content script is loaded
 */
async function isContentScriptLoaded(tabId, action = 'ping') {
  return new Promise((resolve) => {
    try {
      log(`Checking if content script is loaded in tab ${tabId}`);
      chrome.tabs.sendMessage(tabId, { action }, (response) => {
        if (chrome.runtime.lastError) {
          log('Content script not ready:', chrome.runtime.lastError);
          resolve(false);
        } else {
          log('Content script is ready, received:', response);
          resolve(true);
        }
      });
    } catch (error) {
      log('Error checking content script:', error);
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
        log('No applicable content script for URL:', url);
        return false;
      }
      
      log('Injecting content script:', scriptFile);
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify injection
      const verifyLoaded = await isContentScriptLoaded(tabId);
      log(`Content script injection ${verifyLoaded ? 'successful' : 'failed'}`);
      return verifyLoaded;
    }
    
    log('Content script already loaded');
    return true;
  } catch (error) {
    log('Error injecting content script:', error);
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
    log(`Getting prompt for ${contentType}, selected prompt ID: ${selectedPromptId}`);
    
    // Get prompt content
    return await promptManager.getPromptContent(contentType, selectedPromptId);
  } catch (error) {
    log('Error getting prompt for content type:', error);
    
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
    log(`Starting content extraction for tab ${tabId}`);
    
    // Inject content script if needed
    const injected = await injectContentScriptIfNeeded(tabId, url);
    
    if (!injected) {
      log('Failed to inject content script');
      return false;
    }
    
    // Send message to extract content
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    log('Extract content message sent');
    
    // Wait for content to be extracted (with timeout)
    let extractionSuccess = false;
    let retryCount = 0;
    const MAX_RETRIES = 15;
    
    while (!extractionSuccess && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { contentReady } = await chrome.storage.local.get(['contentReady']);
      
      if (contentReady) {
        extractionSuccess = true;
        log('Content extraction successful');
        break;
      }
      
      retryCount++;
      log(`Waiting for content extraction (${retryCount}/${MAX_RETRIES})`);
    }
    
    if (!extractionSuccess) {
      log('Content extraction timed out');
    }
    
    return extractionSuccess;
  } catch (error) {
    log('Error extracting content:', error);
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
    log(`Opening Claude with ${contentType} content`);
    
    // Get prompt for content type
    const promptContent = await getPromptForContentType(contentType);
    
    // Verify we have extracted content
    const { extractedContent } = await chrome.storage.local.get(['extractedContent']);
    if (!extractedContent) {
      throw new Error('No content was extracted');
    }
    
    log('Content and prompt ready, opening Claude', {
      contentType: extractedContent.contentType,
      promptLength: promptContent.length,
      hasExtractedContent: !!extractedContent
    });
    
    // Get Claude URL from config
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    const claudeUrl = config.claudeUrl || 'https://claude.ai/new';
    
    // Save prompt to storage
    await chrome.storage.local.set({ 
      prePrompt: promptContent,
      scriptInjected: false // Reset script injection flag
    });
    
    // Create new tab with Claude
    const newTab = await chrome.tabs.create({ url: claudeUrl });
    log(`Claude tab created with ID ${newTab.id}`);
    
    // Save Claude state in a simple format
    await chrome.storage.local.set({
      claudeTabId: newTab.id,
      scriptInjected: false
    });
    
    // Store entire state for logging/debugging
    await chrome.storage.local.set({
      claudeOpenedAt: new Date().toISOString(),
      openedWithContentType: contentType,
      storedData: {
        hasPrompt: true,
        hasContent: true,
        contentType: extractedContent.contentType
      }
    });
  } catch (error) {
    log('Error opening Claude with content:', error);
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
    log('Context menu clicked:', info.menuItemId);
    
    // Clear any existing content
    await storageManager.clearContent();
    
    // Determine content type
    const contentType = getContentTypeForUrl(tab.url);
    
    // Extract content
    const extracted = await extractContent(tab.id, tab.url);
    
    if (!extracted) {
      log('Failed to extract content');
      return;
    }
    
    // Open Claude with content
    await openClaudeWithContent(contentType);
  } catch (error) {
    log('Error handling context menu click:', error);
  }
}

/**
 * Initialize the extension
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    log('Initializing extension');
    
    // Initialize prompts
    const prompts = await promptManager.loadAllPrompts();
    log('Loaded prompts:', Object.keys(prompts));
    
    // Create context menu items
    chrome.contextMenus.create({
      id: 'summarizeContent',
      title: 'Summarize with Claude',
      contexts: ['page', 'selection']
    });
    
    log('Context menu items created');
    
    // Clear any stale script injection flags
    await chrome.storage.local.set({ scriptInjected: false });
    
    log('Initialization complete');
  } catch (error) {
    log('Error initializing extension:', error);
  }
}

// Tab update listener for Claude integration
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('claude.ai')) {
    try {
      log(`Claude tab ${tabId} updated`);
      
      // Check if this is a Claude tab we need to inject into
      const { claudeTabId, scriptInjected, prePrompt, extractedContent } = 
        await chrome.storage.local.get(['claudeTabId', 'scriptInjected', 'prePrompt', 'extractedContent']);
      
      log('Claude tab check:', {
        currentTabId: tabId,
        expectedTabId: claudeTabId,
        isMatch: tabId === claudeTabId,
        scriptInjected: scriptInjected,
        hasPrompt: !!prePrompt,
        hasContent: !!extractedContent
      });
      
      if (tabId === claudeTabId && !scriptInjected) {
        log(`Tab ${tabId} is a Claude tab ready for script injection`);
        
        // Check storage to make sure we have what we need
        if (!prePrompt || !extractedContent) {
          log('Missing required data for Claude integration', {
            hasPrompt: !!prePrompt,
            hasContent: !!extractedContent
          });
          return;
        }
        
        // Store debug info about what we're injecting
        await chrome.storage.local.set({
          claudeDebugInfo: {
            injectionTime: new Date().toISOString(),
            tabId: tabId,
            url: tab.url,
            contentType: extractedContent.contentType,
            promptLength: prePrompt.length,
            contentLength: JSON.stringify(extractedContent).length
          }
        });
        
        // Inject the Claude content script
        log('Injecting Claude content script');
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['dist/claude-content.bundle.js']
        });
        
        // Update injection flag
        await chrome.storage.local.set({ scriptInjected: true });
        
        log(`Script injected into tab ${tabId}`);
      } else if (scriptInjected) {
        log(`Script already injected into Claude tab ${tabId}`);
      } else if (tabId !== claudeTabId) {
        log(`Tab ${tabId} is not the expected Claude tab (${claudeTabId})`);
      }
    } catch (error) {
      log('Error in tab update listener:', error);
    }
  }
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Extension installation listener
chrome.runtime.onInstalled.addListener(async () => {
  log('Extension installed or updated');
  await initialize();
});

// Debug message listener to support logging from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'logDebug') {
    log(message.message, message.data);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'checkStatus') {
    chrome.storage.local.get(null, (data) => {
      log('Status check requested', { 
        sender: sender.tab ? `Tab ${sender.tab.id}` : 'Popup',
        storageSize: JSON.stringify(data).length
      });
      
      sendResponse({ 
        status: 'ok',
        storageData: data
      });
    });
    return true;
  }
});