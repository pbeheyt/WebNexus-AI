// src/extractor/base-extractor.js
import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';

class BaseExtractor {
  constructor(contentType) {
    this.contentType = contentType;
    this.contentScriptReady = false;
    this.logger = logger.extractor;
    this.messageListener = null;
  }

  /**
   * Initialize the extractor
   */
  initialize() {
    try {
      this.logger.info(`${this.contentType} extractor initializing...`);
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
    this.logger.info(`${this.contentType} extractor cleaned up`);
  }

  /**
   * Placeholder for handling specific messages. Subclasses can override this.
   * @param {object} message - The message object from the runtime.
   * @param {object} sender - The sender of the message.
   * @param {function} sendResponse - The function to call to send a response.
   * @returns {boolean|undefined} - Return true to indicate an async response.
   */
  handleMessage(_message, _sender, _sendResponse) {
    // Subclasses can implement this method to handle custom messages.
    // Return true if you intend to send an asynchronous response.
    return false;
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
        [STORAGE_KEYS.EXTRACTED_CONTENT]: {
          ...data,
          contentType: this.contentType,
        },
        [STORAGE_KEYS.CONTENT_READY_FLAG]: true,
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
        [STORAGE_KEYS.EXTRACTED_CONTENT]: {
          error: true,
          message: error.message || 'Unknown error occurred',
          extractedAt: new Date().toISOString(),
          contentType: this.contentType,
        },
        [STORAGE_KEYS.CONTENT_READY_FLAG]: true,
      });

      return false;
    }
  }

}

export default BaseExtractor;
