// src/platforms/platform-interface.js

/**
 * Interface defining the contract that all AI platform implementations must follow
 */
class PlatformInterface {
  /**
   * Check if the current page is the target platform
   * @returns {boolean} True if current page is the target platform
   */
  isCurrentPlatform() {
    throw new Error('isCurrentPlatform must be implemented by subclasses');
  }
  
  /**
   * Find the editor element for text input
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    throw new Error('findEditorElement must be implemented by subclasses');
  }
  
  /**
   * Find the submit button to send the input
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    throw new Error('findSubmitButton must be implemented by subclasses');
  }
  
  /**
   * Insert text into the editor and submit it
   * @param {string} text - The text to insert and submit
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    throw new Error('insertAndSubmitText must be implemented by subclasses');
  }
  
  /**
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize must be implemented by subclasses');
  }
}

module.exports = PlatformInterface;