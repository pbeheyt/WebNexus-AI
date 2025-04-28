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
   * Find ChatGPT's editor element (the contenteditable div)
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(`[${this.platformId}] Attempting to find editor element (#prompt-textarea)...`);
    // The div now has the ID
    const editor = document.querySelector('div#prompt-textarea[contenteditable="true"]');
    if (!editor) {
        this.logger.error(`[${this.platformId}] Editor element (div#prompt-textarea) not found.`);
    } else {
        this.logger.info(`[${this.platformId}] Found editor element (div#prompt-textarea).`);
    }
    return editor;
  }

  /**
   * Find ChatGPT's submit button using ID and data-testid.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // This method remains the same as the previous version, targeting the final button state
    this.logger.info(`[${this.platformId}] Attempting to find submit button (post-wait/text insertion)...`);
    let button = null;

    // Strategy 1: Find by ID
    button = document.querySelector('#composer-submit-button');
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using ID #composer-submit-button.`);
      return button;
    }

    // Strategy 2: Find by data-testid
    button = document.querySelector('button[data-testid="send-button"]');
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using data-testid="send-button".`);
      return button;
    }

    // Strategy 3: Find by aria-label
    const ariaSelector = 'button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
    button = document.querySelector(ariaSelector);
     if (button) {
      this.logger.info(`[${this.platformId}] Found button using aria-label.`);
      return button;
    }

    this.logger.error(`[${this.platformId}] Submit button not found using any strategy (ID, data-testid, aria-label).`);
    return null;
  }

  /**
   * Override: Insert text into ChatGPT's contenteditable div editor.
   * @param {HTMLElement} editorElement - The editor element (div#prompt-textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into ChatGPT contenteditable editor`);

      // 1. Focus the editor element
      editorElement.focus();

      // 2. Clear existing content (usually a <p><br></p> or similar placeholder)
      editorElement.innerHTML = '';

      // 3. Create and append paragraphs for each line of text
      const lines = text.split('\n');
      lines.forEach((line) => {
        const p = document.createElement('p');
        // Use textContent to prevent HTML injection issues
        // Use non-breaking space for empty lines to maintain structure in contenteditable
        p.textContent = line || '\u00A0';
        editorElement.appendChild(p);
      });

      // 4. Dispatch events to notify the framework (React) of the change
      // 'input' is crucial for React state updates in contenteditable
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(`[${this.platformId}] Successfully inserted text into contenteditable editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text into contenteditable editor:`, error);
      return false;
    }
  }

  /**
   * Override: Click ChatGPT's submit button using a more robust event sequence.
   * Includes pre-click check for disabled state.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button for ChatGPT with event sequence`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is disabled right before click attempt.`);
        return false;
      }
      this.logger.info(`[${this.platformId}] Dispatching click events sequence.`);
      ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: eventType === 'mousedown' ? 1 : 0
        });
        buttonElement.dispatchEvent(event);
      });
      this.logger.info(`[${this.platformId}] Successfully dispatched click events.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to click submit button:`, error);
      return false;
    }
  }
}

module.exports = ChatGptPlatform;
