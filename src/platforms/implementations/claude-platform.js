// src/platforms/implementations/claude-platform.js
const BasePlatform = require('../platform-base');

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
 * Helper method to determine if an element is visible and interactive
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} True if the element is visible and interactive
 */
  isVisibleElement(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.getAttribute('aria-hidden') !== 'true' &&
            rect.width > 0 && rect.height > 0; // Check for actual dimensions
  }

  /**
   * Find Claude's editor element using more robust strategies.
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(`[${this.platformId}] Attempting to find editor element...`);

    // Strategy 1: Look for contenteditable inside the known wrapper
    try {
      const wrapper = document.querySelector('div[aria-label*="Claude"]'); // Find wrapper by aria-label
      if (wrapper) {
        const editor = wrapper.querySelector('div[contenteditable="true"].ProseMirror');
        if (editor && this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 1 (Wrapper + Contenteditable)`);
          return editor;
        }
      }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 1 editor search:`, e); }

    // Strategy 2: Look for contenteditable containing the placeholder paragraph
    try {
      // Use partial match for placeholder text to handle language variations
      const placeholderParagraph = document.querySelector('p[data-placeholder*="Claude"]');
      if (placeholderParagraph) {
        const editor = placeholderParagraph.closest('div[contenteditable="true"].ProseMirror');
        if (editor && this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 2 (Placeholder Parent)`);
          return editor;
        }
      }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 2 editor search:`, e); }

    // Strategy 3: Find the most prominent contenteditable div
    try {
      const editors = document.querySelectorAll('div[contenteditable="true"].ProseMirror');
      // Find the first one that's visible (usually the main input)
      for (const editor of editors) {
        if (this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 3 (Visible Contenteditable)`);
          return editor;
        }
      }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 3 editor search:`, e); }


    this.logger.error(`[${this.platformId}] Editor element not found using any strategy.`);
    return null;
  }

  /**
   * Helper method to determine if an element is visible and interactive
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} True if the element is visible and interactive
   */
  isVisibleElement(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const isVisible = style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.getAttribute('aria-hidden') !== 'true' &&
      rect.width > 0 && rect.height > 0;

    if (!isVisible) {
        this.logger.debug(`[${this.platformId}] Element failed visibility check:`, { element, style, rect });
    }
    return isVisible;
  }

  /**
   * Check if a button element is currently enabled and ready for interaction.
   * @param {HTMLElement} button - The button element to check.
   * @returns {boolean} True if the button is enabled, false otherwise.
   * @private
   */
  _isButtonEnabled(button) {
    if (!button) return false;
    const isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
        this.logger.debug(`[${this.platformId}] Button is disabled:`, button);
    }
    return !isDisabled;
  }

  /**
   * Find Claude's submit button using more robust strategies.
   * Checks for visibility and enabled state.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    this.logger.info(`[${this.platformId}] Attempting to find submit button using selector...`);

    // Strategy: Find button by aria-label containing "message" (case-insensitive) that has an SVG inside
    const selector = 'button[aria-label*="message" i] svg';
    let button = null;

    try {
      const svgElement = document.querySelector(selector);
      if (svgElement) {
        button = svgElement.closest('button');
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during submit button search:`, e);
      return null;
    }

    // Check if the button was found and if it's ready
    if (button && this._isButtonEnabled(button) && this.isVisibleElement(button)) {
      this.logger.info(`[${this.platformId}] Found valid submit button using selector.`);
      return button;
    } else if (button) {
      // Log why it wasn't returned (disabled or hidden)
      this.logger.warn(`[${this.platformId}] Found button element with selector, but it's not enabled or visible.`, {
          isDisabled: !this._isButtonEnabled(button),
          isHidden: !this.isVisibleElement(button),
          element: button
      });
      return null; // Return null if found but not ready
    } else {
      this.logger.error(`[${this.platformId}] Submit button not found using selector (${selector}).`);
      return null;
    }
  }

  /**
   * Override: Insert text into Claude's contenteditable editor.
   * @param {HTMLElement} editorElement - The editor element.
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into Claude editor`);
      // Clear existing content
      editorElement.innerHTML = '';

      // Split the text into lines and create paragraphs
      const lines = text.split('\n');

      lines.forEach((line, index) => {
        const p = document.createElement('p');
        // Use textContent to prevent potential XSS if text contained HTML
        p.textContent = line || '\u00A0'; // Use non-breaking space for empty lines to maintain structure
        editorElement.appendChild(p);

        // Add a line break element between paragraphs for visual spacing if needed by Claude's editor
        // if (index < lines.length - 1) {
        //   editorElement.appendChild(document.createElement('br'));
        // }
      });

      // Remove common empty state classes (might not be strictly necessary after setting innerHTML)
      editorElement.classList.remove('is-empty', 'is-editor-empty');

      // Trigger input event using the base class helper
      this._dispatchEvents(editorElement, ['input']);

      // Try to focus the editor
      try {
        editorElement.focus();
      } catch (focusError) {
        this.logger.warn(`[${this.platformId}] Could not focus Claude editor:`, focusError);
        // Continue anyway, focus might not be critical
      }

      this.logger.info(`[${this.platformId}] Successfully inserted text into Claude editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text into Claude editor:`, error);
      return false;
    }
  }

  /**
   * Override: Click Claude's submit button using a more robust event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button for Claude with event sequence`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is initially disabled.`);
        // Keep the enabling attempt logic here...
        if (buttonElement.hasAttribute('disabled')) {
           this.logger.info(`[${this.platformId}] Attempting to remove 'disabled' attribute.`);
           buttonElement.disabled = false;
        }
        if (buttonElement.hasAttribute('aria-disabled')) {
           this.logger.info(`[${this.platformId}] Attempting to remove 'aria-disabled' attribute.`);
           buttonElement.removeAttribute('aria-disabled');
        }
        // Re-check after attempting to enable
        if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
            this.logger.error(`[${this.platformId}] Submit button remained disabled after attempting to enable.`);
            return false; // Return failure if still disabled
        }
        this.logger.info(`[${this.platformId}] Submit button successfully enabled.`);
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

      this.logger.info(`[${this.platformId}] Successfully clicked submit button.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to click submit button:`, error);
      return false;
    }
  }
}

module.exports = ClaudePlatform;
