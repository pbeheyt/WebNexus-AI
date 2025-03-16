// Update src/popup/controllers/SummarizeController.js
import { STORAGE_KEYS } from '../constants.js';

export default class SummarizeController {
  constructor(contentService, promptService, storageService) {
    this.contentService = contentService;
    this.promptService = promptService;
    this.storageService = storageService;
  }

  /**
   * Perform the content summarization
   * @param {number} tabId - Tab ID
   * @param {string} contentType - Content type
   * @param {string} url - Page URL
   * @param {string} selectedPromptId - Selected prompt ID
   * @param {string} selectedPlatformId - Selected AI platform ID
   * @param {boolean} hasSelection - Whether text is selected
   * @param {Function} statusCallback - Callback for status updates
   * @returns {Promise<boolean>} - Whether summarization succeeded
   */
  async summarize(tabId, contentType, url, selectedPromptId, selectedPlatformId, hasSelection = false, statusCallback) {
    try {
      statusCallback('Checking page content...', true);
      
      // Check if content script is loaded
      let isScriptLoaded = await this.contentService.isContentScriptLoaded(tabId);
      
      // If not loaded, inject it
      if (!isScriptLoaded) {
        statusCallback('Initializing content extraction...', true);
        
        const injected = await this.contentService.injectContentScript(tabId, contentType);
        
        if (!injected) {
          statusCallback('Failed to initialize content extraction', false);
          return false;
        }
        
        // Verify script is now loaded
        isScriptLoaded = await this.contentService.isContentScriptLoaded(tabId);
        
        if (!isScriptLoaded) {
          statusCallback('Content script initialization failed', false);
          return false;
        }
      }
      
      // Get prompt content
      const promptContent = await this.promptService.getPromptContent(selectedPromptId, contentType);
      
      if (!promptContent) {
        statusCallback('Error: Could not load prompt content', false);
        return false;
      }
      
      // Only check comment analysis for YouTube when not using selection
      let commentAnalysisRequired = false;
      if (contentType === 'youtube' && !hasSelection) {
        const preferences = await this.promptService.getPromptPreferences(selectedPromptId, contentType);
        commentAnalysisRequired = preferences.commentAnalysis === true;
      }
      
      // Clear any existing content in storage
      await this.storageService.set({
        [STORAGE_KEYS.CONTENT_READY]: false,
        [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
        [STORAGE_KEYS.AI_PLATFORM_TAB_ID]: null,
        [STORAGE_KEYS.SCRIPT_INJECTED]: false,
        [STORAGE_KEYS.PRE_PROMPT]: promptContent
      }, 'local');
      
      // Send message to background script
      statusCallback(`Processing content with ${selectedPlatformId || 'default platform'}...`, true);
      
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeContent',
        tabId,
        contentType,
        promptId: selectedPromptId,
        platformId: selectedPlatformId,
        url,
        hasSelection, // Pass selection flag
        commentAnalysisRequired
      });
      
      // Check if YouTube transcript error occurred (only if not using selection)
      if (!hasSelection && response && response.youtubeTranscriptError) {
        statusCallback(`Error: ${response.errorMessage || 'No transcript available for this YouTube video.'}`, false);
        return false;
      }
      
      // Check if YouTube comments error occurred (only if not using selection)
      if (!hasSelection && response && response.youtubeCommentsError) {
        statusCallback(`${response.errorMessage || 'Comments exist but are not loaded. Scroll down on YouTube to load comments before summarizing.'}`, false);
        return false;
      }
      
      if (response && response.success) {
        statusCallback(`Opening AI platform...`, true);
        
        // Close popup after delay
        setTimeout(() => window.close(), 2000);
        return true;
      } else {
        statusCallback(`Error: ${response?.error || 'Unknown error'}`, false);
        return false;
      }
    } catch (error) {
      console.error('Summarize error:', error);
      statusCallback(`Error: ${error.message}`, false);
      return false;
    }
  }
}