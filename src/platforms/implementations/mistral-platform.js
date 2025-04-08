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
    return document.querySelector('textarea[name="message.text"][placeholder="Demander au Chat ou @mentionner un agent"]') ||
           document.querySelector('textarea.border-default.ring-offset-background');
  }

  findSubmitButton() {
    // More specific selector including aria-label and class structure
    return document.querySelector('button[aria-label="Send question"].bg-inverted.text-inverted-default');
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
      this.logger.info(`Inserting text into Mistral editor with specific events`);
      // Focus first to ensure proper state
      editorElement.focus();

      // Set value directly
      editorElement.value = text;

      // Trigger comprehensive set of events to ensure React state updates
      // Use base helper for standard events, manually dispatch others if needed
      this._dispatchEvents(editorElement, ['input', 'change']);
      // Additional events previously used: ['keydown', 'keyup', 'keypress']
      // Let's try without them first, add back if necessary
      // ['keydown', 'keyup', 'keypress'].forEach(eventType => {
      //   editorElement.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
      // });


      // Additional blur/focus cycle previously used
      // editorElement.blur();
      // editorElement.focus();
      // Let's try without this first, add back if necessary

      this.logger.info(`Successfully inserted text into Mistral editor.`);
      return true;
    } catch (error) {
      this.logger.error('Error inserting text into Mistral editor:', error);
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
      this.logger.info(`Attempting to click submit button for Mistral`);
      // Remove disabled attribute if present
      if (buttonElement.disabled) {
        this.logger.warn(`Mistral submit button is disabled, attempting to enable.`);
        buttonElement.removeAttribute('disabled');
        // Re-check after attempting to enable
        if (buttonElement.disabled) {
            this.logger.error(`Mistral submit button remained disabled.`);
            return false;
        }
      }
       // Also check aria-disabled just in case
      if (buttonElement.getAttribute('aria-disabled') === 'true') {
         this.logger.warn(`Mistral submit button is aria-disabled.`);
         // Cannot directly change aria-disabled usually, proceed but might fail
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

      this.logger.info(`Successfully clicked submit button for Mistral.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to click submit button for Mistral:`, error);
      return false;
    }
  }
}

module.exports = MistralPlatform;
