// popup/services/ContentService.js
import { CONTENT_TYPES } from '../constants.js';

export default class ContentService {
  constructor(tabService) {
    this.tabService = tabService;
  }

  /**
   * Detect content type based on URL and selection
   * @param {string} url - The URL to check
   * @returns {Promise<string>} The detected content type
   */
  async detectContentType(url) {
    // Check for text selection in the active tab first
    const hasSelection = await this.checkForTextSelection();
    
    if (hasSelection) {
      return CONTENT_TYPES.SELECTED_TEXT;
    }
    
    // Use the URL-based detection
    return this.getUrlContentType(url);
  }

  /**
   * Get content type based on URL pattern only
   * @param {string} url - The URL to check
   * @returns {string} The detected content type
   */
  getUrlContentType(url) {
    if (url.endsWith('.pdf') || 
        url.includes('/pdf/') || 
        url.includes('pdfviewer') || 
        (url.includes('chrome-extension://') && url.includes('pdfviewer'))) {
      return CONTENT_TYPES.PDF;
    } else if (url.includes('youtube.com/watch')) {
      return CONTENT_TYPES.YOUTUBE;
    } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
      return CONTENT_TYPES.REDDIT;
    } else {
      return CONTENT_TYPES.GENERAL;
    }
  }

  /**
   * Check if there's any text selected in the current tab
   * @returns {Promise<boolean>} Whether text is selected
   */
  async checkForTextSelection() {
    const tab = await this.tabService.getCurrentTab();
    if (!tab || !tab.id) return false;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          return selection && selection.toString().trim().length > 0;
        }
      });
      return results?.[0]?.result || false;
    } catch (error) {
      console.error('Error checking for text selection:', error);
      return false;
    }
  }

  /**
   * Inject content script based on content type
   * @param {number} tabId - The tab ID
   * @param {string} contentType - The content type
   * @returns {Promise<boolean>} Whether injection succeeded
   */
  async injectContentScript(tabId, contentType) {
    // Map content types to script files
    const scriptMapping = {
      [CONTENT_TYPES.SELECTED_TEXT]: 'dist/selected-text-content.bundle.js',
      [CONTENT_TYPES.YOUTUBE]: 'dist/youtube-content.bundle.js',
      [CONTENT_TYPES.REDDIT]: 'dist/reddit-content.bundle.js',
      [CONTENT_TYPES.PDF]: 'dist/pdf-content.bundle.js',
      [CONTENT_TYPES.GENERAL]: 'dist/general-content.bundle.js'
    };

    // Get the appropriate script file
    const scriptFile = scriptMapping[contentType] || scriptMapping[CONTENT_TYPES.GENERAL];
    
    const result = await this.tabService.executeScript(tabId, scriptFile);

    // Wait a moment for script to initialize
    if (result) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return result;
  }

  /**
   * Check if content script is loaded in the tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<boolean>} Whether content script is loaded
   */
  async isContentScriptLoaded(tabId) {
    const response = await this.tabService.sendMessage(tabId, { action: 'ping' });
    return !!(response && !response.error);
  }
}