const BasePlatform = require('../platform-base');

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  findEditorElement() {
    // Updated selector based on actual textarea attributes
    const editor = document.querySelector('textarea[name="message.text"][placeholder*="Demander au Chat"]') || // French placeholder
                   document.querySelector('textarea[name="message.text"][placeholder*="Ask the Chat"]') || // English placeholder
                   document.querySelector('textarea.border-default.ring-offset-background'); // Fallback
    if (!editor) {
        this.logger.error(`[${this.platformId}] Editor element not found using selectors.`);
    }
    return editor;
  }

  findSubmitButton() {
    // More specific selector including aria-label and class structure
    const button = document.querySelector('button[aria-label*="Send question"][class*="bg-inverted"]'); // Match partial class
    if (!button) {
        this.logger.error(`[${this.platformId}] Submit button not found using selector.`);
    }
    return button;
  }

  /**
   * Override: Insert text into Mistral's editor using specific event sequence.
   * @param {HTMLElement} editorElement - The editor element (textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into Mistral editor with specific events`);
      // Focus first to ensure proper state
      editorElement.focus();

      // Set value directly
      editorElement.value = text;

      // Trigger comprehensive set of events to ensure React state updates
      // Use base helper for standard events
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(`[${this.platformId}] Successfully inserted text into Mistral editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text into Mistral editor:`, error);
      return false;
    }
  }

  /**
   * Override: Click Mistral's submit button, ensuring it's enabled and using event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button`);
      // Remove disabled attribute if present
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is initially disabled.`);
        // Keep the enabling attempt logic here...
        this.logger.info(`[${this.platformId}] Attempting to remove 'disabled' attribute.`);
        buttonElement.removeAttribute('disabled');
        // Re-check after attempting to enable
        if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
            this.logger.error(`[${this.platformId}] Submit button remained disabled after attempting to enable.`);
            return false; // Return failure if still disabled
        }
        this.logger.info(`[${this.platformId}] Submit button successfully enabled.`);
      }


      // Create full click simulation
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

module.exports = MistralPlatform;
