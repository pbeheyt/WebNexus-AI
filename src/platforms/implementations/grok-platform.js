// src/platforms/implementations/grok-platform.js
import BasePlatform from '../platform-base.js';

/**
 * Grok AI platform implementation
 */
class GrokPlatform extends BasePlatform {
  constructor() {
    super('grok');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'grok.com';
  }

  /**
   * Find the active Grok editor element using more robust strategies.
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(
      `[${this.platformId}] Attempting to find editor element...`
    );

    // --- Strategy 1: Query Bar Parent + Attributes ---
    try {
      const queryBar = document.querySelector('div.query-bar'); // Find the main input container
      if (queryBar) {
        // More specific check first
        const editor = queryBar.querySelector(
          'textarea[dir="auto"][style*="resize: none"]'
        );
        if (editor && this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 1a (Query Bar + Attributes)`
          );
          return editor;
        }
        // Simpler version within query bar if the style one fails
        const simplerEditor = queryBar.querySelector('textarea[dir="auto"]');
        if (simplerEditor && this._isVisibleElement(simplerEditor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 1b (Query Bar + dir=auto)`
          );
          return simplerEditor;
        }
      } else {
        this.logger.warn(
          `[${this.platformId}] Strategy 1: Query Bar container not found.`
        );
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 1 editor search:`,
        e
      );
    }

    // --- Strategy 2: Attributes Only ---
    try {
      const textareas = document.querySelectorAll(
        'textarea[dir="auto"][style*="resize: none"]'
      );
      for (const editor of textareas) {
        if (this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 2 (Attributes Only)`
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

    // --- Strategy 3: Broader dir=auto ---
    try {
      const textareasDirAuto = document.querySelectorAll(
        'textarea[dir="auto"]'
      );
      for (const editor of textareasDirAuto) {
        if (this._isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 3 (Broader dir=auto)`
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

    this.logger.error(
      `[${this.platformId}] Editor element not found using any strategy.`
    );
    return null;
  }

  /**
   * Find the Grok submit button using robust strategies, waiting for it to be ready.
   * @returns {Promise<HTMLElement|null>} The submit button or null if not found/ready
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find and wait for ${this.platformId} submit button readiness...`
    );

    const buttonElement = await this._waitForElementState(
      () => { // elementSelectorFn
        // Strategy 1: Specific SVG Path (most reliable if path is stable)
        const svgPathSelector = 'button[type="submit"] svg path[d^="M5 11L12 4"]';
        const pathElement = document.querySelector(svgPathSelector);
        if (pathElement) {
          const button = pathElement.closest('button[type="submit"]');
          if (button) {
            this.logger.debug(`[${this.platformId}] Submit button candidate found via SVG Path.`);
            return button;
          }
        }

        // Strategy 2: Structural Position (within form's bottom bar, right-aligned)
        const bottomBarSelector = 'form div[class*="absolute inset-x-0 bottom-0"]';
        const bottomBar = document.querySelector(bottomBarSelector);
        if (bottomBar) {
          const button = bottomBar.querySelector('div[class*="ml-auto"] button[type="submit"]');
          if (button) {
            this.logger.debug(`[${this.platformId}] Submit button candidate found via Structural Position.`);
            return button;
          }
        }
        this.logger.debug(`[${this.platformId}] Submit button candidate not found by any primary strategy on this poll.`);
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
   * Checks if the Grok editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.value || '').trim() === '';
  }

}

export default GrokPlatform;