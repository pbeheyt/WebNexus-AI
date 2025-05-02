import BasePlatform from '../platform-base.js';

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  findEditorElement() {
    const editor =
      document.querySelector(
        'textarea[name="message.text"][placeholder*="Demander au Chat"]'
      ) || // French placeholder
      document.querySelector(
        'textarea[name="message.text"][placeholder*="Ask the Chat"]'
      ) || // English placeholder
      document.querySelector('textarea.border-default.ring-offset-background'); // Fallback
    if (!editor) {
      this.logger.error(
        `[${this.platformId}] Editor element not found using selectors.`
      );
    }
    return editor;
  }

  findSubmitButton() {
    // More specific selector including aria-label and class structure
    const button = document.querySelector(
      'button[aria-label*="Send question"][class*="bg-inverted"]'
    ); // Match partial class
    if (!button) {
      this.logger.error(
        `[${this.platformId}] Submit button not found using selector.`
      );
    }
    return button;
  }

  /**
   * Override: Insert text into Mistral's editor using specific event sequence.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(
        `[${this.platformId}] Inserting text into Mistral editor with specific events`
      );
      // Focus first to ensure proper state
      editorElement.focus();

      // Set value directly
      editorElement.value = text;

      // Trigger comprehensive set of events to ensure React state updates
      // Use base helper for standard events
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into Mistral editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into Mistral editor:`,
        error
      );
      return false;
    }
  }

  /**
   * Override: Click Mistral's submit button, ensuring it's enabled and using event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(
        `[${this.platformId}] Attempting to click submit button with event sequence`
      );
      // Dispatch multiple events to simulate a real click
      ['mousedown', 'mouseup', 'click'].forEach((eventType) => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: eventType === 'mousedown' ? 1 : 0
        });
        buttonElement.dispatchEvent(event);
      });
      this.logger.info(
        `[${this.platformId}] Successfully dispatched click events.`
      );
      return true; // Indicate dispatch attempt finished without error
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to dispatch click events:`,
        error
      );
      return false; // Indicate the dispatch attempt itself threw an error
    }
  }

  /**
   * Verify submission by checking if the submit button is disabled or the editor is cleared.
   * @returns {Promise<boolean>} True if verification passes, false otherwise.
   * @protected
   * @override
   */
  async _verifySubmissionAttempted() {
    this.logger.info(`[${this.platformId}] Starting post-click verification...`);
    let isButtonDisabled = false;
    let isEditorEmpty = false;

    // Check 1: Submit Button Disabled
    try {
      const submitButton = this.findSubmitButton(); // Re-find the button
      if (submitButton && (submitButton.disabled || submitButton.getAttribute('aria-disabled') === 'true')) {
        isButtonDisabled = true;
        this.logger.info(`[${this.platformId}] Verification: Submit button is disabled.`);
      } else if (submitButton) {
        this.logger.info(`[${this.platformId}] Verification: Submit button is enabled.`);
      } else {
        this.logger.warn(`[${this.platformId}] Verification: Could not re-find submit button.`);
        // Consider this potentially okay if the button disappears on submit
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking submit button state:`, error);
    }

    // Check 2: Editor Cleared/Reset (Platform-Specific Nuances Might Apply)
    try {
      const editorElement = this.findEditorElement(); // Re-find the editor
      if (editorElement) {
        // Mistral uses a textarea
        const editorValue = editorElement.value;
        if (editorValue === null || editorValue.trim() === '') {
           isEditorEmpty = true;
           this.logger.info(`[${this.platformId}] Verification: Editor appears empty.`);
        } else {
           this.logger.info(`[${this.platformId}] Verification: Editor is not empty. Content: "${editorValue.substring(0, 50)}..."`);
        }
      } else {
         this.logger.warn(`[${this.platformId}] Verification: Could not re-find editor element.`);
         // This might be okay if the editor is replaced after submission
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking editor state:`, error);
    }

    // Determine overall success
    const verificationSuccess = isButtonDisabled || isEditorEmpty;

    if (verificationSuccess) {
      this.logger.info(`[${this.platformId}] Post-click verification PASSED.`);
    } else {
      this.logger.warn(`[${this.platformId}] Post-click verification FAILED (Button enabled AND Editor not empty).`);
    }

    return verificationSuccess;
  }
}

export default MistralPlatform;
