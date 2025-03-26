const ApiInterface = require('./api-interface');
const ModelParameterService = require('../services/ModelParameterService');

/**
 * Base class with shared API functionality
 */
class BaseApiService extends ApiInterface {
  constructor(platformId) {
    super();
    this.platformId = platformId;
    this.logger = this._createLogger();
    this.credentials = null;
    this.config = null;
  }

  /**
   * Initialize the API client with credentials
   * @param {Object} credentials - API credentials
   * @returns {Promise<void>}
   */
  async initialize(credentials) {
    this.credentials = credentials;
    this.config = await this._loadPlatformConfig();
    this.logger.info('API service initialized');
  }

  /**
   * Process unified API request with complete configuration
   * @param {Object} requestConfig - Unified request configuration
   * @param {Object} requestConfig.contentData - Extracted content data
   * @param {string} requestConfig.prompt - Formatted prompt
   * @param {string} [requestConfig.model] - Optional model override
   * @param {Array} [requestConfig.conversationHistory=[]] - Optional conversation history
   * @param {boolean} [requestConfig.streaming=false] - Whether to use streaming mode
   * @param {Function} [requestConfig.onChunk=null] - Callback for streaming chunks
   * @param {number} [requestConfig.tabId] - Tab ID for token accounting
   * @returns {Promise<Object>} Standardized response object
   */
  async processRequest(requestConfig) {
    // Normalize and validate the request configuration
    const normalizedConfig = this._normalizeRequestConfig(requestConfig);
    
    // Format content and create structured prompt WITHOUT conversation history
    // Platform-specific implementations will handle conversation history
    const formattedContent = this._formatContent(normalizedConfig.contentData);
    const structuredPrompt = this._createStructuredPrompt(
      normalizedConfig.prompt,
      formattedContent
    );
    
    // Process the request with appropriate mode (streaming or non-streaming)
    if (normalizedConfig.streaming && normalizedConfig.onChunk) {
      return this._processWithApiStreaming(
        structuredPrompt,
        normalizedConfig.onChunk,
        normalizedConfig.conversationHistory,
        normalizedConfig.model,
        normalizedConfig.tabId
      );
    } else {
      this.logger.error('Non-streaming mode is not supported in this platform');
      return {
        success: false,
        error: 'Non-streaming mode is not supported',
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Normalize and validate request configuration
   * @private
   * @param {Object} requestConfig - Raw request configuration
   * @returns {Object} Normalized request configuration
   */
  _normalizeRequestConfig(requestConfig) {
    // Create a normalized configuration with defaults
    const normalizedConfig = {
      contentData: requestConfig.contentData,
      prompt: requestConfig.prompt,
      model: requestConfig.model || null,
      conversationHistory: Array.isArray(requestConfig.conversationHistory) 
        ? requestConfig.conversationHistory 
        : [],
      streaming: !!requestConfig.streaming,
      onChunk: typeof requestConfig.onChunk === 'function' 
        ? requestConfig.onChunk 
        : null,
      tabId: requestConfig.tabId || null
    };
    
    // Validate required fields
    if (!normalizedConfig.contentData) {
      this.logger.warn('No content data provided, using empty object');
      normalizedConfig.contentData = {};
    }
    
    if (!normalizedConfig.prompt) {
      this.logger.warn('No prompt provided, using empty prompt');
      normalizedConfig.prompt = '';
    }
    
    // Streaming requires an onChunk callback
    if (normalizedConfig.streaming && !normalizedConfig.onChunk) {
      this.logger.warn('Streaming requested but no onChunk callback provided, disabling streaming');
      normalizedConfig.streaming = false;
    }
    
    return normalizedConfig;
  }

  /**
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string} formattedContent - The formatted content
   * @returns {string} The full structured prompt
   */
  _createStructuredPrompt(prePrompt, formattedContent) {
    // Create simple format without conversation history
    // Conversation history will be handled by platform-specific formatters
    return `# INSTRUCTIONS
${prePrompt}
# CONTENT
${formattedContent}`;
  }

  // /**
  //  * Format conversation history as text
  //  * @param {Array} history - Conversation history
  //  * @returns {string} Formatted history text
  //  */
  // _formatConversationHistory(history) {
  //   // Default format - should be overridden in platform-specific classes if needed
  //   return history.map(msg => {
  //     const roleLabel = msg.role.toUpperCase();
  //     return `${roleLabel}: ${msg.content}`;
  //   }).join('\n\n');
  // }

  // /**
  //  * Estimate tokens for conversation history
  //  * @param {Array} history - Conversation history array
  //  * @returns {number} - Estimated token count
  //  */
  // estimateConversationHistoryTokens(history) {
  //   if (!history || !Array.isArray(history) || history.length === 0) {
  //     return 0;
  //   }
    
  //   // Simple character-based estimation
  //   // Note: This is a simplified approach - token tracking is now handled by the sidebar component
  //   const formattedHistory = this._formatConversationHistory(history);
  //   return Math.ceil(formattedHistory.length / 4);
  // }

  /**
     * Format content based on content type
     * @param {Object} data - The extracted content data
     * @returns {string} Formatted content
     */
  _formatContent(data) {
    if (!data) {
      this.logger.error('No content data available for formatting');
      return 'No content data available';
    }

    const contentType = data.contentType;

    let formatted = '';
    switch (contentType) {
      case 'youtube':
        formatted = this._formatYouTubeData(data);
        break;
      case 'reddit':
        formatted = this._formatRedditData(data);
        break;
      case 'general':
        formatted = this._formatGeneralData(data);
        break;
      case 'pdf':
        formatted = this._formatPdfData(data);
        break;
      case 'selected_text':
        formatted = this._formatSelectedTextData(data);
        break;
      default:
        formatted = `Content: ${JSON.stringify(data)}`;
    }

    return formatted;
  }

  /**
   * Format YouTube video data
   * @param {Object} data - YouTube video data
   * @returns {string} Formatted YouTube data
   */
  _formatYouTubeData(data) {
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';

    // Format comments with likes
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = `## COMMENTS
  `;
      data.comments.forEach((comment, index) => {
        commentsText += `${index + 1}. User: ${comment.author || 'Anonymous'} (${comment.likes || '0'} likes)
  "${comment.text || ''}"
  `;
      });
    }

    return `## VIDEO METADATA
  - Title: ${title}
  - Channel: ${channel}
  - URL: https://www.youtube.com/watch?v=${data.videoId || ''}
  ## DESCRIPTION
  ${description}
  ## TRANSCRIPT
  ${transcript}
  ${commentsText}`;
  }

  /**
   * Format Reddit post data
   * @param {Object} data - Reddit post data
   * @returns {string} Formatted Reddit data
   */
  _formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    const postUrl = data.postUrl || '';
    const subreddit = data.subreddit || 'Unknown subreddit';

    let formattedText = `## POST METADATA
  - Title: ${title}
  - Author: ${author}
  - Subreddit: ${subreddit}
  - URL: ${postUrl}
  ## POST CONTENT
  ${content}
  `;

    // Format comments with links
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formattedText += `## COMMENTS
  `;

      data.comments.forEach((comment, index) => {
        formattedText += `${index + 1}. u/${comment.author || 'Anonymous'} (${comment.popularity || '0'} points) [(link)](${comment.permalink || postUrl})
  "${comment.content || ''}"
  `;
      });
    }

    return formattedText;
  }

  /**
   * Format general web page data
   * @param {Object} data - Web page data
   * @returns {string} Formatted web page data
   */
  _formatGeneralData(data) {
    const title = data.pageTitle || 'No title available';
    const url = data.pageUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const author = data.pageAuthor || null;
    const description = data.pageDescription || null;

    let metadataText = `## PAGE METADATA
  - Title: ${title}
  - URL: ${url}`;

    if (author) {
      metadataText += `
  - Author: ${author}`;
    }

    if (description) {
      metadataText += `
  - Description: ${description}`;
    }

    if (data.isSelection) {
      metadataText += `
  - Note: This is a user-selected portion of the page content.`;
    }

    return `${metadataText}
  ## PAGE CONTENT
  ${content}`;
  }

  /**
   * Format PDF document data
   * @param {Object} data - PDF document data
   * @returns {string} Formatted PDF data
   */
  _formatPdfData(data) {
    const title = data.pdfTitle || 'Untitled PDF';
    const url = data.pdfUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const pageCount = data.pageCount || 'Unknown';
    const metadata = data.metadata || {};

    // Format metadata section
    let metadataText = `## PDF METADATA
  - Title: ${title}
  - Pages: ${pageCount}
  - URL: ${url}`;

    if (metadata.author) {
      metadataText += `
  - Author: ${metadata.author}`;
    }

    if (metadata.creationDate) {
      metadataText += `
  - Created: ${metadata.creationDate}`;
    }

    if (data.ocrRequired) {
      metadataText += `
  - Note: This PDF may require OCR as text extraction was limited.`;
    }

    // Format and clean up the content
    let formattedContent = content;

    // Remove JSON artifacts if present
    if (formattedContent.includes('{"content":"')) {
      try {
        const contentObj = JSON.parse(formattedContent);
        formattedContent = contentObj.content || formattedContent;
      } catch (e) {
        // If parsing fails, keep the original content
        this.logger.warn('Failed to parse JSON in PDF content');
      }
    }

    // Clean up page markers to make them more readable
    formattedContent = formattedContent
      .replace(/--- Page \d+ ---\n\n/g, '\n\n## PAGE $&\n')
      .replace(/\n{3,}/g, '\n\n')  // Reduce multiple line breaks
      .trim();

    return `${metadataText}

  ## PDF CONTENT
  ${formattedContent}`;
  }

  /**
   * Format selected text data with emphasis on content
   * @param {Object} data - Selected text data
   * @returns {string} Formatted selected text data
   */
  _formatSelectedTextData(data) {
    // Just return the raw selected text with no headings or extra formatting
    return data.text || 'No text selected';
  }

  /**
   * Process text with the API using streaming
   * @private
   * @param {string} text - Prompt text
   * @param {function} onChunk - Callback function for receiving text chunks
   * @param {Array} conversationHistory - Conversation history
   * @param {string} [modelOverride] - Optional model override
   * @param {number} [tabId] - Optional tab ID for token accounting
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithApiStreaming(text, onChunk, conversationHistory = [], modelOverride = null, tabId = null) {
    const { apiKey } = this.credentials;

    try {
      // Get model and parameters from centralized ModelParameterService
      const params = await ModelParameterService.resolveParameters(
        this.platformId,
        modelOverride
      );

      // Log parameters being used
      this.logger.info(`Using model ${params.model} for streaming with parameters:`, {
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        parameterStyle: params.parameterStyle
      });

      // Add conversation history to parameters
      params.conversationHistory = conversationHistory;
      
      // Generate unique message ID for reference
      const messageId = `msg_${Date.now()}`;
      
      // Add message ID to params for callbacks
      params.messageId = messageId;
      params.tabId = tabId;

      // Each implementation must handle the streaming appropriately
      return this._processWithModelStreaming(text, params.model, apiKey, params, onChunk);
    } catch (error) {
      this.logger.error('Error in _processWithApiStreaming:', error);
      throw error;
    }
  }

  /**
   * Lightweight validation method that doesn't use the full conversation processing pipeline
   * @returns {Promise<boolean>} Whether credentials are valid
   */
  async validateCredentials() {
    try {
      const { apiKey } = this.credentials;
      if (!apiKey) {
        this.logger.warn('No API key provided for validation');
        return false;
      }
      
      // Platform-specific validation should be implemented in subclasses
      // This lightweight validation doesn't use the full content processing pipeline
      const isValid = await this._validateApiKey(apiKey);
      return isValid;
    } catch (error) {
      this.logger.error('Error validating credentials:', error);
      return false;
    }
  }
  
  /**
   * Validate an API key with a minimal request
   * This method should be implemented by subclasses
   * @protected
   * @param {string} apiKey - The API key to validate
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateApiKey(apiKey) {
    try {
      // Get the default model from config
      if (!this.config) {
        this.config = await this._loadPlatformConfig();
      }
      
      // Get default model from platform config
      const defaultModel = this.config?.defaultModel;
      if (!defaultModel) {
        this.logger.warn('No default model found in configuration');
        return false;
      }
      
      // Each platform must implement its own validation logic
      return await this._validateWithModel(apiKey, defaultModel);
    } catch (error) {
      this.logger.error('Error validating API key:', error);
      return false;
    }
  }
  
  /**
   * Platform-specific validation implementation
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    throw new Error('_validateWithModel must be implemented by subclasses');
  }

  /**
   * Process with model-specific parameters with streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters with conversation history
   * @param {function} onChunk - Callback function for receiving text chunks
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    throw new Error('_processWithModelStreaming must be implemented by subclasses');
  }

  /**
   * Create a logger instance
   * @returns {Object} Logger object
   */
  _createLogger() {
    return {
      info: (message, data = null) => console.log(`[${this.platformId}-api] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[${this.platformId}-api] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[${this.platformId}-api] ERROR: ${message}`, data || '')
    };
  }

  /**
   * Load platform API configuration
   * @returns {Promise<Object>} Platform API configuration
   */
  async _loadPlatformConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      return config.aiPlatforms[this.platformId].api;
    } catch (error) {
      this.logger.error('Error loading platform config:', error);
      return null;
    }
  }
}

module.exports = BaseApiService;