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
   * Insert text into DeepSeek's editor and submit
   * @param {string} text - The text to insert
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();

    if (!editorElement) {
      this.logger.error(`[${this.platformId}] Textarea element not found`);
      return false;
    }

    try {
      // Focus on the textarea
      editorElement.focus();

      // Set the value directly
      editorElement.value = text;

      // Trigger input event to activate the UI
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);

      // Wait a short moment for the UI to update
      return new Promise(resolve => {
        setTimeout(() => {
          // Look for the send button
          const sendButton = this.findSubmitButton();

          if (!sendButton) {
            // Enhanced logging to help troubleshoot button selector issues
            this.logger.warn(`[${this.platformId}] Send button not found initially. DOM structure may have changed or requires more time.`);
            this.logger.info(`[${this.platformId}] Available button elements:`,
              document.querySelectorAll('div[role="button"]').length);
            resolve(false);
            return;
          }

          // Check if button is disabled
          const isDisabled = sendButton.getAttribute('aria-disabled') === 'true';

          if (isDisabled) {
            this.logger.warn(`[${this.platformId}] Send button is currently disabled`);
            // Try enabling the button by triggering another input event
            editorElement.dispatchEvent(inputEvent);

            // Wait a bit more and try again
            setTimeout(() => {
              const updatedButton = this.findSubmitButton();

              if (updatedButton && updatedButton.getAttribute('aria-disabled') !== 'true') {
                updatedButton.click();
                this.logger.info(`[${this.platformId}] Text submitted successfully after enabling button`);
                resolve(true);
              } else {
                this.logger.error(`[${this.platformId}] Send button remained disabled after retry`);
                resolve(false);
              }
            }, 300);
          } else {
            // Click the send button if it's not disabled
            sendButton.click();
            this.logger.info(`[${this.platformId}] Text submitted successfully`);
            resolve(true);
          }
        }, 500);
      });
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text:`, error);
      return false;
    }
  }
  // No override needed for _insertTextIntoEditor - default implementation works
  // No override needed for _clickSubmitButton - default implementation works
}

module.exports = DeepSeekPlatform;
