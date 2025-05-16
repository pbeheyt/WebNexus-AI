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
   * Find ChatGPT's editor element (the contenteditable div)
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(
      `[${this.platformId}] Attempting to find editor element (#prompt-textarea)...`
    );
    // The div now has the ID
    const editor = document.querySelector(
      'div#prompt-textarea[contenteditable="true"]'
    );
    if (!editor) {
      this.logger.error(
        `[${this.platformId}] Editor element (div#prompt-textarea) not found.`
      );
    } else {
      this.logger.info(
        `[${this.platformId}] Found editor element (div#prompt-textarea).`
      );
    }
    return editor;
  }

  /**
   * Find ChatGPT's submit button using ID and data-testid, waiting for it to be ready.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
    );

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        let button = document.querySelector('#composer-submit-button');
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using ID #composer-submit-button.`);
          return button;
        }
        button = document.querySelector('button[data-testid="send-button"]');
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using data-testid="send-button".`);
          return button;
        }
        const ariaSelector = 'button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
        button = document.querySelector(ariaSelector);
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using aria-label.`);
        } else {
           this.logger.debug(`[${this.platformId}] Submit button candidate not found by any strategy on this poll.`);
        }
        return button; // Returns null if not found by any strategy
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
   * Override: Insert text into ChatGPT's contenteditable div editor.
   * @param {HTMLElement} editorElement - The editor element (div#prompt-textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // Default options of _insertTextIntoContentEditable should work for ChatGPT (uses <p>)
    return super._insertTextIntoContentEditable(editorElement, text);
  }

  /**
   * Checks if the ChatGPT editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.textContent || editorElement.innerText || '').trim() === '';
  }

}

export default ChatGptPlatform;