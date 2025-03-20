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
   * Process content through the API service
   * @param {Object} contentData - Extracted content data
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<Object>} Standardized response object
   */
  async process(contentData, prompt) {
    // Format content using same logic as platform-base.js
    const formattedContent = this._formatContent(contentData);

    // Create structured prompt using same logic as platform-base.js
    const structuredPrompt = this._createStructuredPrompt(prompt, formattedContent);

    // Process via API
    return this._processWithApi(structuredPrompt);
  }

  /**
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string} formattedContent - The formatted content
   * @returns {string} The full structured prompt
   */
  _createStructuredPrompt(prePrompt, formattedContent) {
    return `# INSTRUCTIONS
${prePrompt}
# CONTENT
${formattedContent}`;
  }

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
   * Process text with the API using centralized model selection
   * @param {string} text - Prompt text to process
   * @returns {Promise<Object>} API response
   */
  async _processWithApi(text) {
    const { apiKey } = this.credentials;

    try {
      // Get model and parameters from centralized ModelParameterService
      const params = await ModelParameterService.resolveParameters(
        this.platformId,
        text
      );

      // Extract model from the resolved parameters
      const modelToUse = params.model;

      // Log parameters being used
      this.logger.info(`Using model ${modelToUse} with parameters:`, {
        effectiveMaxTokens: params.effectiveMaxTokens,
        temperature: params.temperature,
        parameterStyle: params.parameterStyle
      });

      // Each implementation must handle the resolved parameters appropriately
      return this._processWithModel(text, modelToUse, apiKey, params);
    } catch (error) {
      this.logger.error('Error in _processWithApi:', error);
      throw error;
    }
  }

  /**
   * Process text with the API using centralized model selection with streaming support
   * @param {string} text - Prompt text to process
   * @param {function} onChunk - Callback function for receiving text chunks
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithApiStreaming(text, onChunk) {
    const { apiKey } = this.credentials;

    try {
      // Get model and parameters from centralized ModelParameterService
      const params = await ModelParameterService.resolveParameters(
        this.platformId,
        text
      );

      // Extract model from the resolved parameters
      const modelToUse = params.model;

      // Log parameters being used
      this.logger.info(`Using model ${modelToUse} for streaming with parameters:`, {
        effectiveMaxTokens: params.effectiveMaxTokens,
        temperature: params.temperature,
        parameterStyle: params.parameterStyle
      });

      // Each implementation must handle the streaming appropriately
      return this._processWithModelStreaming(text, modelToUse, apiKey, params, onChunk);
    } catch (error) {
      this.logger.error('Error in _processWithApiStreaming:', error);
      throw error;
    }
  }

  /**
   * Process with model-specific parameters
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @returns {Promise<Object>} API response
   */
  async _processWithModel(text, model, apiKey, params) {
    throw new Error('_processWithModel must be implemented by subclasses');
  }

  /**
   * Process with model-specific parameters with streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
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