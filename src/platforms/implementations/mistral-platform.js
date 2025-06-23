// src/platforms/implementations/mistral-platform.js
import BasePlatform from '../platform-base.js';

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

/**
 * Provides an array of CSS selectors for finding Mistral's editor element.
 * @returns {string[]} Array of CSS selector strings.
 * @protected
 */
_getEditorSelectors() {
  return [
    // Primary selector targeting the specific editor class
    'div[contenteditable="true"].ProseMirror',
    // More specific fallback in case the class structure is consistent
    'div.Editor-indented.ProseMirror[contenteditable="true"]',
    // A more generic contenteditable div selector as a last resort
    'div[contenteditable="true"][translate="no"]',
  ];
}

/**
 * Provides an array of CSS selectors for finding Mistral's submit button.
 * @returns {string[]} Array of CSS selector strings.
 * @protected
 */
_getSubmitButtonSelectors() {
  return [
    // Primary: Specific attribute selector for the send button
    'button[type="submit"][aria-label="Send question"]',
    // Secondary: Targets the button containing the unique SVG icon by its ID.
    'button[type="submit"]:has(svg[id="a"])',
    // Tertiary Fallback: Targets a submit button with a class that might indicate its primary action state.
    'button[type="submit"][class*="bg-state-primary"]',
  ];
}

/**
 * Override: Insert text into Mistral's editor.
 * Mistral now uses a contenteditable div (ProseMirror).
 * @param {HTMLElement} editorElement - The editor element (div).
 * @param {string} text - The text to insert.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 * @protected
 */
async _insertTextIntoEditor(editorElement, text) {
  this.logger.info(
    `[${this.platformId}] Using contenteditable insertion for Mistral.`
  );
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
      `[${this.platformId}] Using specific pre-submit wait of 50ms.`
    );
    return 50;
  }

/**
 * Checks if the Mistral editor element is empty.
 * @param {HTMLElement} editorElement - The editor element to check.
 * @returns {boolean} True if the editor is empty, false otherwise.
 * @protected
 */
_isEditorEmpty(editorElement) {
  // The ProseMirror editor is empty if it has no text content and
  // its inner HTML typically contains a paragraph with a line break.
  const text = (
    editorElement.textContent ||
    editorElement.innerText ||
    ''
  ).trim();
  if (text === '') {
    const html = editorElement.innerHTML.trim().toLowerCase();
    return html === '<p><br></p>' || html === '<p></p>' || html === '';
  }
  return false;
}
}

export default MistralPlatform;
