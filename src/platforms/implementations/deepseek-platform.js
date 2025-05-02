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
