// src/platforms/implementations/gemini-platform.js
import BasePlatform from '../platform-base.js';

class GeminiPlatform extends BasePlatform {
  constructor() {
    super('gemini');
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('gemini.google.com');
  }

  findEditorElement() {
    // Exact selector based on provided HTML
    const editor = document.querySelector(
      'div.ql-editor[contenteditable="true"][aria-multiline="true"]'
    );
    if (!editor) {
      this.logger.error(
        `[${this.platformId}] Editor element not found using selector.`
      );
    }
    return editor;
  }

  findSubmitButton() {
    // Exact selector based on provided HTML
    const button = document.querySelector('button.send-button');
    if (!button) {
      this.logger.error(
        `[${this.platformId}] Submit button not found using selector.`
      );
    }
    return button;
  }

  /**
   * Override: Insert text into Gemini's contenteditable editor (Quill).
   * @param {HTMLElement} editorElement - The editor element (div.ql-editor).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(
        `[${this.platformId}] Inserting text into Gemini editor (Quill)`
      );
      // Focus the editor
      editorElement.focus();

      // Clear existing content and set new content
      editorElement.innerHTML = '';

      // Create paragraph for each line
      const paragraphs = text.split('\n');
      paragraphs.forEach((paragraph) => {
        const p = document.createElement('p');
        if (paragraph.trim()) {
          p.textContent = paragraph;
        } else {
          // Empty paragraph with br for line breaks
          p.appendChild(document.createElement('br'));
        }
        editorElement.appendChild(p);
      });

      // Remove placeholder class if present
      if (editorElement.classList.contains('ql-blank')) {
        editorElement.classList.remove('ql-blank');
      }

      // Trigger input events using base class helper
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into Gemini editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into Gemini editor:`,
        error
      );
      return false;
    }
  }

  /**
   * Override: Click Gemini's submit button, ensuring it's enabled and using event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(
        `[${this.platformId}] Attempting to click submit button`
      );
      // Check and potentially remove disabled state
      if (
        buttonElement.disabled ||
        buttonElement.getAttribute('aria-disabled') === 'true'
      ) {
        this.logger.warn(
          `[${this.platformId}] Submit button is initially disabled.`
        );
        if (buttonElement.hasAttribute('disabled')) {
          this.logger.info(
            `[${this.platformId}] Attempting to remove 'disabled' attribute.`
          );
          buttonElement.disabled = false;
        }
        if (buttonElement.hasAttribute('aria-disabled')) {
          this.logger.info(
            `[${this.platformId}] Attempting to remove 'aria-disabled' attribute.`
          );
          buttonElement.removeAttribute('aria-disabled');
        }
        // Re-check after attempting to enable
        if (
          buttonElement.disabled ||
          buttonElement.getAttribute('aria-disabled') === 'true'
        ) {
          this.logger.error(
            `[${this.platformId}] Submit button remained disabled after attempting to enable.`
          );
          return false; // Return failure if still disabled
        }
        this.logger.info(
          `[${this.platformId}] Submit button successfully enabled.`
        );
      }

      // Click the button with multiple events
      ['mousedown', 'mouseup', 'click'].forEach((eventType) => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: eventType === 'mousedown' ? 1 : 0, // Set buttons only for mousedown
        });
        buttonElement.dispatchEvent(event);
      });

      this.logger.info(
        `[${this.platformId}] Successfully clicked submit button.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to click submit button:`,
        error
      );
      return false;
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
        // Gemini uses Quill editor (contenteditable div)
        const editorContent = editorElement.textContent || editorElement.innerText;
        if (editorContent === null || editorContent.trim() === '') {
           isEditorEmpty = true;
           this.logger.info(`[${this.platformId}] Verification: Editor appears empty.`);
        } else {
           this.logger.info(`[${this.platformId}] Verification: Editor is not empty. Content: "${editorContent.substring(0, 50)}..."`);
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

export default GeminiPlatform;
