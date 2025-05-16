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
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
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
   * Override: Insert text into Gemini's contenteditable editor (Quill).
   * @param {HTMLElement} editorElement - The editor element (div.ql-editor).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // Gemini uses <p> elements for lines within its Quill editor.
    // The class `ql-blank` is managed by Quill based on content.
    // Clearing innerHTML and then appending new <p> elements, followed by dispatching events,
    // is the standard way to interact with such editors.
    return super._insertTextIntoContentEditable(editorElement, text);
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