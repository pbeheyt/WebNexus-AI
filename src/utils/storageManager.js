/**
 * Storage Manager Module
 * 
 * Handles interactions with Chrome storage for content data.
 * Provides a consistent API for saving and retrieving extracted content.
 */

// Content type constants
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

/**
 * Save extracted content to Chrome storage
 * @param {string} contentType - The type of content (general, reddit, youtube)
 * @param {Object} data - The extracted content data
 * @returns {Promise<void>}
 */
async function saveContent(contentType, data) {
  try {
    // Clear any existing content first
    await clearContent();
    
    // Add content type and timestamp
    const enrichedData = {
      ...data,
      contentType,
      extractedAt: new Date().toISOString()
    };
    
    // Save to storage
    await chrome.storage.local.set({ 
      extractedContent: enrichedData,
      contentReady: true
    });
    
    console.log(`Saved ${contentType} content to storage:`, enrichedData);
  } catch (error) {
    console.error(`Error saving ${contentType} content:`, error);
    throw error;
  }
}

/**
 * Get extracted content from Chrome storage
 * @returns {Promise<Object|null>} The extracted content or null if not found
 */
async function getContent() {
  try {
    const { extractedContent, contentReady } = await chrome.storage.local.get([
      'extractedContent', 
      'contentReady'
    ]);
    
    if (!contentReady || !extractedContent) {
      return null;
    }
    
    return extractedContent;
  } catch (error) {
    console.error('Error getting content from storage:', error);
    return null;
  }
}

/**
 * Clear extracted content from Chrome storage
 * @returns {Promise<void>}
 */
async function clearContent() {
  try {
    await chrome.storage.local.remove(['extractedContent', 'contentReady']);
    console.log('Content cleared from storage');
  } catch (error) {
    console.error('Error clearing content from storage:', error);
    throw error;
  }
}

/**
 * Save Claude integration state
 * @param {Object} state - The Claude integration state
 * @returns {Promise<void>}
 */
async function saveClaudeState(state) {
  try {
    // Store the tabId and scriptInjected directly as flat keys
    // instead of nested in a claudeState object
    await chrome.storage.local.set({ 
      claudeTabId: state.tabId,
      scriptInjected: state.scriptInjected || false
    });
    console.log('Claude state saved with direct keys:', state);
  } catch (error) {
    console.error('Error saving Claude state:', error);
    throw error;
  }
}

/**
 * Get Claude integration state
 * @returns {Promise<Object|null>} The Claude integration state or null if not found
 */
async function getClaudeState() {
  try {
    const { claudeTabId, scriptInjected } = await chrome.storage.local.get([
      'claudeTabId',
      'scriptInjected'
    ]);
    
    if (claudeTabId === undefined) {
      return null;
    }
    
    return {
      tabId: claudeTabId,
      scriptInjected: scriptInjected || false
    };
  } catch (error) {
    console.error('Error getting Claude state:', error);
    return null;
  }
}

/**
 * Clear Claude integration state
 * @returns {Promise<void>}
 */
async function clearClaudeState() {
  try {
    await chrome.storage.local.remove(['claudeTabId', 'scriptInjected']);
    console.log('Claude state cleared from storage');
  } catch (error) {
    console.error('Error clearing Claude state:', error);
    throw error;
  }
}

/**
 * Save selected prompt type for a content type
 * @param {string} contentType - The type of content (general, reddit, youtube)
 * @param {string} promptId - The selected prompt ID
 * @returns {Promise<void>}
 */
async function saveSelectedPrompt(contentType, promptId) {
  try {
    const key = `selectedPrompt_${contentType}`;
    await chrome.storage.local.set({ [key]: promptId });
  } catch (error) {
    console.error(`Error saving selected prompt for ${contentType}:`, error);
    throw error;
  }
}

/**
 * Get selected prompt type for a content type
 * @param {string} contentType - The type of content (general, reddit, youtube)
 * @returns {Promise<string|null>} The selected prompt ID or null if not found
 */
async function getSelectedPrompt(contentType) {
  try {
    const key = `selectedPrompt_${contentType}`;
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  } catch (error) {
    console.error(`Error getting selected prompt for ${contentType}:`, error);
    return null;
  }
}

// Export public API
module.exports = {
  CONTENT_TYPES,
  saveContent,
  getContent,
  clearContent,
  saveClaudeState,
  getClaudeState,
  clearClaudeState,
  saveSelectedPrompt,
  getSelectedPrompt
};