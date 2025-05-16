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
      // Primary selector: button with type="submit" containing an SVG (send icon)
      'button[type="submit"]:has(svg)',
      // Fallback selector: button with type="submit" and a class indicating inverted color
      'button[type="submit"][class*="bg-inverted"]',
      // Aria-label based selector
      'button[type="submit"][aria-label*="Send" i]',
      'button[type="submit"][aria-label*="Envoyer" i]', // French
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