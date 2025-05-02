// src/platforms/platform-interface.js

/**
 * Interface defining the contract that all AI platform implementations must follow
 */
class PlatformInterface {
    /**
     * @abstract
     * @protected
     */
    async _clickSubmitButton(buttonElement) {
      throw new Error('_clickSubmitButton must be implemented by subclasses');
    }

    /**
     * Verify if the submission seems to have been accepted by the platform UI.
     * This is called after attempting a click on the submit button.
     * Checks for UI changes like the button becoming disabled or the input clearing.
     * @returns {Promise<boolean>} True if verification passes, false otherwise.
     * @protected Should be implemented by subclasses.
     */
    async _verifySubmissionAttempted() {
        throw new Error('_verifySubmissionAttempted must be implemented by subclasses');
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
  async insertAndSubmitText(_text) {
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

export default PlatformInterface;
