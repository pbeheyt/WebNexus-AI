// src/platforms/implementations/deepseek-platform.js
import BasePlatform from '../platform-base.js';

/**
 * DeepSeek AI platform implementation
 */
class DeepSeekPlatform extends BasePlatform {
  constructor() {
    super('deepseek');
  }

  /**
   * Check if the current page is DeepSeek
   * @returns {boolean} True if on DeepSeek
   */
  isCurrentPlatform() {
    return window.location.href.includes('chat.deepseek.com');
  }

  /**
   * Find DeepSeek's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    // Selectors for DeepSeek's editor
    return (
      document.querySelector('#chat-input') ||
      document.querySelector('.c92459f0')
    );
  }

  /**
   * Find DeepSeek's submit button with enhanced selector resilience
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // Primary selectors - target specific UI patterns unique to the send button
    const sendButton =
      // Target by class combinations (current approach with additions)
      document.querySelector('div[role="button"]._7436101.bcc55ca1') ||
      document.querySelector('div[role="button"]._7436101') ||
      document
        .querySelector('div[role="button"] ._6f28693')
        ?.closest('div[role="button"]') ||
      // Position-based fallbacks (rightmost button in the input container)
      document.querySelector('.ec4f5d61 > div[role="button"]:last-child') ||
      document.querySelector(
        '.bf38813a > div:last-child > div[role="button"]'
      ) ||
      // Attribute-based fallbacks
      document.querySelector('div[role="button"][aria-disabled]') ||
      // Icon-based detection
      document
        .querySelector(
          'div[role="button"] .ds-icon svg[width="14"][height="16"]'
        )
        ?.closest('div[role="button"]') ||
      // Original fallbacks
      document.querySelector('div[role="button"].f6d670.bcc55ca1') ||
      document.querySelector('div[role="button"].f6d670');

    if (!sendButton) {
      this.logger.error(
        `[${this.platformId}] Submit button not found using any strategy.`
      );
    }
    return sendButton;
  }

  /**
   * Override: Insert text into DeepSeek's editor.
   * Uses the base implementation as it targets a standard textarea.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    this.logger.info(
      `[${this.platformId}] Using base _insertTextIntoEditor for Deepseek.`
    );
    return super._insertTextIntoEditor(editorElement, text); // Call base class method
  }

  /**
   * Override: Click DeepSeek's submit button, attempting to enable if necessary.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(
        `[${this.platformId}] Attempting to dispatch click event to submit button (DeepSeek override).`
      );
      buttonElement.click(); // Direct click attempt
      this.logger.info(
        `[${this.platformId}] Successfully dispatched click event (DeepSeek override).`
      );
      return true; // Indicate the attempt was made without throwing
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to dispatch click event (DeepSeek override):`,
        error
      );
      return false; // Indicate the click attempt itself threw an error
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
        // DeepSeek uses a textarea
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

export default DeepSeekPlatform;
