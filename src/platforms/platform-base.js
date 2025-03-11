// src/platforms/platform-base.js
const PlatformInterface = require('./platform-interface');

/**
 * Base implementation with shared functionality for all AI platforms
 */
class BasePlatform extends PlatformInterface {
  /**
   * @param {string} platformId - Unique identifier for the platform
   */
  constructor(platformId) {
    super();
    this.platformId = platformId;
    this.logger = this.createLogger();
    this.maxRetries = 20;
    this.processingStarted = false;
  }
  
  /**
   * Create a logger specific to this platform
   * @returns {Object} Logger object
   */
  createLogger() {
    return {
      info: (message, data = null) => console.log(`[${this.platformId}] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[${this.platformId}] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[${this.platformId}] ERROR: ${message}`, data || '')
    };
  }
  
  /**
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.isCurrentPlatform()) {
      this.logger.info(`Not on ${this.platformId}, exiting`);
      return;
    }
    
    this.logger.info(`Initializing ${this.platformId} platform integration`);
    
    if (document.readyState === 'complete') {
      this.observeForEditor();
    } else {
      window.addEventListener('load', () => {
        this.observeForEditor();
      });
    }
  }
  
  /**
   * Use MutationObserver to wait for editor element to be available
   */
  observeForEditor() {
    const observerConfig = { childList: true, subtree: true };
    let retryCount = 0;
    
    const observer = new MutationObserver(() => {
      const editorElement = this.findEditorElement();
      
      if (editorElement && !this.processingStarted) {
        this.logger.info(`${this.platformId} interface ready, starting processing`);
        this.processingStarted = true;
        observer.disconnect();
        this.processContent();
      } else {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          observer.disconnect();
          this.logger.error(`Failed to find ${this.platformId} interface elements after maximum retries`);
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: `Could not interact with ${this.platformId} interface. The page may still be loading or the interface may have changed.`
          });
        }
      }
    });
    
    observer.observe(document.body, observerConfig);
  }
  
  /**
   * Process content from storage and insert into the platform
   */
  async processContent() {
    try {
      this.logger.info(`Starting to process extracted content for ${this.platformId}`);
      
      // Get data from storage
      chrome.storage.local.get(['prePrompt', 'extractedContent'], result => {
        this.logger.info('Retrieved data from storage', {
          hasPrompt: !!result.prePrompt,
          hasContent: !!result.extractedContent
        });
        
        if (!result.prePrompt) {
          throw new Error('Missing prompt data');
        }

        if (!result.extractedContent) {
          throw new Error('Missing content data');
        }
        
        // Format content based on type
        const formattedContent = this.formatContent(result.extractedContent);
        
        // Combine prompt with content
        const fullText = `${result.prePrompt}\n\n${formattedContent}`;
        
        this.logger.info(`Attempting to insert text into ${this.platformId}`);
        this.insertAndSubmitText(fullText).then(success => {
          if (success) {
            this.logger.info(`Content successfully inserted into ${this.platformId}`);
            
            // Clear the data after successful insertion
            chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
          } else {
            this.logger.error(`Failed to insert content into ${this.platformId}`);
            chrome.runtime.sendMessage({
              action: 'notifyError',
              error: `Failed to insert content into ${this.platformId}. Please try again or check if the interface has changed.`
            });
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error in ${this.platformId} processContent:`, error);
      chrome.runtime.sendMessage({
        action: 'notifyError',
        error: `Error processing content: ${error.message}`
      });
    }
  }
  
  /**
   * Format content based on content type
   * @param {Object} data - The extracted content data
   * @returns {string} Formatted content
   */
  formatContent(data) {
    if (!data) {
      this.logger.error('No content data available for formatting');
      return 'No content data available';
    }
    
    const contentType = data.contentType;
    
    let formatted = '';
    switch (contentType) {
      case 'youtube':
        formatted = this.formatYouTubeData(data);
        break;
      case 'reddit':
        formatted = this.formatRedditData(data);
        break;
      case 'general':
        formatted = this.formatGeneralData(data);
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
  formatYouTubeData(data) {
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';
    
    // Format comments with likes
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = '\n\nComments:\n';
      data.comments.forEach(comment => {
        commentsText += `User: ${comment.author || 'Anonymous'}\nLikes: ${comment.likes || '0'}\nComment: ${comment.text || ''}\n\n`;
      });
    }
    
    return `Title: ${title}\nChannel: ${channel}\n\nDescription:\n${description}\n\nTranscript:\n${transcript}${commentsText}`;
  }
  
  /**
   * Format Reddit post data
   * @param {Object} data - Reddit post data
   * @returns {string} Formatted Reddit data
   */
  formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    const postUrl = data.postUrl || '';
    
    // Start with post information
    let formattedText = `Title: ${title}\nAuthor: ${author}`;
    
    // Add post URL if available
    if (postUrl) {
      formattedText += `\nURL: ${postUrl}`;
    }
    
    // Add post content
    formattedText += `\n\nContent:\n${content}`;
    
    // Format comments with links
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formattedText += '\n\nComments:\n';
      
      data.comments.forEach(comment => {
        formattedText += `User: ${comment.author || 'Anonymous'}\n`;
        formattedText += `Score: ${comment.popularity || '0'}\n`;
        
        // Add permalink if available
        if (comment.permalink) {
          formattedText += `Link: ${comment.permalink}\n`;
        }
        
        formattedText += `Comment: ${comment.content || ''}\n\n`;
      });
    }
    
    return formattedText;
  }
  
  /**
   * Format general web page data
   * @param {Object} data - Web page data
   * @returns {string} Formatted web page data
   */
  formatGeneralData(data) {
    const title = data.pageTitle || 'No title available';
    const url = data.pageUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    
    return `Title: ${title}\nURL: ${url}\n\nContent:\n${content}`;
  }
}

module.exports = BasePlatform;