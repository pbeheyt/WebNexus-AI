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
   * Find Claude's submit button using more robust strategies.
   * Checks for visibility and enabled state.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    this.logger.info(`[${this.platformId}] Attempting to find submit button...`);

    // Strategy 1: Specific SVG Path within a button
    try {
      const svgPathSelector = 'button svg path[d^="M208.49,120.49"]'; // Start of the path data
      const pathElement = document.querySelector(svgPathSelector);
      if (pathElement) {
        const button = pathElement.closest('button');
        // Check visibility AND ensure it's not disabled
        if (button && this.isVisibleElement(button) && !button.disabled) {
          this.logger.info(`[${this.platformId}] Found submit button using Strategy 1 (SVG Path)`);
          return button;
        } else if (button) {
            this.logger.warn(`[${this.platformId}] Strategy 1: Found button via SVG, but it's hidden or disabled.`, button);
        }
      }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 1 submit button search:`, e); }

    // Strategy 2: Aria Label (Multi-language)
    try {
      const ariaSelectors = [
        'button[aria-label*="Send message" i]', // Case-insensitive English
        'button[aria-label*="Envoyer le message" i]' // Case-insensitive French
        // Add other potential languages if needed
      ];
      for (const selector of ariaSelectors) {
        const button = document.querySelector(selector);
         // Check visibility AND ensure it's not disabled
        if (button && this.isVisibleElement(button) && !button.disabled) {
          this.logger.info(`[${this.platformId}] Found submit button using Strategy 2 (Aria Label: ${selector})`);
          return button;
        } else if (button) {
             this.logger.warn(`[${this.platformId}] Strategy 2: Found button via aria-label (${selector}), but it's hidden or disabled.`, button);
        }
      }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 2 submit button search:`, e); }

    // Strategy 3: Structure and Classes (More specific)
    try {
        // Look for the button with specific classes within the input area's bottom controls
        const button = document.querySelector('div.flex.gap-2\\.5.w-full.items-center button.bg-accent-main-000');
         // Check visibility AND ensure it's not disabled
        if (button && this.isVisibleElement(button) && !button.disabled) {
            this.logger.info(`[${this.platformId}] Found submit button using Strategy 3 (Structure/Classes)`);
            return button;
        } else if (button) {
             this.logger.warn(`[${this.platformId}] Strategy 3: Found button via structure/classes, but it's hidden or disabled.`, button);
        }
    } catch (e) { this.logger.warn(`[${this.platformId}] Error during Strategy 3 submit button search:`, e); }

    this.logger.error(`[${this.platformId}] Submit button not found or is disabled using any strategy.`);
    return null; // Return null if no enabled button is found
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
        // Attempt to enable if possible, otherwise warn
        if (buttonElement.hasAttribute('disabled')) {
           this.logger.warn(`[${this.platformId}] Submit button is disabled, attempting to enable.`);
           buttonElement.disabled = false;
        } else {
           this.logger.warn(`[${this.platformId}] Submit button is aria-disabled.`);
           // Cannot directly change aria-disabled usually, proceed but might fail
        }
        // Re-check after attempting to enable
        if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
            this.logger.error(`[${this.platformId}] Submit button remains disabled.`);
            return false;
        }
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