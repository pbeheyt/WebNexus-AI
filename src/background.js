// src/background.js (complete file)
/**
 * Background Service Worker
 * Handles context menus, tab management, and content script injection
 */

// Import logger utility
const logger = require('./utils/logger');

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
    logger.background.info(`Injecting script: ${scriptFile} into tab: ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });
    logger.background.info(`Successfully injected script: ${scriptFile} into tab: ${tabId}`);
    return true;
  } catch (error) {
    logger.background.error(`Script injection error for tab ${tabId}:`, error);
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
  
  logger.background.info(`Extracting content from tab ${tabId}, content type: ${contentType}`);
  await injectContentScript(tabId, scriptFile);
  chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
  logger.background.info(`Content extraction message sent to tab ${tabId}`);
  
  return true;
}

/**
 * Load appropriate prompt for content type
 */
async function loadPromptForContentType(contentType) {
  try {
    logger.background.info(`Loading prompt for content type: ${contentType}`);
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    
    if (config.defaultPrompts && config.defaultPrompts[contentType]) {
      logger.background.info(`Prompt found for ${contentType}`);
      return config.defaultPrompts[contentType].content;
    } else {
      logger.background.warn(`No prompt found for ${contentType}, using general prompt`);
      return config.defaultPrompts.general.content;
    }
  } catch (error) {
    logger.background.error('Error loading prompt:', error);
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
    logger.background.info(`Opening Claude at URL: ${claudeUrl}`);
    const newTab = await chrome.tabs.create({ url: claudeUrl });
    
    if (!newTab || !newTab.id) {
      throw new Error('Failed to create Claude tab or get tab ID');
    }
    
    logger.background.info(`Claude tab created with ID: ${newTab.id}`);
    
    // Save tab ID and prompt for later
    await chrome.storage.local.set({
      claudeTabId: newTab.id,
      scriptInjected: false,
      prePrompt
    });
    
    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get(['claudeTabId', 'scriptInjected']);
    logger.background.info(`Storage verification: claudeTabId=${verifyData.claudeTabId}, scriptInjected=${verifyData.scriptInjected}`);
    
    return newTab.id;
  } catch (error) {
    logger.background.error('Error opening Claude:', error);
    return null;
  }
}

/**
 * Handle context menu click
 */
async function handleContextMenuClick(info, tab) {
  logger.background.info('Context menu clicked', { info, tabId: tab.id });
  
  // Clear any existing content
  await chrome.storage.local.set({ 
    contentReady: false,
    extractedContent: null,
    claudeTabId: null,  // Clear previous Claude tab ID
    scriptInjected: false
  });
  logger.background.info('Cleared previous extracted content and tab state');
  
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
  logger.background.info('Initializing background service worker');
  
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
  logger.background.info('Context menus created');
  
  // Reset state
  await chrome.storage.local.set({ 
    scriptInjected: false,
    claudeTabId: null  // Ensure Claude tab ID is reset on initialization
  });
  logger.background.info('Initial state reset complete');
}

// Tab update listener for Claude integration
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('claude.ai')) {
    logger.background.info(`Claude tab detected and loaded: ${tabId}`, { 
      url: tab.url, 
      changeInfo 
    });
    
    try {
      const storageData = await chrome.storage.local.get(['claudeTabId', 'scriptInjected']);
      const { claudeTabId, scriptInjected } = storageData;
      
      logger.background.info('Claude tab check', { 
        detectedTabId: tabId,
        expectedClaudeTabId: claudeTabId,
        scriptAlreadyInjected: scriptInjected
      });
      
      // If claudeTabId is undefined but this is claude.ai, we might want to handle it anyway
      if (tabId === claudeTabId && !scriptInjected) {
        logger.background.info(`Injecting Claude content script into tab: ${tabId}`);
        await injectContentScript(tabId, 'dist/claude-content.bundle.js');
        
        logger.background.info(`Setting scriptInjected flag to true for tab: ${tabId}`);
        await chrome.storage.local.set({ scriptInjected: true });
        
        // Let's also retrieve the extracted content to verify it's available
        const { extractedContent } = await chrome.storage.local.get('extractedContent');
        logger.background.info('Content available for Claude:', { 
          hasContent: !!extractedContent,
          contentType: extractedContent?.contentType
        });
      } else if (tabId === claudeTabId && scriptInjected) {
        logger.background.info(`Claude script already injected for tab: ${tabId}`);
      } else if (tab.url.includes('claude.ai')) {
        // This is a Claude tab but not our expected tab or claudeTabId is undefined
        // Let's check if we have content ready but no tab ID set
        const { contentReady, extractedContent } = await chrome.storage.local.get(['contentReady', 'extractedContent']);
        
        if (contentReady && extractedContent && !claudeTabId) {
          logger.background.info(`Found content ready but no Claude tab ID. Adopting this tab: ${tabId}`);
          
          // Adopt this tab as our Claude tab
          await chrome.storage.local.set({ claudeTabId: tabId });
          
          // Inject the script since this is now our Claude tab
          logger.background.info(`Injecting Claude content script into adopted tab: ${tabId}`);
          await injectContentScript(tabId, 'dist/claude-content.bundle.js');
          await chrome.storage.local.set({ scriptInjected: true });
        } else {
          logger.background.info(`Tab is Claude but not our expected Claude tab ID and no content ready. Current: ${tabId}, Expected: ${claudeTabId}`);
        }
      }
    } catch (error) {
      logger.background.error(`Error handling Claude tab update for tab ${tabId}:`, error);
    }
  }
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Extension installation listener
chrome.runtime.onInstalled.addListener(async () => {
  logger.background.info('Extension installed/updated');
  await initialize();
});

// Message listener for handling requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.background.info('Message received in background', { 
    message, 
    sender: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
  });
  
  if (message.action === 'checkStatus') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  // New handler for summarize requests from popup
  if (message.action === 'summarizeContent') {
    (async () => {
      try {
        const { tabId, contentType } = message;
        logger.background.info(`Summarize content request from popup for tab ${tabId}, type: ${contentType}`);
        
        // Extract content first
        await extractContent(tabId, message.url);
        
        // Give time for content extraction to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Then open Claude with the content
        const claudeTabId = await openClaudeWithContent(contentType);
        
        sendResponse({ 
          success: true, 
          claudeTabId
        });
      } catch (error) {
        logger.background.error('Error handling summarize content request:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    })();
    return true; // Keep channel open for async response
  }
});

// Debug logging for extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
  logger.background.info('Background service worker suspending');
});