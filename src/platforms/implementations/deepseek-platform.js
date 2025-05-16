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
    // Strategy 1: Preferred ID selector
    let editor = document.querySelector('#chat-input');
    if (editor) {
      this.logger.info(`[${this.platformId}] Found editor element using #chat-input.`);
      return editor;
    }
    // Strategy 2: Fallback class-based selector (less stable)
    // Note: Class 'c92459f0' might be dynamically generated and prone to change.
    editor = document.querySelector('.c92459f0');
    if (editor) {
      this.logger.info(`[${this.platformId}] Found editor element using fallback class .c92459f0.`);
      return editor;
    }
    this.logger.error(`[${this.platformId}] Editor element not found using any strategy.`);
    return null;
  }

  /**
   * Find DeepSeek's submit button with enhanced selector resilience, waiting for it to be ready.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
    );

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        // Primary selectors - target specific UI patterns unique to the send button
        const sendButton =
          // Target by class combinations (current approach with additions)
          document.querySelector('div[role="button"]._7436101.bcc55ca1') || // More specific first
          document.querySelector('div[role="button"]._7436101') || // General class for button
          document.querySelector('div[role="button"] ._6f28693')?.closest('div[role="button"]') || // Icon parent
          // Position-based fallbacks (rightmost button in the input container)
          document.querySelector('.ec4f5d61 > div[role="button"]:last-child') || // Common container class
          document.querySelector('.bf38813a > div:last-child > div[role="button"]') || // Another container structure
          // Attribute-based fallbacks
          document.querySelector('div[role="button"][aria-disabled]') || // Generic button that can be disabled
          // Icon-based detection
          document.querySelector('div[role="button"] .ds-icon svg[width="14"][height="16"]')?.closest('div[role="button"]') ||
          // Original fallbacks from previous version (less specific, so last)
          document.querySelector('div[role="button"].f6d670.bcc55ca1') ||
          document.querySelector('div[role="button"].f6d670');

        if (sendButton) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found.`);
        } else {
          this.logger.debug(`[${this.platformId}] Submit button candidate not found on this poll.`);
        }
        return sendButton;
      },
      async (el) => { // conditionFn
        if (!el) return false;
        const isEnabled = this._isButtonEnabled(el);
        const isVisible = this._isVisibleElement(el);
        const pointerEvents = window.getComputedStyle(el).pointerEvents;
        const hasPointerEvents = pointerEvents !== 'none';
        return isEnabled && isVisible && hasPointerEvents;
      },
      5000, // timeoutMs
      300,  // pollIntervalMs
      `${this.platformId} submit button readiness`
    );

    if (buttonElement) {
      this.logger.info(`[${this.platformId}] ${this.platformId} submit button found and ready.`);
    } else {
      this.logger.warn(`[${this.platformId}] ${this.platformId} submit button did not become ready within the timeout.`);
    }
    return buttonElement;
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
   * Checks if the DeepSeek editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.value || '').trim() === '';
  }

}

export default DeepSeekPlatform;