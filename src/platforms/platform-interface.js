// src/platforms/platform-interface.js

/**
 * Interface defining the contract that all AI platform implementations must follow
 */
class PlatformInterface {
  /**
   * @abstract
   * @protected
   */
  async _clickSubmitButton(_buttonElement) {
    throw new Error('_clickSubmitButton must be implemented by subclasses');
  }

  /**
   * Verifies if submission was likely attempted by checking UI cues after clicking the submit button.
   * Checks if the submit button became disabled OR if the editor element became empty.
   * @returns {Promise<boolean>} True if verification passes (button disabled or editor empty), false otherwise.
   * @protected
   */
  async _verifySubmissionAttempted() {
    throw new Error(
      '_verifySubmissionAttempted must be implemented by subclasses'
    );
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
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize must be implemented by subclasses');
  }
}

export default PlatformInterface;
