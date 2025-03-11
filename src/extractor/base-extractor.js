// src/extractor/base-extractor.js
const logger = require('../utils/logger');

class BaseExtractor {
  constructor(contentType) {
    this.contentType = contentType;
    this.contentScriptReady = false;
    this.logger = logger.content;
  }

  /**
   * Initialize the extractor
   */
  initialize() {
    try {
      this.logger.info(`${this.contentType} extractor initializing...`);
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Mark script as ready
      this.contentScriptReady = true;
      this.logger.info(`${this.contentType} extractor ready`);
    } catch (error) {
      this.logger.error(`Error initializing ${this.contentType} extractor:`, error);
    }
  }

  /**
   * Set up message listeners for communication
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.logger.info(`Message received in ${this.contentType} extractor:`, message);
      
      // Respond to ping messages to verify content script is loaded
      if (message.action === 'ping') {
        this.logger.info('Ping received, responding with pong');
        sendResponse({ status: 'pong', ready: this.contentScriptReady });
        return true; // Keep the message channel open for async response
      }
      
      if (message.action === 'extractContent') {
        this.logger.info('Extract content request received');
        // Start the extraction process
        this.extractAndSaveContent();
        sendResponse({ status: `Extracting ${this.contentType} content...` });
        return true; // Keep the message channel open for async response
      }
    });
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
          contentType: this.contentType
        },
        contentReady: true
      });
      
      this.logger.info(`${this.contentType} data saved to storage`);
      return true;
    } catch (error) {
      this.logger.error(`Error saving ${this.contentType} data to storage:`, error);
      
      // Save error message to storage
      await chrome.storage.local.set({ 
        extractedContent: {
          error: true,
          message: error.message || 'Unknown error occurred',
          extractedAt: new Date().toISOString(),
          contentType: this.contentType
        },
        contentReady: true
      });
      
      return false;
    }
  }
}

module.exports = BaseExtractor;