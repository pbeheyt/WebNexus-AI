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
   * Find Claude's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    return document.querySelector('p[data-placeholder="How can Claude help you today?"]') || 
           document.querySelector('[contenteditable="true"]');
  }
  
  /**
   * Find Claude's submit button
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    return document.querySelector('button[aria-label="Send message"]') ||
           document.querySelector('button[aria-label="Send Message"]') ||
           document.querySelector('button[type="submit"]') ||
           document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');
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
      this.logger.info(`Inserting text into Claude editor`);
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
        this.logger.warn('Could not focus Claude editor:', focusError);
        // Continue anyway, focus might not be critical
      }

      this.logger.info(`Successfully inserted text into Claude editor.`);
      return true;
    } catch (error) {
      this.logger.error('Error inserting text into Claude editor:', error);
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
      this.logger.info(`Attempting to click submit button for Claude with event sequence`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        // Attempt to enable if possible, otherwise warn
        if (buttonElement.hasAttribute('disabled')) {
           this.logger.warn(`Claude submit button is disabled, attempting to enable.`);
           buttonElement.disabled = false;
        } else {
           this.logger.warn(`Claude submit button is aria-disabled.`);
           // Cannot directly change aria-disabled usually, proceed but might fail
        }
        // Re-check after attempting to enable
        if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
            this.logger.error(`Claude submit button remains disabled.`);
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

      this.logger.info(`Successfully clicked submit button for Claude.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to click submit button for Claude:`, error);
      return false;
    }
  }
}

module.exports = ClaudePlatform;
