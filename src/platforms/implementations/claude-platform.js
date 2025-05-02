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
        if (editor && this.isVisibleElement(editor)) {
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
        if (editor && this.isVisibleElement(editor)) {
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
        if (this.isVisibleElement(editor)) {
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

    this.logger.error(
      `[${this.platformId}] Editor element not found using any strategy.`
    );
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
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.getAttribute('aria-hidden') !== 'true' &&
      rect.width > 0 &&
      rect.height > 0;

    if (!isVisible) {
      this.logger.debug(
        `[${this.platformId}] Element failed visibility check:`,
        { element, style, rect }
      );
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
    const isDisabled =
      button.disabled || button.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
      this.logger.debug(`[${this.platformId}] Button is disabled:`, button);
    }
    return !isDisabled;
  }

  /**
   * Find Claude's submit button using more robust strategies.
   * Checks for visibility and enabled state. Returns null if checks fail, allowing retry.
   * @returns {HTMLElement|null} The submit button or null if not found/ready
   */
  findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find submit button using selector...`
    );

    const selector = 'button[aria-label*="message" i] svg';
    let buttonElement = null;

    try {
      const svgElement = document.querySelector(selector);
      if (svgElement) {
        buttonElement = svgElement.closest('button');
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during submit button search with selector (${selector}):`,
        e
      );
      return null; // Return null on error
    }

    // Check if the button element itself was found
    if (!buttonElement) {
      // Log error only if the element wasn't found by the selector *on this attempt*
      this.logger.error(
        `[${this.platformId}] Submit button element not found using selector (${selector}) on this attempt.`
      );
      return null;
    }

    // If button element is found, perform checks
    this.logger.info(
      `[${this.platformId}] Found button element via selector. Performing visibility and enabled checks...`
    );
    const isEnabled = this._isButtonEnabled(buttonElement);
    const isVisible = this.isVisibleElement(buttonElement);

    if (isEnabled && isVisible) {
      this.logger.info(
        `[${this.platformId}] Found valid (visible and enabled) submit button.`
      );
      return buttonElement; // Return the valid button
    } else {
      // Log detailed warning if checks fail, but still return null for retry mechanism
      this.logger.warn(
        `[${this.platformId}] Button element found, but failed checks: Visible=${isVisible}, Enabled=${isEnabled}. Returning null for retry.`,
        { element: buttonElement }
      );
      return null; // IMPORTANT: Return null so platform-base retry logic continues
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
      this.logger.info(
        `[${this.platformId}] Inserting text into Claude editor`
      );
      // Clear existing content
      editorElement.innerHTML = '';

      // Split the text into lines and create paragraphs
      const lines = text.split('\n');

      lines.forEach((line, _index) => {
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
        this.logger.warn(
          `[${this.platformId}] Could not focus Claude editor:`,
          focusError
        );
        // Continue anyway, focus might not be critical
      }

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into Claude editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into Claude editor:`,
        error
      );
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
      this.logger.info(
        `[${this.platformId}] Attempting to click submit button with event sequence`
      );
      // Dispatch multiple events to simulate a real click
      ['mousedown', 'mouseup', 'click'].forEach((eventType) => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: eventType === 'mousedown' ? 1 : 0
        });
        buttonElement.dispatchEvent(event);
      });
      this.logger.info(
        `[${this.platformId}] Successfully dispatched click events.`
      );
      return true; // Indicate dispatch attempt finished without error
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to dispatch click events:`,
        error
      );
      return false; // Indicate the dispatch attempt itself threw an error
    }
  }

  /**
   * Verify submission by checking if the submit button is disabled or the editor is cleared.
   * @returns {Promise<boolean>} True if verification passes, false otherwise.
   * @protected
   * @override
   */
  async _verifySubmissionAttempted() {
    this.logger.info(`[${this.platformId}] Starting post-click verification...`);
    let isButtonDisabled = false;
    let isEditorEmpty = false;

    // Check 1: Submit Button Disabled
    try {
      const submitButton = this.findSubmitButton(); // Re-find the button
      if (submitButton && (submitButton.disabled || submitButton.getAttribute('aria-disabled') === 'true')) {
        isButtonDisabled = true;
        this.logger.info(`[${this.platformId}] Verification: Submit button is disabled.`);
      } else if (submitButton) {
        this.logger.info(`[${this.platformId}] Verification: Submit button is enabled.`);
      } else {
        this.logger.warn(`[${this.platformId}] Verification: Could not re-find submit button.`);
        // Consider this potentially okay if the button disappears on submit
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking submit button state:`, error);
    }

    // Check 2: Editor Cleared/Reset (Platform-Specific Nuances Might Apply)
    try {
      const editorElement = this.findEditorElement(); // Re-find the editor
      if (editorElement) {
        // Claude uses contenteditable div
        const editorContent = editorElement.textContent || editorElement.innerText;
        if (editorContent === null || editorContent.trim() === '') {
           isEditorEmpty = true;
           this.logger.info(`[${this.platformId}] Verification: Editor appears empty.`);
        } else {
           this.logger.info(`[${this.platformId}] Verification: Editor is not empty. Content: "${editorContent.substring(0, 50)}..."`);
        }
      } else {
         this.logger.warn(`[${this.platformId}] Verification: Could not re-find editor element.`);
         // This might be okay if the editor is replaced after submission
      }
    } catch (error) {
       this.logger.error(`[${this.platformId}] Verification: Error checking editor state:`, error);
    }

    // Determine overall success
    const verificationSuccess = isButtonDisabled || isEditorEmpty;

    if (verificationSuccess) {
      this.logger.info(`[${this.platformId}] Post-click verification PASSED.`);
    } else {
      this.logger.warn(`[${this.platformId}] Post-click verification FAILED (Button enabled AND Editor not empty).`);
    }

    return verificationSuccess;
  }
}

export default ClaudePlatform;
