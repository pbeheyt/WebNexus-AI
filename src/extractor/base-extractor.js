// src/extractor/base-extractor.js
const logger = require('../shared/logger').extractor;

class BaseExtractor {
  constructor(contentType) {
    this.contentType = contentType;
    this.contentScriptReady = false;
    this.logger = logger;
    this.messageListener = null;
  }

  /**
   * Initialize the extractor
   */
  initialize() {
    try {
      this.logger.info(`${this.contentType} extractor initializing...`);
      this.setupMessageListeners();
      this.contentScriptReady = true;
      this.logger.info(`${this.contentType} extractor ready`);
    } catch (error) {
      this.logger.error(
        `Error initializing ${this.contentType} extractor:`,
        error
      );
    }
  }

  /**
   * Clean up extractor resources and listeners
   */
  cleanup() {
    try {
      if (this.messageListener) {
        chrome.runtime.onMessage.removeListener(this.messageListener);
        this.messageListener = null;
      }
      this.logger.info(`${this.contentType} extractor cleaned up`);
    } catch (error) {
      this.logger.error(
        `Error cleaning up ${this.contentType} extractor:`,
        error
      );
    }
  }

  /**
   * Set up message listeners for communication
   */
  setupMessageListeners() {
    this.messageListener = (message, sender, sendResponse) => {
      // Only log if the action is not 'streamChunk'
      if (message.action !== 'streamChunk') {
        this.logger.info(
          `Message received in ${this.contentType} extractor:`,
          message
        );
      }

      if (message.action === 'extractContent') {
        this.logger.info('Extract content request received');
        this.extractAndSaveContent();
        sendResponse({ status: `Extracting ${this.contentType} content...` });
        return true;
      }
    };

    chrome.runtime.onMessage.addListener(this.messageListener);
  }

  /**
   * Extract content and save to storage
   * This should be implemented by each strategy
   */
  async extractAndSaveContent() {
    throw new Error('extractAndSaveContent must be implemented by subclasses');
  }

  /**
   * Extract data from the page
   * This should be implemented by each strategy
   */
  async extractData() {
    throw new Error('extractData must be implemented by subclasses');
  }

  /**
   * Save extracted data to Chrome storage
   * @param {Object} data - The data to save
   */
  async saveToStorage(data) {
    try {
      await chrome.storage.local.set({
        extractedContent: {
          ...data,
          contentType: this.contentType,
        },
        contentReady: true,
      });

      this.logger.info(`${this.contentType} data saved to storage`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error saving ${this.contentType} data to storage:`,
        error
      );

      // Save error message to storage
      await chrome.storage.local.set({
        extractedContent: {
          error: true,
          message: error.message || 'Unknown error occurred',
          extractedAt: new Date().toISOString(),
          contentType: this.contentType,
        },
        contentReady: true,
      });

      return false;
    }
  }
}

module.exports = BaseExtractor;
