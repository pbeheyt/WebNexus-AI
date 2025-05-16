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
   * Provides an array of CSS selectors for finding DeepSeek's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      '#chat-input', // Preferred ID selector
      'textarea[placeholder*="Send a message" i]', // Placeholder attribute (case-insensitive)
      'textarea[placeholder*="输入消息" i]', // Chinese placeholder
      // Fallback class selector (less stable, use as last resort)
      // Example: '.c92459f0' - Note: This class is likely dynamic and should be avoided if possible.
      // If a more stable class or attribute for the textarea exists, use that.
      // For now, relying on ID and placeholder.
    ];
  }

  /**
   * Provides an array of CSS selectors for finding DeepSeek's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      // Primary: Specific class combinations observed
      'div[role="button"]._7436101.bcc55ca1',
      'div[role="button"]._7436101', // More general class
      // Icon-based (if icon is stable)
      'div[role="button"] .ds-icon svg[width="14"][height="16"]', // Assuming this is the send icon
      'div[role="button"]:has(svg path[d^="M2.25"])', // Common send icon path start
      // Position-based (less reliable, but can be a fallback)
      '.ec4f5d61 > div[role="button"]:last-of-type', // If it's the last button in a known container
      '.bf38813a > div:last-of-type > div[role="button"]',
      // Generic attribute, if other buttons might also have aria-disabled
      'div[role="button"][aria-disabled]',
    ];
  }

  /**
   * Override: Insert text into DeepSeek's editor.
   * DeepSeek uses a standard textarea, so the base implementation is suitable.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    this.logger.info(
      `[${this.platformId}] Using base _insertTextIntoEditor for DeepSeek.`
    );
    return super._insertTextIntoEditor(editorElement, text);
  }

  /**
   * Checks if the DeepSeek editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    // Standard check for textarea value
    return (editorElement.value || '').trim() === '';
  }
}

export default DeepSeekPlatform;