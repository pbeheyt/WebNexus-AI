// src/platforms/implementations/gemini-platform.js
import BasePlatform from '../platform-base.js';

class GeminiPlatform extends BasePlatform {
  constructor() {
    super('gemini');
  }

  isCurrentPlatform() {
    return window.location.hostname.includes('gemini.google.com');
  }

  findEditorElement() {
    // Exact selector based on provided HTML
    const editor = document.querySelector(
      'div.ql-editor[contenteditable="true"][aria-multiline="true"]'
    );
    if (!editor) {
      this.logger.error(
        `[${this.platformId}] Editor element not found using selector.`
      );
    }
    return editor;
  }

  /**
   * Find Gemini's submit button, waiting for it to be ready.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for Gemini submit button readiness...`
    );
    // Selector based on observed HTML: 'button.send-button'
    // This button also has a 'send' icon inside an mat-icon component.
    const selector = 'button.send-button';

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        const button = document.querySelector(selector);
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using selector: ${selector}`);
        } else {
          this.logger.debug(`[${this.platformId}] Submit button candidate not found by selector ${selector} on this poll.`);
        }
        return button;
      },
      async (el) => { // conditionFn
        if (!el) return false;
        const isEnabled = this._isButtonEnabled(el);
        const isVisible = this._isVisibleElement(el);
        const pointerEvents = window.getComputedStyle(el).pointerEvents;
        const hasPointerEvents = pointerEvents !== 'none';
        // Gemini's button might also have specific classes when active, e.g., not having 'disabled' related classes.
        // For now, the general checks should suffice.
        return isEnabled && isVisible && hasPointerEvents;
      },
      5000, // timeoutMs
      300,  // pollIntervalMs
      'Gemini submit button readiness'
    );

    if (buttonElement) {
      this.logger.info(`[${this.platformId}] Gemini submit button found and ready.`);
    } else {
      this.logger.warn(`[${this.platformId}] Gemini submit button did not become ready within the timeout.`);
    }
    return buttonElement;
  }

  /**
   * Override: Insert text into Gemini's contenteditable editor (Quill).
   * @param {HTMLElement} editorElement - The editor element (div.ql-editor).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(
        `[${this.platformId}] Inserting text into Gemini editor (Quill)`
      );
      // Focus the editor
      editorElement.focus();

      // Clear existing content and set new content
      editorElement.innerHTML = '';

      // Create paragraph for each line
      const paragraphs = text.split('\n');
      paragraphs.forEach((paragraph) => {
        const p = document.createElement('p');
        if (paragraph.trim()) {
          p.textContent = paragraph;
        } else {
          // Empty paragraph with br for line breaks
          p.appendChild(document.createElement('br'));
        }
        editorElement.appendChild(p);
      });

      // Remove placeholder class if present
      if (editorElement.classList.contains('ql-blank')) {
        editorElement.classList.remove('ql-blank');
      }

      // Trigger input events using base class helper
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into Gemini editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into Gemini editor:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks if the Gemini editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.textContent || editorElement.innerText || '').trim() === '';
  }

}

export default GeminiPlatform;
