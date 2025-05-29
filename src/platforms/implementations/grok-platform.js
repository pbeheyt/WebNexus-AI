// src/platforms/implementations/grok-platform.js
import BasePlatform from '../platform-base.js';

/**
 * Grok AI platform implementation
 */
class GrokPlatform extends BasePlatform {
  constructor() {
    super('grok');
  }

  isCurrentPlatform() {
    return window.location.href.includes('grok.com');
  }

  /**
   * Provides an array of CSS selectors for finding Grok's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      // Strategy 1a: Query Bar Parent + Specific Attributes (Preferred)
      'div.query-bar textarea[dir="auto"][style*="resize: none"]',
      // Strategy 1b: Query Bar Parent + Simpler Attributes
      'div.query-bar textarea[dir="auto"]',
      // Strategy 2: Attributes Only (if query-bar class changes)
      'textarea[dir="auto"][style*="resize: none"]',
      // Strategy 3: Broader dir=auto (most generic textarea)
      'textarea[dir="auto"][placeholder*="Ask Grok" i]',
      'textarea[dir="auto"][data-testid="grok-chat-input"]', // Hypothetical stable test ID
      'textarea[dir="auto"]',
    ];
  }

  /**
   * Provides an array of CSS selectors for finding Grok's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      // Strategy 1: Specific SVG Path (most reliable if path is stable)
      'button[type="submit"]:has(svg path[d^="M5 11L12 4"])', // Send icon path
      // Strategy 2: Structural Position (within form's bottom bar, right-aligned)
      'form div[class*="absolute inset-x-0 bottom-0"] div[class*="ml-auto"] button[type="submit"]',
      // Strategy 3: Data-testid (if available and stable)
      'button[data-testid="grok-send-button"]', // Hypothetical stable test ID
      // Strategy 4: Aria-label
      'button[type="submit"][aria-label*="Send" i]',
      'button[type="submit"][aria-label*="Post" i]', // Sometimes "Post" is used
    ];
  }

  /**
   * Override: Insert text into Grok's editor.
   * Grok uses a standard textarea, so the base implementation is suitable.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    this.logger.info(
      `[${this.platformId}] Using base _insertTextIntoEditor for Grok.`
    );
    return super._insertTextIntoEditor(editorElement, text);
  }

  /**
   * Checks if the Grok editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    // Standard check for textarea value
    return (editorElement.value || '').trim() === '';
  }
}

export default GrokPlatform;
