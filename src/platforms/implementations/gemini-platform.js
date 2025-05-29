// src/platforms/implementations/gemini-platform.js
import BasePlatform from '../platform-base.js';

class GeminiPlatform extends BasePlatform {
  constructor() {
    super('gemini');
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('gemini.google.com');
  }

  /**
   * Provides an array of CSS selectors for finding Gemini's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      // Primary selector for Quill editor
      'div.ql-editor[contenteditable="true"][aria-multiline="true"]',
      // Fallback if structure changes slightly but retains ql-editor
      'div.ql-editor[contenteditable="true"]',
      // More generic contenteditable area if specific classes are lost
      'div[contenteditable="true"][aria-label*="Prompt" i]',
    ];
  }

  /**
   * Provides an array of CSS selectors for finding Gemini's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      'button.send-button', // Primary class-based selector
      'button[aria-label*="Send message" i]', // Aria-label (case-insensitive)
      'button[aria-label*="Submit" i]', // Common alternative aria-label
      // Fallback: A button containing a mat-icon with "send"
      'button:has(mat-icon[fonticon="send"])',
      'button:has(mat-icon[svgicon*="send"])',
    ];
  }

  /**
   * Override: Insert text into Gemini's contenteditable editor (Quill).
   * @param {HTMLElement} editorElement - The editor element (div.ql-editor).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // Gemini uses <p> elements for lines within its Quill editor.
    return super._insertTextIntoContentEditable(editorElement, text);
  }

  /**
   * Checks if the Gemini editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    // Quill editors often have a <p><br></p> structure when "empty"
    // or might have a class like 'ql-blank'.
    const text = (
      editorElement.textContent ||
      editorElement.innerText ||
      ''
    ).trim();
    if (text === '') {
      // Check for common Quill empty structures
      if (editorElement.classList.contains('ql-blank')) return true;
      if (
        editorElement.innerHTML.trim().toLowerCase() === '<p><br></p>' ||
        editorElement.innerHTML.trim() === '<p></p>'
      ) {
        return true;
      }
      return true; // If textContent is empty, consider it empty
    }
    return false;
  }
}

export default GeminiPlatform;
