// src/platforms/implementations/claude-platform.js
import BasePlatform from '../platform-base.js';

/**
 * Claude AI platform implementation
 */
class ClaudePlatform extends BasePlatform {
  constructor() {
    super('claude');
  }

  /**
   * Check if the current page is Claude
   * @returns {boolean} True if on Claude
   */
  isCurrentPlatform() {
    return window.location.href.includes('claude.ai');
  }

  /**
   * Find Claude's editor element using more robust strategies.
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(
      `[${this.platformId}] Attempting to find editor element...`
    );

    // Strategy 1: Look for contenteditable inside the known wrapper
    try {
      const wrapper = document.querySelector('div[aria-label*="Claude"]'); // Find wrapper by aria-label
      if (wrapper) {
        const editor = wrapper.querySelector(
          'div[contenteditable="true"].ProseMirror'
        );
        if (editor && this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 1 (Wrapper + Contenteditable)`
          );
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 1 editor search:`,
        e
      );
    }

    // Strategy 2: Look for contenteditable containing the placeholder paragraph
    try {
      // Use partial match for placeholder text to handle language variations
      const placeholderParagraph = document.querySelector(
        'p[data-placeholder*="Claude"]'
      );
      if (placeholderParagraph) {
        const editor = placeholderParagraph.closest(
          'div[contenteditable="true"].ProseMirror'
        );
        if (editor && this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 2 (Placeholder Parent)`
          );
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 2 editor search:`,
        e
      );
    }

    // Strategy 3: Find the most prominent contenteditable div
    try {
      const editors = document.querySelectorAll(
        'div[contenteditable="true"].ProseMirror'
      );
      // Find the first one that's visible (usually the main input)
      for (const editor of editors) {
        if (this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 3 (Visible Contenteditable)`
          );
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 3 editor search:`,
        e
      );
    }

    return null;
  }


  /**
   * Find Claude's submit button using more robust strategies.
   * Checks for visibility, enabled state, and pointer-events. Returns null if checks fail, allowing retry.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
    );

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        const svgElement = document.querySelector('button[aria-label*="message" i] svg');
        return svgElement ? svgElement.closest('button') : null;
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
   * Override: Insert text into Claude's contenteditable editor.
   * @param {HTMLElement} editorElement - The editor element.
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    // Default options of _insertTextIntoContentEditable should work for Claude (uses <p>)
    // The specific class removal `editorElement.classList.remove('is-empty', 'is-editor-empty');`
    // should be implicitly handled by `editorElement.innerHTML = '';` in the base method.
    return super._insertTextIntoContentEditable(editorElement, text);
  }

  /**
   * Checks if the Claude editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.textContent || editorElement.innerText || '').trim() === '';
  }

}

export default ClaudePlatform;