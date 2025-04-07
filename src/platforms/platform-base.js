// src/platforms/platform-base.js
const PlatformInterface = require('./platform-interface');
const STORAGE_KEYS = require('../shared/constants').STORAGE_KEYS;

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
      this.logger.info(`Starting to process formatted content for ${this.platformId}`);
      
      // Get data from storage
      chrome.storage.local.get([STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION], result => {
        this.logger.info('Retrieved data from storage', {
          hasPrompt: !!result[STORAGE_KEYS.PRE_PROMPT],
          hasFormattedContent: !!result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION]
        });
        
        const prePrompt = result[STORAGE_KEYS.PRE_PROMPT];
        const formattedContentString = result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION];

        if (!prePrompt) {
          throw new Error('Missing prompt data');
        }

        if (!formattedContentString) {
          throw new Error('Missing formatted content data');
        }
        
        // Combine prompt with the centrally formatted content
        const fullText = this.createStructuredPrompt(prePrompt, formattedContentString);
        
        this.logger.info(`Attempting to insert text into ${this.platformId}`);
        this.insertAndSubmitText(fullText).then(success => {
          if (success) {
            this.logger.info(`Content successfully inserted into ${this.platformId}`);
            
            // Clear the data after successful insertion
            chrome.storage.local.remove([STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION, STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.CONTENT_READY]);
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
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string} formattedContent - The formatted content
   * @returns {string} The full structured prompt
   */
  createStructuredPrompt(prePrompt, formattedContent) {
    // Use a simple structural approach that preserves the entire prePrompt
    return `# INSTRUCTIONS
${prePrompt}
# CONTENT
${formattedContent}`;
  }
}

module.exports = BasePlatform;
