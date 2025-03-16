// src/popup/services/ContentService.js
import { CONTENT_TYPES } from '../../shared/constants.js';
import { determineContentType, getContentScriptFile } from '../../shared/content-utils.js';

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
    
    // Use the shared utility function
    return determineContentType(url, hasSelection);
  }

  /**
   * Get content type based on URL pattern only (without checking for selection)
   * @param {string} url - The URL to check
   * @returns {string} The detected content type
   */
  getUrlContentType(url) {
    // Use the shared utility function with hasSelection = false
    return determineContentType(url, false);
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
    try {
      // Get text selection state for the tab
      const hasSelection = contentType === CONTENT_TYPES.SELECTED_TEXT;
      
      // Get the script file path from shared utility
      const scriptFile = getContentScriptFile(contentType, hasSelection);
      
      const result = await this.tabService.executeScript(tabId, scriptFile);

      // Wait a moment for script to initialize
      if (result) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return result;
    } catch (error) {
      console.error('Error injecting content script:', error);
      return false;
    }
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