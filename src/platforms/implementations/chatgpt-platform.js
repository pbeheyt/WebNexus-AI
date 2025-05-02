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
   * Find ChatGPT's submit button using ID and data-testid.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // This method remains the same as the previous version, targeting the final button state
    this.logger.info(
      `[${this.platformId}] Attempting to find submit button (post-wait/text insertion)...`
    );
    let button = null;

    // Strategy 1: Find by ID
    button = document.querySelector('#composer-submit-button');
    if (button) {
      this.logger.info(
        `[${this.platformId}] Found button using ID #composer-submit-button.`
      );
      return button;
    }

    // Strategy 2: Find by data-testid
    button = document.querySelector('button[data-testid="send-button"]');
    if (button) {
      this.logger.info(
        `[${this.platformId}] Found button using data-testid="send-button".`
      );
      return button;
    }

    // Strategy 3: Find by aria-label
    const ariaSelector =
      'button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
    button = document.querySelector(ariaSelector);
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using aria-label.`);
      return button;
    }

    this.logger.error(
      `[${this.platformId}] Submit button not found using any strategy (ID, data-testid, aria-label).`
    );
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
      this.logger.info(
        `[${this.platformId}] Inserting text into ChatGPT contenteditable editor`
      );

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

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into contenteditable editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into contenteditable editor:`,
        error
      );
      return false;
    }
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

  /**
   * Verify submission by checking if the submit button is disabled or the editor is cleared.
   * @returns {Promise<boolean>} True if verification passes, false otherwise.
   * @protected
   * @override
   */
  async _verifySubmissionAttempted() {
    this.logger.info(`[${this.platformId}] Starting post-click verification...`);
    let isButtonDisabled = false;
    let isEditorEmpty = false;

    // Check 1: Submit Button Disabled
    try {
      const submitButton = this.findSubmitButton(); // Re-find the button
      if (submitButton && (submitButton.disabled || submitButton.getAttribute('aria-disabled') === 'true')) {
        isButtonDisabled = true;
        this.logger.info(`[${this.platformId}] Verification: Submit button is disabled.`);
      } else if (submitButton) {
        this.logger.info(`[${this.platformId}] Verification: Submit button is enabled.`);
      } else {
        this.logger.warn(`[${this.platformId}] Verification: Could not re-find submit button.`);
        // Consider this potentially okay if the button disappears on submit
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking submit button state:`, error);
    }

    // Check 2: Editor Cleared/Reset
    try {
      const editorElement = this.findEditorElement(); // Re-find the editor
      if (editorElement) {
        // Check for empty content (ChatGPT uses a contenteditable div)
        const editorContent = editorElement.textContent || editorElement.innerText;
        if (editorContent === null || editorContent.trim() === '') {
           isEditorEmpty = true;
           this.logger.info(`[${this.platformId}] Verification: Editor appears empty.`);
        } else {
           this.logger.info(`[${this.platformId}] Verification: Editor is not empty. Content: "${editorContent.substring(0, 50)}..."`);
        }
      } else {
         this.logger.warn(`[${this.platformId}] Verification: Could not re-find editor element.`);
         // This might be okay if the editor is replaced after submission
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking editor state:`, error);
    }

    // Determine overall success
    const verificationSuccess = isButtonDisabled || isEditorEmpty;

    if (verificationSuccess) {
      this.logger.info(`[${this.platformId}] Post-click verification PASSED.`);
    } else {
      this.logger.warn(`[${this.platformId}] Post-click verification FAILED (Button enabled AND Editor not empty).`);
    }

    return verificationSuccess;
  }
}

export default ChatGptPlatform;
