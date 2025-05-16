import BasePlatform from '../platform-base.js';

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  /**
   * Find Mistral's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    // Strategy 1: Preferred name attribute selector (specific to Mistral's form structure)
    const primarySelector = 'textarea[name="message.text"]';
    // Strategy 2: Fallback class-based selector (less stable - may change with UI updates)
    const fallbackSelector = 'textarea.border-default.ring-offset-background';
    let editor = document.querySelector(primarySelector);

    if (editor) {
      this.logger.info(`[${this.platformId}] Found editor element using primary selector: '${primarySelector}'.`);
      return editor;
    }
    
    editor = document.querySelector(fallbackSelector);
    if (editor) {
      this.logger.info(`[${this.platformId}] Found editor element using fallback selector: '${fallbackSelector}'.`);
      return editor;
    }

    this.logger.error(
      `[${this.platformId}] Editor element not found using selectors '${primarySelector}' or '${fallbackSelector}'.`
    );
    return null;
  }

  /**
   * Find Mistral's submit button, waiting for it to be ready.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
    );
    // Primary selector: button with type="submit" containing an SVG (usually the send icon)
    const primarySelector = 'button[type="submit"]:has(svg)';
    // Fallback selector: button with type="submit" and a class indicating it's an inverted color button (common pattern)
    const fallbackSelector = 'button[type="submit"][class*="bg-inverted"]';

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        let button = document.querySelector(primarySelector);
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using primary selector: ${primarySelector}`);
          return button;
        }
        button = document.querySelector(fallbackSelector);
        if (button) {
          this.logger.debug(`[${this.platformId}] Submit button candidate found using fallback selector: ${fallbackSelector}`);
          return button;
        }
        this.logger.debug(`[${this.platformId}] Submit button candidate not found by any strategy on this poll.`);
        return null;
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
   * Override: Insert text into Mistral's editor using specific event sequence.
   * This platform uses a standard textarea, so the base class method is suitable.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    this.logger.info(
      `[${this.platformId}] Using base _insertTextIntoEditor for Mistral.`
    );
    return super._insertTextIntoEditor(editorElement, text);
  }

  /**
   * Checks if the Mistral editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.value || '').trim() === '';
  }

}

export default MistralPlatform;