// src/platforms/implementations/mistral-platform.js
import BasePlatform from '../platform-base.js';

class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }

  /**
   * Provides an array of CSS selectors for finding Mistral's editor element.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getEditorSelectors() {
    return [
      'textarea[name="message.text"]', // Primary name attribute selector
      'textarea[placeholder*="Send a message" i]', // Placeholder (case-insensitive)
      'textarea[placeholder*="Envoyer un message" i]', // French placeholder
      // Fallback class-based selector (less stable)
      'textarea.border-default.ring-offset-background',
    ];
  }

  /**
   * Provides an array of CSS selectors for finding Mistral's submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   */
  _getSubmitButtonSelectors() {
    return [
      // Primary: Targets the button containing the specific SVG icon by its ID.
      'button[type="submit"]:has(svg[id="a"])',

      // Secondary Fallback: Targets a submit button with a class that might indicate its primary action state.
      'button[type="submit"][class*="bg-state-primary"]',

      // Tertiary Fallback (less reliable due to localization):
      // Targets a submit button that has an aria-label (any aria-label).
      // The actual content of the aria-label is not checked here, only its presence.
      // The readiness check in platform-base.js will handle aria-disabled.
      'button[type="submit"][aria-label]',
    ];
  }

  /**
   * Override: Insert text into Mistral's editor.
   * Mistral uses a standard textarea, so the base implementation is suitable.
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
    // Standard check for textarea value
    return (editorElement.value || '').trim() === '';
  }
}

export default MistralPlatform;