// src/platforms/implementations/claude-platform.js
import BasePlatform from '../platform-base.js';

/**
 * Claude AI platform implementation
 */
class ClaudePlatform extends BasePlatform {
  constructor() {
    super('claude');
  }

  /**
   * Check if the current page is Claude
   * @returns {boolean} True if on Claude
   */
  isCurrentPlatform() {
    return window.location.href.includes('claude.ai');
  }

  /**
   * Provides an array of CSS selectors for finding Claude's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      // Strategy 1: Wrapper + Contenteditable (Preferred)
      'div[aria-label*="Claude"] div[contenteditable="true"].ProseMirror',
      // Strategy 2: Placeholder Parent
      'p[data-placeholder*="Claude"] > div[contenteditable="true"].ProseMirror', // If placeholder is parent of editor
      'p[data-placeholder*="Message Claude"] ~ div[contenteditable="true"].ProseMirror', // If editor is sibling after placeholder
      'div[contenteditable="true"].ProseMirror:has(p[data-placeholder*="Claude"])', // If placeholder is child of editor
      // Strategy 3: Visible Contenteditable (More generic fallback)
      'div[contenteditable="true"].ProseMirror',
    ];
  }

  /**
   * Provides an array of CSS selectors for finding Claude's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      'button[aria-label*="Send Message" i]', // Primary, case-insensitive, more specific
      'button[aria-label*="Envoyer le message" i]', // French for "Send Message"
      'button[aria-label*="message" i]:has(svg)', // Button with "message" in aria-label containing an SVG
      // Fallback: A button with an SVG child that looks like a send icon
      'button:has(svg path[d^="M3.478"])', // Common start of send icon path data
    ];
  }

  /**
   * Override: Insert text into Claude's contenteditable editor.
   * @param {HTMLElement} editorElement - The editor element.
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // Claude uses <p> tags within its ProseMirror editor.
    return super._insertTextIntoContentEditable(editorElement, text);
  }

  /**
   * Gets the platform-specific wait time in milliseconds before attempting to find the submit button.
   * Subclasses can override this to adjust timing.
   * @returns {Promise<number>} Milliseconds to wait.
   * @protected
   */
  async _getPreSubmitWaitMs() {
    this.logger.info(
      `[${this.platformId}] Using specific pre-submit wait of 500ms.`
    );
    return 500;
  }

  /**
   * Checks if the Claude editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    // Claude's ProseMirror editor often has a <p><br></p> structure when empty.
    const html = editorElement.innerHTML.trim().toLowerCase();
    const text = (
      editorElement.textContent ||
      editorElement.innerText ||
      ''
    ).trim();

    if (text === '') {
      // If textContent is empty, check for common empty structures
      if (html === '<p><br></p>' || html === '<p></p>' || html === '') {
        return true;
      }
      // Also consider if it only contains a placeholder attribute
      if (editorElement.querySelector('p[data-placeholder]')) {
        return true;
      }
    }
    return false;
  }
}

export default ClaudePlatform;
