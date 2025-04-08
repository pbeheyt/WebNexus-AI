// src/platforms/implementations/chatgpt-platform.js
const BasePlatform = require('../platform-base');

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
   * Find ChatGPT's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    return document.querySelector('#prompt-textarea.ProseMirror');
  }
  
  /**
   * Find ChatGPT's submit button
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    return document.querySelector('button[data-testid="send-button"]:not(:disabled)');
  }

  /**
   * Override: Insert text into ChatGPT's contenteditable editor.
   * @param {HTMLElement} editorElement - The editor element (ProseMirror).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`Inserting text into ChatGPT editor (ProseMirror)`);
      // Clear existing content
      editorElement.innerHTML = '';

      // Split the text into paragraphs by newline
      const paragraphs = text.split('\n');

      // Insert each paragraph
      paragraphs.forEach((paragraph) => {
        if (paragraph.trim() === '') {
          // Add empty paragraph with break for blank lines
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          editorElement.appendChild(p);
        } else {
          // Add text paragraph
          const p = document.createElement('p');
          p.textContent = paragraph;
          editorElement.appendChild(p);
        }
      });

      // Remove placeholder class if it exists (though clearing innerHTML might handle this)
      const placeholderP = editorElement.querySelector('p.placeholder');
      if (placeholderP) {
        placeholderP.classList.remove('placeholder');
      }

      // Focus the editor
      editorElement.focus();

      // Dispatch input event to ensure ChatGPT recognizes the change
      this._dispatchEvents(editorElement, ['input']); // Use base class helper

      this.logger.info(`Successfully inserted text into ChatGPT editor.`);
      return true;
    } catch (error) {
      this.logger.error('Error inserting text into ChatGPT editor:', error);
      return false;
    }
  }

  /**
   * Override: Click ChatGPT's submit button using a more robust event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`Attempting to click submit button for ChatGPT with event sequence`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`Submit button for ChatGPT is disabled.`);
        return false;
      }

      // Create and dispatch multiple events for better compatibility
      ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: eventType === 'mousedown' ? 1 : 0 // Set buttons only for mousedown
        });
        buttonElement.dispatchEvent(event);
      });

      this.logger.info(`Successfully clicked submit button for ChatGPT.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to click submit button for ChatGPT:`, error);
      return false;
    }
  }
}

module.exports = ChatGptPlatform;
