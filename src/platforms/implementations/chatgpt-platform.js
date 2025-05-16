// src/platforms/implementations/chatgpt-platform.js
import BasePlatform from '../platform-base.js';

/**
 * ChatGPT AI platform implementation
 */
class ChatGptPlatform extends BasePlatform {
  constructor() {
    super('chatgpt');
  }

  /**
   * Check if the current page is ChatGPT
   * @returns {boolean} True if on ChatGPT
   */
  isCurrentPlatform() {
    return window.location.href.includes('chatgpt.com');
  }

  /**
   * Provides an array of CSS selectors for finding ChatGPT's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      'div#prompt-textarea[contenteditable="true"]', // Primary selector based on ID and contenteditable
      'textarea#prompt-textarea', // Fallback if it changes to a textarea with the same ID
    ];
  }

  /**
   * Provides an array of CSS selectors for finding ChatGPT's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      '#composer-submit-button',                // Preferred ID selector
      'button[data-testid="send-button"]',      // Data-testid attribute selector
      'button[aria-label*="Send" i]',           // Aria-label for "Send" (case-insensitive)
      'button[aria-label*="Envoyer" i]',        // French Aria-label for "Send" (case-insensitive)
      // Fallback: A button with an SVG child that looks like a send icon
      'button:has(svg path[d^="M.5 1.163A1 1 0 0"])',
      'button:has(svg path[d*="M2 12s-1-1-1-3"])', // Another common send icon path start
    ];
  }

  /**
   * Override: Insert text into ChatGPT's contenteditable div editor.
   * @param {HTMLElement} editorElement - The editor element (div#prompt-textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // ChatGPT uses <p> tags within its contenteditable div.
    return super._insertTextIntoContentEditable(editorElement, text);
  }

  /**
   * Checks if the ChatGPT editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    // Check textContent, then innerText. Also check if it only contains a <br> tag or placeholder structure.
    const text = (editorElement.textContent || editorElement.innerText || '').trim();
    if (text === '') {
        // Check if the only child is a <p> with a <br> or empty
        if (editorElement.children.length === 1 && editorElement.firstElementChild.tagName === 'P') {
            const pElement = editorElement.firstElementChild;
            return (pElement.innerHTML.trim() === '<br>' || pElement.innerHTML.trim() === '' || pElement.textContent.trim() === '');
        }
        return true;
    }
    return false;
  }
}

export default ChatGptPlatform;