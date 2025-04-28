// src/platforms/implementations/deepseek-platform.js
const BasePlatform = require('../platform-base');

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
    // Keep existing selectors with fallbacks
    return document.querySelector('#chat-input') ||
           document.querySelector('.c92459f0');
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
      document.querySelector('div[role="button"] ._6f28693')?.closest('div[role="button"]') ||

      // Position-based fallbacks (rightmost button in the input container)
      document.querySelector('.ec4f5d61 > div[role="button"]:last-child') ||
      document.querySelector('.bf38813a > div:last-child > div[role="button"]') ||

      // Attribute-based fallbacks
      document.querySelector('div[role="button"][aria-disabled]') ||

      // Icon-based detection
      document.querySelector('div[role="button"] .ds-icon svg[width="14"][height="16"]')?.closest('div[role="button"]') ||

      // Original fallbacks
      document.querySelector('div[role="button"].f6d670.bcc55ca1') ||
      document.querySelector('div[role="button"].f6d670');

    if (!sendButton) {
        this.logger.error(`[${this.platformId}] Submit button not found using any strategy.`);
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
    this.logger.info(`[${this.platformId}] Using base _insertTextIntoEditor for Deepseek.`);
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
      this.logger.info(`[${this.platformId}] Attempting to click submit button for Deepseek.`);

      let currentButton = buttonElement; // Use a local variable

      // Check if button is initially disabled
      if (currentButton.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is initially disabled. Attempting to trigger editor input event...`);

        // Find the editor again to dispatch the event
        const editorElement = this.findEditorElement();
        if (editorElement) {
          const inputEvent = new Event('input', { bubbles: true });
          editorElement.dispatchEvent(inputEvent);
          await this._wait(300); // Wait a bit for potential UI update

          // Re-find the button after triggering event
          currentButton = this.findSubmitButton(); // Re-fetch the button state

          if (!currentButton) {
             this.logger.error(`[${this.platformId}] Failed to re-find submit button after triggering input event.`);
             return false;
          }

          if (currentButton.getAttribute('aria-disabled') === 'true') {
            this.logger.error(`[${this.platformId}] Submit button remained disabled after triggering input event.`);
            return false; // Failed to enable
          }
          this.logger.info(`[${this.platformId}] Submit button appears enabled after triggering input event.`);
        } else {
          this.logger.error(`[${this.platformId}] Could not find editor element to trigger enabling event.`);
          return false; // Cannot attempt enabling
        }
      }

      // Proceed to click the (potentially updated) button
      this.logger.info(`[${this.platformId}] Dispatching click event to submit button.`);
      currentButton.click(); // Use the potentially re-found button
      this.logger.info(`[${this.platformId}] Successfully dispatched click event.`);
      return true;

    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to click submit button:`, error);
      return false;
    }
  }
}

module.exports = DeepSeekPlatform;
