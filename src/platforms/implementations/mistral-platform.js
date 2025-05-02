import BasePlatform from '../platform-base.js';

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  findEditorElement() {
    const editor =
      document.querySelector(
        'textarea[name="message.text"][placeholder*="Demander au Chat"]'
      ) || // French placeholder
      document.querySelector(
        'textarea[name="message.text"][placeholder*="Ask the Chat"]'
      ) || // English placeholder
      document.querySelector('textarea.border-default.ring-offset-background'); // Fallback
    if (!editor) {
      this.logger.error(
        `[${this.platformId}] Editor element not found using selectors.`
      );
    }
    return editor;
  }

  findSubmitButton() {
    // More specific selector including aria-label and class structure
    const button = document.querySelector(
      'button[aria-label*="Send question"][class*="bg-inverted"]'
    ); // Match partial class
    if (!button) {
      this.logger.error(
        `[${this.platformId}] Submit button not found using selector.`
      );
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
      this.logger.info(
        `[${this.platformId}] Inserting text into Mistral editor with specific events`
      );
      // Focus first to ensure proper state
      editorElement.focus();

      // Set value directly
      editorElement.value = text;

      // Trigger comprehensive set of events to ensure React state updates
      // Use base helper for standard events
      this._dispatchEvents(editorElement, ['input', 'change']);

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into Mistral editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into Mistral editor:`,
        error
      );
      return false;
    }
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
