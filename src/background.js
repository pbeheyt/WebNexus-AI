/**
 * Background Service Worker
 * Handles context menus, tab management, and content script injection
 */

// Constants
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

/**
 * Determine content type based on URL
 */
function getContentTypeForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return CONTENT_TYPES.REDDIT;
  } else {
    return CONTENT_TYPES.GENERAL;
  }
}

/**
 * Inject content script into tab
 */
async function injectContentScript(tabId, scriptFile) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });
    return true;
  } catch (error) {
    console.error('Script injection error:', error);
    return false;
  }
}

/**
 * Extract content from a tab
 */
async function extractContent(tabId, url) {
  const contentType = getContentTypeForUrl(url);
  let scriptFile = 'dist/general-content.bundle.js';
  
  if (contentType === CONTENT_TYPES.YOUTUBE) {
    scriptFile = 'dist/youtube-content.bundle.js';
  } else if (contentType === CONTENT_TYPES.REDDIT) {
    scriptFile = 'dist/reddit-content.bundle.js';
  }
  
  await injectContentScript(tabId, scriptFile);
  chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
  
  return true;
}

/**
 * Load appropriate prompt for content type
 */
async function loadPromptForContentType(contentType) {
  try {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    
    if (config.defaultPrompts && config.defaultPrompts[contentType]) {
      return config.defaultPrompts[contentType].content;
    } else {
      console.warn(`No prompt found for ${contentType}, using general prompt`);
      return config.defaultPrompts.general.content;
    }
  } catch (error) {
    console.error('Error loading prompt:', error);
    return '';
  }
}

/**
 * Open Claude with extracted content
 */
async function openClaudeWithContent(contentType) {
  try {
    // Get prompt for content type
    const prePrompt = await loadPromptForContentType(contentType);
    
    // Open Claude in a new tab
    const claudeUrl = 'https://claude.ai/new';
    const newTab = await chrome.tabs.create({ url: claudeUrl });
    
    // Save tab ID and prompt for later
    await chrome.storage.local.set({
      claudeTabId: newTab.id,
      scriptInjected: false,
      prePrompt
    });
  } catch (error) {
    console.error('Error opening Claude:', error);
  }
}

/**
 * Handle context menu click
 */
async function handleContextMenuClick(info, tab) {
  // Clear any existing content
  await chrome.storage.local.set({ 
    contentReady: false,
    extractedContent: null
  });
  
  // Extract content
  await extractContent(tab.id, tab.url);
  
  // Open Claude
  const contentType = getContentTypeForUrl(tab.url);
  await openClaudeWithContent(contentType);
}

/**
 * Initialize the extension
 */
async function initialize() {
  // Create context menus
  chrome.contextMenus.create({
    id: 'summarizeContent',
    title: 'Summarize with Claude',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: 'Summarize Selection with Claude',
    contexts: ['selection']
  });
  
  // Reset state
  await chrome.storage.local.set({ scriptInjected: false });
}

// Tab update listener for Claude integration
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('claude.ai')) {
    const { claudeTabId, scriptInjected } = 
      await chrome.storage.local.get(['claudeTabId', 'scriptInjected']);
    
    if (tabId === claudeTabId && !scriptInjected) {
      await injectContentScript(tabId, 'dist/claude-content.bundle.js');
      await chrome.storage.local.set({ scriptInjected: true });
    }
  }
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Extension installation listener
chrome.runtime.onInstalled.addListener(async () => {
  await initialize();
});

// Simple message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkStatus') {
    sendResponse({ status: 'ok' });
    return true;
  }
});