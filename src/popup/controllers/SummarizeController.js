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
   * @param {boolean} useApi - Whether to use API mode
   * @param {string} modelId - Selected model ID when API mode is enabled
   * @param {Function} statusCallback - Callback for status updates
   * @returns {Promise<boolean>} - Whether summarization succeeded
   */
  async summarize(tabId, contentType, url, selectedPromptId, selectedPlatformId, hasSelection = false, useApi = false, modelId = null, statusCallback) {
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
        hasSelection,
        commentAnalysisRequired,
        useApi,
        modelId
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
        if (useApi) {
          // Set status for API mode
          statusCallback(`Processing via API... This might take a few moments.`, true);
          
          // For API mode, we need to wait for and handle the response
          const handleApiResponse = async () => {
            // Get API response from storage
            const apiResponse = await this.storageService.get('apiResponse', 'local');
            const apiStatus = await this.storageService.get('apiProcessingStatus', 'local');
            
            if (apiStatus === 'completed') {
              // API processing complete
              statusCallback(`Content processed successfully via API`, false);
              // Handle completed API response - this would open the sidebar
              this.handleApiResponseComplete(apiResponse);
              return true;
            } else if (apiStatus === 'error') {
              // API processing error
              statusCallback(`Error: API processing failed - ${apiResponse?.error || 'Unknown error'}`, false);
              return false;
            } else {
              // Still processing
              setTimeout(handleApiResponse, 1000); // Check again in 1 second
            }
          };
          
          // Start checking for API response
          handleApiResponse();
          return true;
        } else {
          // Regular mode - open AI platform
          statusCallback(`Opening AI platform...`, true);
          
          // Close popup after delay
          setTimeout(() => window.close(), 2000);
          return true;
        }
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

  /**
   * Handle completed API response by activating the sidebar
   * @param {Object} apiResponse - API response data
   */
  async handleApiResponseComplete(apiResponse) {
    try {
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];

      // Create conversation data from API response
      const conversation = [];
      
      // Get the original prompt content
      const { prePrompt } = await this.storageService.get('prePrompt', 'local') || {};
      
      // Get platform info
      const { 
        apiSummarizationPlatform,
        selectedApiModel 
      } = await this.storageService.get([
        'apiSummarizationPlatform',
        'selectedApiModel'
      ], 'local') || {};
      
      // Get the original extracted content
      const { extractedContent } = await this.storageService.get('extractedContent', 'local') || {};
      
      // Add user message (the prompt + content that was sent)
      if (prePrompt && extractedContent) {
        conversation.push({
          role: 'user',
          content: 'Content: [Extracted web content]\n\nInstructions: ' + prePrompt,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add assistant response
      if (apiResponse && apiResponse.success && apiResponse.content) {
        conversation.push({
          role: 'assistant',
          content: apiResponse.content,
          timestamp: new Date().toISOString(),
          model: apiResponse.model
        });
      }
      
      // First inject the sidebar script if needed
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['dist/sidebar-injector.bundle.js']
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Tell the sidebar-injector to show the sidebar with the conversation
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'showSidebar',
        conversationData: conversation,
        platformInfo: {
          platformId: apiSummarizationPlatform || 'unknown',
          platformName: apiSummarizationPlatform ? 
            apiSummarizationPlatform.charAt(0).toUpperCase() + 
            apiSummarizationPlatform.slice(1) : 'AI Platform',
          modelId: selectedApiModel || apiResponse.model || 'unknown'
        }
      });
      
      // Store conversation for later reference
      await this.storageService.set({
        'sidebarConversation': conversation
      }, 'local');
      
      console.log('Sidebar activated with API response');
    } catch (error) {
      console.error('Error activating sidebar:', error);
    }
  }
}