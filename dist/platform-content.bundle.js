/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/platforms/implementations/chatgpt-platform.js":
/*!***********************************************************!*\
  !*** ./src/platforms/implementations/chatgpt-platform.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/implementations/chatgpt-platform.js
const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");

/**
 * ChatGPT AI platform implementation
 */
class ChatGptPlatform extends BasePlatform {
  constructor() {
    super('chatgpt');
  }

  /**
   * Check if the current page is ChatGPT
   * @returns {boolean} True if on ChatGPT
   */
  isCurrentPlatform() {
    return window.location.href.includes('chatgpt.com');
  }

  /**
   * Find ChatGPT's editor element (the contenteditable div)
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(`[${this.platformId}] Attempting to find editor element (#prompt-textarea)...`);
    // The div now has the ID
    const editor = document.querySelector('div#prompt-textarea[contenteditable="true"]');
    if (!editor) {
      this.logger.warn(`[${this.platformId}] Editor element (div#prompt-textarea) not found.`);
    } else {
      this.logger.info(`[${this.platformId}] Found editor element (div#prompt-textarea).`);
    }
    return editor;
  }

  /**
   * Find ChatGPT's submit button using ID and data-testid.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // This method remains the same as the previous version, targeting the final button state
    this.logger.info(`[${this.platformId}] Attempting to find submit button (post-wait/text insertion)...`);
    let button = null;

    // Strategy 1: Find by ID
    button = document.querySelector('#composer-submit-button');
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using ID #composer-submit-button.`);
      return button;
    }

    // Strategy 2: Find by data-testid
    button = document.querySelector('button[data-testid="send-button"]');
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using data-testid="send-button".`);
      return button;
    }

    // Strategy 3: Find by aria-label
    const ariaSelector = 'button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
    button = document.querySelector(ariaSelector);
    if (button) {
      this.logger.info(`[${this.platformId}] Found button using aria-label.`);
      return button;
    }
    this.logger.error(`[${this.platformId}] Submit button not found using any strategy (ID, data-testid, aria-label).`);
    return null;
  }

  /**
   * Override: Insert text into ChatGPT's contenteditable div editor.
   * @param {HTMLElement} editorElement - The editor element (div#prompt-textarea).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into ChatGPT contenteditable editor`);

      // 1. Focus the editor element
      editorElement.focus();

      // 2. Clear existing content (usually a <p><br></p> or similar placeholder)
      editorElement.innerHTML = '';

      // 3. Create and append paragraphs for each line of text
      const lines = text.split('\n');
      lines.forEach(line => {
        const p = document.createElement('p');
        // Use textContent to prevent HTML injection issues
        // Use non-breaking space for empty lines to maintain structure in contenteditable
        p.textContent = line || '\u00A0';
        editorElement.appendChild(p);
      });

      // 4. Dispatch events to notify the framework (React) of the change
      // 'input' is crucial for React state updates in contenteditable
      this._dispatchEvents(editorElement, ['input', 'change']);
      this.logger.info(`[${this.platformId}] Successfully inserted text into contenteditable editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text into contenteditable editor:`, error);
      return false;
    }
  }

  /**
   * Override: Click ChatGPT's submit button using a more robust event sequence.
   * Includes pre-click check for disabled state.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button for ChatGPT with event sequence`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is disabled right before click attempt.`);
        return false;
      }
      this.logger.info(`[${this.platformId}] Dispatching click events sequence.`);
      ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: eventType === 'mousedown' ? 1 : 0
        });
        buttonElement.dispatchEvent(event);
      });
      this.logger.info(`[${this.platformId}] Successfully dispatched click events.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to click submit button:`, error);
      return false;
    }
  }
}
module.exports = ChatGptPlatform;

/***/ }),

/***/ "./src/platforms/implementations/claude-platform.js":
/*!**********************************************************!*\
  !*** ./src/platforms/implementations/claude-platform.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/implementations/claude-platform.js
const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");

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
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && element.getAttribute('aria-hidden') !== 'true' && rect.width > 0 && rect.height > 0; // Check for actual dimensions
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
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 1 editor search:`, e);
    }

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
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 2 editor search:`, e);
    }

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
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 3 editor search:`, e);
    }
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
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && element.getAttribute('aria-hidden') !== 'true' && rect.width > 0 && rect.height > 0;
    if (!isVisible) {
      this.logger.debug(`[${this.platformId}] Element failed visibility check:`, {
        element,
        style,
        rect
      });
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
      this.logger.warn(`[${this.platformId}] Submit button not found using selector (${selector}).`);
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

/***/ }),

/***/ "./src/platforms/implementations/deepseek-platform.js":
/*!************************************************************!*\
  !*** ./src/platforms/implementations/deepseek-platform.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/implementations/deepseek-platform.js
const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");

/**
 * DeepSeek AI platform implementation
 */
class DeepSeekPlatform extends BasePlatform {
  constructor() {
    super('deepseek');
  }

  /**
   * Check if the current page is DeepSeek
   * @returns {boolean} True if on DeepSeek
   */
  isCurrentPlatform() {
    return window.location.href.includes('chat.deepseek.com');
  }

  /**
   * Find DeepSeek's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    // Keep existing selectors with fallbacks
    return document.querySelector('#chat-input') || document.querySelector('.c92459f0');
  }

  /**
   * Find DeepSeek's submit button with enhanced selector resilience
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // Primary selectors - target specific UI patterns unique to the send button
    const sendButton =
    // Target by class combinations (current approach with additions)
    document.querySelector('div[role="button"]._7436101.bcc55ca1') || document.querySelector('div[role="button"]._7436101') || document.querySelector('div[role="button"] ._6f28693')?.closest('div[role="button"]') ||
    // Position-based fallbacks (rightmost button in the input container)
    document.querySelector('.ec4f5d61 > div[role="button"]:last-child') || document.querySelector('.bf38813a > div:last-child > div[role="button"]') ||
    // Attribute-based fallbacks
    document.querySelector('div[role="button"][aria-disabled]') ||
    // Icon-based detection
    document.querySelector('div[role="button"] .ds-icon svg[width="14"][height="16"]')?.closest('div[role="button"]') ||
    // Original fallbacks
    document.querySelector('div[role="button"].f6d670.bcc55ca1') || document.querySelector('div[role="button"].f6d670');
    return sendButton;
  }

  /**
   * Insert text into DeepSeek's editor and submit
   * @param {string} text - The text to insert
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    if (!editorElement) {
      this.logger.error(`[${this.platformId}] Textarea element not found`);
      return false;
    }
    try {
      // Focus on the textarea
      editorElement.focus();

      // Set the value directly
      editorElement.value = text;

      // Trigger input event to activate the UI
      const inputEvent = new Event('input', {
        bubbles: true
      });
      editorElement.dispatchEvent(inputEvent);

      // Wait a short moment for the UI to update
      return new Promise(resolve => {
        setTimeout(() => {
          // Look for the send button
          const sendButton = this.findSubmitButton();
          if (!sendButton) {
            // Enhanced logging to help troubleshoot button selector issues
            this.logger.error(`[${this.platformId}] Send button not found. DOM structure may have changed.`);
            this.logger.info(`[${this.platformId}] Available button elements:`, document.querySelectorAll('div[role="button"]').length);
            resolve(false);
            return;
          }

          // Check if button is disabled
          const isDisabled = sendButton.getAttribute('aria-disabled') === 'true';
          if (isDisabled) {
            this.logger.warn(`[${this.platformId}] Send button is currently disabled`);
            // Try enabling the button by triggering another input event
            editorElement.dispatchEvent(inputEvent);

            // Wait a bit more and try again
            setTimeout(() => {
              const updatedButton = this.findSubmitButton();
              if (updatedButton && updatedButton.getAttribute('aria-disabled') !== 'true') {
                updatedButton.click();
                this.logger.info(`[${this.platformId}] Text submitted successfully after enabling button`);
                resolve(true);
              } else {
                this.logger.error(`[${this.platformId}] Send button remained disabled after retry`);
                resolve(false);
              }
            }, 300);
          } else {
            // Click the send button if it's not disabled
            sendButton.click();
            this.logger.info(`[${this.platformId}] Text submitted successfully`);
            resolve(true);
          }
        }, 500);
      });
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text:`, error);
      return false;
    }
  }
  // No override needed for _insertTextIntoEditor - default implementation works
  // No override needed for _clickSubmitButton - default implementation works
}
module.exports = DeepSeekPlatform;

/***/ }),

/***/ "./src/platforms/implementations/gemini-platform.js":
/*!**********************************************************!*\
  !*** ./src/platforms/implementations/gemini-platform.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/implementations/gemini-platform.js
const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");
class GeminiPlatform extends BasePlatform {
  constructor() {
    super('gemini');
  }
  isCurrentPlatform() {
    return window.location.hostname.includes('gemini.google.com');
  }
  findEditorElement() {
    // Exact selector based on provided HTML
    return document.querySelector('div.ql-editor[contenteditable="true"][aria-multiline="true"]');
  }
  findSubmitButton() {
    // Exact selector based on provided HTML
    return document.querySelector('button.send-button');
  }

  /**
   * Override: Insert text into Gemini's contenteditable editor (Quill).
   * @param {HTMLElement} editorElement - The editor element (div.ql-editor).
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into Gemini editor (Quill)`);
      // Focus the editor
      editorElement.focus();

      // Clear existing content and set new content
      editorElement.innerHTML = '';

      // Create paragraph for each line
      const paragraphs = text.split('\n');
      paragraphs.forEach(paragraph => {
        const p = document.createElement('p');
        if (paragraph.trim()) {
          p.textContent = paragraph;
        } else {
          // Empty paragraph with br for line breaks
          p.appendChild(document.createElement('br'));
        }
        editorElement.appendChild(p);
      });

      // Remove placeholder class if present
      if (editorElement.classList.contains('ql-blank')) {
        editorElement.classList.remove('ql-blank');
      }

      // Trigger input events using base class helper
      this._dispatchEvents(editorElement, ['input', 'change']);
      this.logger.info(`[${this.platformId}] Successfully inserted text into Gemini editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error inserting text into Gemini editor:`, error);
      return false;
    }
  }

  /**
   * Override: Click Gemini's submit button, ensuring it's enabled and using event sequence.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button`);
      // Check and potentially remove disabled state
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is disabled, attempting to enable.`);
        if (buttonElement.hasAttribute('disabled')) {
          buttonElement.disabled = false;
        }
        if (buttonElement.hasAttribute('aria-disabled')) {
          buttonElement.removeAttribute('aria-disabled');
        }
        // Re-check after attempting to enable
        if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
          this.logger.error(`[${this.platformId}] Submit button remained disabled.`);
          return false;
        }
      }

      // Click the button with multiple events
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
module.exports = GeminiPlatform;

/***/ }),

/***/ "./src/platforms/implementations/grok-platform.js":
/*!********************************************************!*\
  !*** ./src/platforms/implementations/grok-platform.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/implementations/grok-platform.js
const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");

/**
 * Grok AI platform implementation
 */
class GrokPlatform extends BasePlatform {
  constructor() {
    super('grok');
  }
  isCurrentPlatform() {
    // Keep this simple and reliable
    return window.location.hostname === 'grok.com';
  }

  /**
   * Helper method to determine if an element is visible and interactive
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} True if the element is visible and interactive
   */
  isVisibleElement(element) {
    if (!element) return false;

    // Check for explicit hidden attributes or styles
    if (element.getAttribute('aria-hidden') === 'true' || element.style.visibility === 'hidden' || element.style.display === 'none') {
      this.logger.warn(`[${this.platformId}] Element hidden by attribute/style:`, element);
      return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') {
      this.logger.warn(`[${this.platformId}] Element hidden by computed style: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}, pointerEvents=${style.pointerEvents}`, element);
      return false;
    }

    // Check if element has zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Allow zero height for textareas which might start small
      if (element.tagName !== 'TEXTAREA') {
        this.logger.warn(`[${this.platformId}] Element has zero dimensions: width=${rect.width}, height=${rect.height}`, element);
        return false;
      } else {
        this.logger.info(`[${this.platformId}] Textarea has zero height, allowing as potentially visible.`);
      }
    }

    // Check if element is practically off-screen (adjust threshold as needed)
    const threshold = 5; // Small pixel threshold
    if (rect.right < threshold || rect.bottom < threshold || rect.left > window.innerWidth - threshold || rect.top > window.innerHeight - threshold) {
      this.logger.warn(`[${this.platformId}] Element is positioned off-screen:`, rect, element);
      return false;
    }

    // Check if the element or its parent is hidden via overflow
    let parent = element.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.overflow === 'hidden' || parentStyle.overflowX === 'hidden' || parentStyle.overflowY === 'hidden') {
        const parentRect = parent.getBoundingClientRect();
        // Check if the element is outside the parent's visible bounds
        if (rect.top < parentRect.top || rect.bottom > parentRect.bottom || rect.left < parentRect.left || rect.right > parentRect.right) {
          this.logger.warn(`[${this.platformId}] Element hidden by parent overflow:`, element, parent);
          // return false; // Be cautious with this check, might be too strict
        }
      }
      if (parent === document.body) break;
      parent = parent.parentElement;
    }
    return true;
  }

  /**
   * Find the active Grok editor element using more robust strategies.
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(`[${this.platformId}] Attempting to find editor element...`);

    // --- Strategy 1: Query Bar Parent + Attributes ---
    try {
      const queryBar = document.querySelector('div.query-bar'); // Find the main input container
      if (queryBar) {
        // More specific check first
        const editor = queryBar.querySelector('textarea[dir="auto"][style*="resize: none"]');
        if (editor && this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 1a (Query Bar + Attributes)`);
          return editor;
        }
        // Simpler version within query bar if the style one fails
        const simplerEditor = queryBar.querySelector('textarea[dir="auto"]');
        if (simplerEditor && this.isVisibleElement(simplerEditor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 1b (Query Bar + dir=auto)`);
          return simplerEditor;
        }
      } else {
        this.logger.warn(`[${this.platformId}] Strategy 1: Query Bar container not found.`);
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 1 editor search:`, e);
    }

    // --- Strategy 2: Attributes Only ---
    try {
      const textareas = document.querySelectorAll('textarea[dir="auto"][style*="resize: none"]');
      for (const editor of textareas) {
        if (this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 2 (Attributes Only)`);
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 2 editor search:`, e);
    }

    // --- Strategy 3: Broader dir=auto ---
    try {
      const textareasDirAuto = document.querySelectorAll('textarea[dir="auto"]');
      for (const editor of textareasDirAuto) {
        if (this.isVisibleElement(editor)) {
          this.logger.info(`[${this.platformId}] Found editor using Strategy 3 (Broader dir=auto)`);
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 3 editor search:`, e);
    }

    // --- Strategy 4: Fallback using aria-label ---
    try {
      const ariaLabelSelector = 'textarea[aria-label*="Ask Grok"], textarea[aria-label*="Demander"]'; // Match English/French
      const editor = document.querySelector(ariaLabelSelector);
      if (editor && this.isVisibleElement(editor)) {
        this.logger.info(`[${this.platformId}] Found editor using Strategy 4 (Aria Label)`);
        return editor;
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 4 editor search:`, e);
    }
    this.logger.error(`[${this.platformId}] Editor element not found using any strategy.`);
    return null;
  }

  /**
   * Find the Grok submit button using more robust strategies.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    this.logger.info(`[${this.platformId}] Attempting to find submit button...`);

    // --- Strategy 1: Specific SVG Path ---
    try {
      // Look for the button containing the specific SVG path for the send arrow
      const svgPathSelector = 'button[type="submit"] svg path[d^="M5 11L12 4"]';
      const pathElement = document.querySelector(svgPathSelector);
      if (pathElement) {
        const button = pathElement.closest('button[type="submit"]');
        // Check visibility *and* ensure it's not disabled
        if (button && this.isVisibleElement(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
          this.logger.info(`[${this.platformId}] Found submit button using Strategy 1 (SVG Path)`);
          return button;
        } else if (button) {
          this.logger.warn(`[${this.platformId}] Strategy 1: Found button via SVG, but it's hidden or disabled.`, button);
        }
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 1 submit button search:`, e);
    }

    // --- Strategy 2: Structural Position ---
    // Look for the button within the absolute positioned bottom bar, in the ml-auto container
    try {
      const bottomBarSelector = 'form div[class*="absolute inset-x-0 bottom-0"]'; // Anchor within the form
      const bottomBar = document.querySelector(bottomBarSelector);
      if (bottomBar) {
        // Look for the button within the right-aligned container
        const submitButton = bottomBar.querySelector('div[class*="ml-auto"] button[type="submit"]');
        // Check visibility *and* ensure it's not disabled
        if (submitButton && this.isVisibleElement(submitButton) && !submitButton.disabled && submitButton.getAttribute('aria-disabled') !== 'true') {
          this.logger.info(`[${this.platformId}] Found submit button using Strategy 2 (Structural Position)`);
          return submitButton;
        } else if (submitButton) {
          this.logger.warn(`[${this.platformId}] Strategy 2: Found button via structure, but it's hidden or disabled.`, submitButton);
        }
      } else {
        this.logger.warn(`[${this.platformId}] Strategy 2: Bottom action bar not found.`);
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 2 submit button search:`, e);
    }

    // --- Strategy 3: Aria Label (Fallback) ---
    try {
      const ariaSelectors = ['button[type="submit"][aria-label*="Submit"]',
      // English
      'button[type="submit"][aria-label*="Soumettre"]' // French
      // Add other languages if necessary
      ];
      for (const selector of ariaSelectors) {
        const button = document.querySelector(selector);
        // Check visibility *and* ensure it's not disabled
        if (button && this.isVisibleElement(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
          this.logger.info(`[${this.platformId}] Found submit button using Strategy 3 (Aria Label: ${selector})`);
          return button;
        } else if (button) {
          this.logger.warn(`[${this.platformId}] Strategy 3: Found button via aria-label (${selector}), but it's hidden or disabled.`, button);
        }
      }
    } catch (e) {
      this.logger.warn(`[${this.platformId}] Error during Strategy 3 submit button search:`, e);
    }
    this.logger.error(`[${this.platformId}] Submit button not found using any strategy.`);
    return null;
  }
}
module.exports = GrokPlatform;

/***/ }),

/***/ "./src/platforms/implementations/mistral-platform.js":
/*!***********************************************************!*\
  !*** ./src/platforms/implementations/mistral-platform.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BasePlatform = __webpack_require__(/*! ../platform-base */ "./src/platforms/platform-base.js");
class MistralPlatform extends BasePlatform {
  constructor() {
    super('mistral');
  }
  isCurrentPlatform() {
    return window.location.hostname === 'chat.mistral.ai';
  }
  findEditorElement() {
    // Updated selector based on actual textarea attributes
    return document.querySelector('textarea[name="message.text"][placeholder*="Demander au Chat"]') ||
    // French placeholder
    document.querySelector('textarea[name="message.text"][placeholder*="Ask the Chat"]') ||
    // English placeholder
    document.querySelector('textarea.border-default.ring-offset-background'); // Fallback
  }
  findSubmitButton() {
    // More specific selector including aria-label and class structure
    return document.querySelector('button[aria-label*="Send question"][class*="bg-inverted"]'); // Match partial class
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
      if (buttonElement.disabled) {
        this.logger.warn(`[${this.platformId}] Submit button is disabled, attempting to enable.`);
        buttonElement.removeAttribute('disabled');
        // Re-check after attempting to enable
        if (buttonElement.disabled) {
          this.logger.error(`[${this.platformId}] Submit button remained disabled.`);
          return false;
        }
      }
      // Also check aria-disabled just in case
      if (buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is aria-disabled.`);
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

/***/ }),

/***/ "./src/platforms/platform-base.js":
/*!****************************************!*\
  !*** ./src/platforms/platform-base.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/platform-base.js
const PlatformInterface = __webpack_require__(/*! ./platform-interface */ "./src/platforms/platform-interface.js");
const STORAGE_KEYS = (__webpack_require__(/*! ../shared/constants */ "./src/shared/constants.js").STORAGE_KEYS);
const logger = (__webpack_require__(/*! ../shared/logger */ "./src/shared/logger.js").platform);
const {
  robustSendMessage
} = __webpack_require__(/*! ../shared/utils/message-utils */ "./src/shared/utils/message-utils.js");

/**
 * Base implementation with shared functionality for all AI platforms
 */
class BasePlatform extends PlatformInterface {
  /**
   * @param {string} platformId - Unique identifier for the platform
   */
  constructor(platformId) {
    super();
    this.platformId = platformId;
    this.logger = logger;
    this.maxRetries = 20;
    this.processingStarted = false;
  }

  /**
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.isCurrentPlatform()) {
      this.logger.info(`[${this.platformId}] Not on platform, exiting`);
      return;
    }
    this.logger.info(`[${this.platformId}] Initializing platform integration`);
    if (document.readyState === 'complete') {
      this.observeForEditor();
    } else {
      window.addEventListener('load', () => {
        this.observeForEditor();
      });
    }
  }

  /**
   * Use MutationObserver to wait for editor element to be available
   */
  observeForEditor() {
    const observerConfig = {
      childList: true,
      subtree: true
    };
    let retryCount = 0;
    const observer = new MutationObserver(() => {
      const editorElement = this.findEditorElement();
      if (editorElement && !this.processingStarted) {
        this.logger.info(`[${this.platformId}] Interface ready, starting processing`);
        this.processingStarted = true;
        observer.disconnect();
        this.processContent();
      } else {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          observer.disconnect();
          this.logger.error(`[${this.platformId}] Failed to find interface elements after maximum retries`);
          robustSendMessage({
            action: 'notifyError',
            error: `Could not interact with ${this.platformId} interface. The page may still be loading or the interface may have changed.`
          }).catch(err => this.logger.error('Failed to send notifyError message:', err));
        }
      }
    });
    observer.observe(document.body, observerConfig);
  }

  /**
   * Utility method to pause execution.
   * @param {number} ms - Milliseconds to wait.
   * @returns {Promise<void>}
   * @protected
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility method to dispatch events on an element.
   * @param {HTMLElement} element - The target element.
   * @param {string[]} eventTypes - Array of event names (e.g., ['input', 'change']).
   * @protected
   */
  _dispatchEvents(element, eventTypes) {
    eventTypes.forEach(eventType => {
      const event = new Event(eventType, {
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(event);
    });
  }

  /**
   * Default implementation for inserting text into an editor element.
   * Subclasses should override this if the platform uses a non-standard input (e.g., contenteditable div).
   * @param {HTMLElement} editorElement - The editor element.
   * @param {string} text - The text to insert.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoEditor(editorElement, text) {
    try {
      this.logger.info(`[${this.platformId}] Inserting text into standard input/textarea`);
      editorElement.focus();
      editorElement.value = text;
      this._dispatchEvents(editorElement, ['input', 'change']);
      this.logger.info(`[${this.platformId}] Successfully inserted text into editor.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to insert text into editor:`, error);
      return false;
    }
  }

  /**
   * Default implementation for clicking the submit button.
   * Subclasses should override this if the platform requires a non-standard click simulation.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`[${this.platformId}] Submit button is disabled.`);
        return false;
      }
      buttonElement.click();
      this.logger.info(`[${this.platformId}] Successfully clicked submit button.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to click submit button:`, error);
      return false;
    }
  }

  /**
   * Template Method: Process content from storage, find elements, insert, and submit.
   */
  async processContent() {
    this.logger.info(`[${this.platformId}] Starting template method processContent`);
    chrome.storage.local.get([STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION], async result => {
      try {
        this.logger.info(`[${this.platformId}] Retrieved data from storage`, {
          hasPrompt: !!result[STORAGE_KEYS.PRE_PROMPT],
          hasFormattedContent: !!result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION]
        });
        const prePrompt = result[STORAGE_KEYS.PRE_PROMPT];
        const formattedContentString = result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION];
        if (!prePrompt) {
          throw new Error('Missing prompt data in storage');
        }
        if (!formattedContentString) {
          throw new Error('Missing formatted content data in storage');
        }
        const fullText = this.createStructuredPrompt(prePrompt, formattedContentString);
        this.logger.info(`[${this.platformId}] Combined prompt and content`);

        // --- Template Method Steps ---
        // 1. Find Editor
        const editorElement = this.findEditorElement();
        if (!editorElement) {
          this.logger.error(`[${this.platformId}] Editor element not found.`);
          throw new Error(`Could not find the editor element on ${this.platformId}.`);
        }
        this.logger.info(`[${this.platformId}] Found editor element.`);

        // 2. Insert Text
        const insertSuccess = await this._insertTextIntoEditor(editorElement, fullText);
        if (!insertSuccess) {
          this.logger.error(`[${this.platformId}] Failed to insert text using _insertTextIntoEditor.`);
          throw new Error(`Failed to insert text into the ${this.platformId} editor.`);
        }
        this.logger.info(`[${this.platformId}] Text insertion step completed.`);

        // 3. Wait
        await this._wait(800); // Allow time for UI updates or checks
        this.logger.info(`[${this.platformId}] Wait step completed.`);

        // 4. Find Submit Button
        const submitButton = this.findSubmitButton();
        if (!submitButton) {
          this.logger.error(`[${this.platformId}] Submit button not found.`);
          throw new Error(`Could not find the submit button on ${this.platformId}.`);
        }
        this.logger.info(`[${this.platformId}] Found submit button.`);

        // 5. Click Submit Button
        const clickSuccess = await this._clickSubmitButton(submitButton);
        if (!clickSuccess) {
          this.logger.error(`[${this.platformId}] Failed to click submit button using _clickSubmitButton.`);
          throw new Error(`Failed to click the submit button on ${this.platformId}.`);
        }
        this.logger.info(`[${this.platformId}] Submit button click step completed.`);
        // --- End Template Method Steps ---

        this.logger.info(`[${this.platformId}] Content successfully processed and submitted`);
        // Clear the data after successful processing
        chrome.storage.local.remove([STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION, STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.CONTENT_READY]);
      } catch (error) {
        this.logger.error(`[${this.platformId}] Error during processContent execution:`, error);
        robustSendMessage({
          action: 'notifyError',
          error: `Error interacting with ${this.platformId}: ${error.message}`
        }).catch(err => this.logger.error('Failed to send notifyError message:', err));
        // Optionally clear storage even on error? Depends on desired retry behavior.
        // chrome.storage.local.remove([STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION, STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.CONTENT_READY]);
      }
    });
  }

  /**
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string} formattedContent - The formatted content
   * @returns {string} The full structured prompt
   */
  createStructuredPrompt(prePrompt, formattedContent) {
    // Use a simple structural approach that preserves the entire prePrompt
    return `# INSTRUCTION
${prePrompt}
# EXTRACTED CONTENT
${formattedContent}`;
  }
}
module.exports = BasePlatform;

/***/ }),

/***/ "./src/platforms/platform-factory.js":
/*!*******************************************!*\
  !*** ./src/platforms/platform-factory.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/platforms/platform-factory.js
const ClaudePlatform = __webpack_require__(/*! ./implementations/claude-platform */ "./src/platforms/implementations/claude-platform.js");
const ChatGptPlatform = __webpack_require__(/*! ./implementations/chatgpt-platform */ "./src/platforms/implementations/chatgpt-platform.js");
const DeepSeekPlatform = __webpack_require__(/*! ./implementations/deepseek-platform */ "./src/platforms/implementations/deepseek-platform.js");
const MistralPlatform = __webpack_require__(/*! ./implementations/mistral-platform */ "./src/platforms/implementations/mistral-platform.js");
const GeminiPlatform = __webpack_require__(/*! ./implementations/gemini-platform */ "./src/platforms/implementations/gemini-platform.js");
const GrokPlatform = __webpack_require__(/*! ./implementations/grok-platform */ "./src/platforms/implementations/grok-platform.js");

/**
 * Factory to create the appropriate platform implementation
 */
class PlatformFactory {
  /**
   * Create the appropriate platform for the current page
   * @returns {BasePlatform|null} The platform instance or null if no platform matches
   */
  static createPlatform() {
    const platforms = [new ClaudePlatform(), new ChatGptPlatform(), new DeepSeekPlatform(), new MistralPlatform(), new GeminiPlatform(), new GrokPlatform()];

    // Find the first platform that matches the current URL
    return platforms.find(platform => platform.isCurrentPlatform()) || null;
  }

  /**
   * Create a platform by ID regardless of current URL
   * @param {string} platformId - The platform ID to create
   * @returns {BasePlatform|null} The platform instance or null if platform ID not found
   */
  static createPlatformById(platformId) {
    switch (platformId.toLowerCase()) {
      case 'claude':
        return new ClaudePlatform();
      case 'chatgpt':
        return new ChatGptPlatform();
      case 'deepseek':
        return new DeepSeekPlatform();
      case 'mistral':
        return new MistralPlatform();
      case 'gemini':
        return new GeminiPlatform();
      case 'grok':
        return new GrokPlatform();
      default:
        console.error(`Unknown platform ID: ${platformId}`);
        return null;
    }
  }
}
module.exports = PlatformFactory;

/***/ }),

/***/ "./src/platforms/platform-interface.js":
/*!*********************************************!*\
  !*** ./src/platforms/platform-interface.js ***!
  \*********************************************/
/***/ ((module) => {

// src/platforms/platform-interface.js

/**
 * Interface defining the contract that all AI platform implementations must follow
 */
class PlatformInterface {
  /**
   * Check if the current page is the target platform
   * @returns {boolean} True if current page is the target platform
   */
  isCurrentPlatform() {
    throw new Error('isCurrentPlatform must be implemented by subclasses');
  }

  /**
   * Find the editor element for text input
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    throw new Error('findEditorElement must be implemented by subclasses');
  }

  /**
   * Find the submit button to send the input
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    throw new Error('findSubmitButton must be implemented by subclasses');
  }

  /**
   * Insert text into the editor and submit it
   * @param {string} text - The text to insert and submit
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    throw new Error('insertAndSubmitText must be implemented by subclasses');
  }

  /**
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize must be implemented by subclasses');
  }
}
module.exports = PlatformInterface;

/***/ }),

/***/ "./src/shared/constants.js":
/*!*********************************!*\
  !*** ./src/shared/constants.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AI_PLATFORMS: () => (/* binding */ AI_PLATFORMS),
/* harmony export */   CONTENT_TYPES: () => (/* binding */ CONTENT_TYPES),
/* harmony export */   CONTENT_TYPE_LABELS: () => (/* binding */ CONTENT_TYPE_LABELS),
/* harmony export */   INTERFACE_SOURCES: () => (/* binding */ INTERFACE_SOURCES),
/* harmony export */   MESSAGE_ROLES: () => (/* binding */ MESSAGE_ROLES),
/* harmony export */   PROMPT_TYPES: () => (/* binding */ PROMPT_TYPES),
/* harmony export */   SHARED_TYPE: () => (/* binding */ SHARED_TYPE),
/* harmony export */   STORAGE_KEYS: () => (/* binding */ STORAGE_KEYS)
/* harmony export */ });
// src/shared/constants.js

/**
 * Content types used throughout the extension
 */
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf'
};

/**
 * Shared prompt type - accessible across all content types
 */
const SHARED_TYPE = 'shared';

/**
 * User-friendly labels for content types
 */
const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Post',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Video',
  [CONTENT_TYPES.PDF]: 'PDF Document',
  [SHARED_TYPE]: 'Shared Prompts'
};

/**
 * AI platforms supported by the extension
 */
const AI_PLATFORMS = {
  CLAUDE: 'claude',
  CHATGPT: 'chatgpt',
  DEEPSEEK: 'deepseek',
  MISTRAL: 'mistral',
  GEMINI: 'gemini',
  GROK: 'grok'
};

/**
 * Storage keys used throughout the extension
 */
const STORAGE_KEYS = {
  // Content
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  SCRIPT_INJECTED: 'scriptInjected',
  TAB_FORMATTED_CONTENT: 'tab_formatted_content',
  FORMATTED_CONTENT_FOR_INJECTION: 'formatted_content_for_injection',
  // Service
  THEME_PREFERENCE: 'theme_preference',
  TEXT_SIZE_PREFERENCE: 'text_size_preference',
  API_ADVANCED_SETTINGS: 'api_advanced_settings',
  API_CREDENTIALS: 'api_credentials',
  // Prompt
  PRE_PROMPT: 'prePrompt',
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPTS_INIT_FLAG: 'default_prompts_initialized_v1',
  // Platform
  INJECTION_PLATFORM: 'injectionPlatform',
  INJECTION_PLATFORM_TAB_ID: 'injectionPlatformTabId',
  POPUP_PLATFORM: 'popup_platform',
  SIDEBAR_PLATFORM: 'sidebar_platform_preference',
  SIDEBAR_MODEL: 'sidebar_model_preferences',
  TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
  TAB_MODEL_PREFERENCES: 'tab_model_preferences',
  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  // API
  API_PROCESSING_STATUS: 'apiProcessingStatus',
  API_RESPONSE: 'apiResponse',
  API_PROCESSING_ERROR: 'apiProcessingError',
  API_RESPONSE_TIMESTAMP: 'apiResponseTimestamp',
  STREAM_ID: 'streamId',
  // Sidebar
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
  TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
  TAB_TOKEN_STATISTICS: 'tab_token_statistics'
};

/**
 * Interface sources for API requests
 */
const INTERFACE_SOURCES = {
  POPUP: 'popup',
  SIDEBAR: 'sidebar'
};

/**
 * Prompt types
 */
const PROMPT_TYPES = {
  CUSTOM: 'custom',
  QUICK: 'quick'
};

/**
 * Sidepanel message types
 */
const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/***/ }),

/***/ "./src/shared/logger.js":
/*!******************************!*\
  !*** ./src/shared/logger.js ***!
  \******************************/
/***/ ((module) => {

// src/shared/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Console-only implementation with backward compatibility
 */

// Determine if running in production mode (set by Webpack's mode option)
const isProduction = "development" === 'production';

/**
 * Log a message to console, conditionally skipping 'info' logs in production.
 * @param {string} context - The context (background, content, popup, etc.)
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - The message to log
 * @param {any} [data=null] - Optional data to include
 */
function log(context, level, message, data = null) {
  // --- Production Log Filtering ---
  // Skip 'info' level logs when in production mode
  if (isProduction && level === 'info') {
    return; // Exit early, do not log
  }
  // -----------------------------

  // Map level to console method
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'; // Default to 'log' for 'info'

  // Format prefix with context
  const prefix = `[${context}]`;

  // Log to console with or without data
  if (data !== null) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }
}

/**
 * Stub function for backward compatibility
 * Returns empty array since we're not storing logs
 * @returns {Promise<Array>} Empty array
 */
async function getLogs() {
  // Log this message even in production, as it's informational about the logger itself
  console.log('[Logger] getLogs called - logs are not being stored in this version');
  return [];
}

/**
 * Stub function for backward compatibility
 */
async function clearLogs() {
  // Log this message even in production
  console.log('[Logger] clearLogs called - logs are not being stored in this version');
}
const logger = {
  api: {
    debug: (message, data) => log('api', 'debug', message, data),
    info: (message, data) => log('api', 'info', message, data),
    warn: (message, data) => log('api', 'warn', message, data),
    error: (message, data) => log('api', 'error', message, data)
  },
  background: {
    debug: (message, data) => log('background', 'debug', message, data),
    info: (message, data) => log('background', 'info', message, data),
    warn: (message, data) => log('background', 'warn', message, data),
    error: (message, data) => log('background', 'error', message, data)
  },
  content: {
    debug: (message, data) => log('content', 'debug', message, data),
    info: (message, data) => log('content', 'info', message, data),
    warn: (message, data) => log('content', 'warn', message, data),
    error: (message, data) => log('content', 'error', message, data)
  },
  extractor: {
    debug: (message, data) => log('extractor', 'debug', message, data),
    info: (message, data) => log('extractor', 'info', message, data),
    warn: (message, data) => log('extractor', 'warn', message, data),
    error: (message, data) => log('extractor', 'error', message, data)
  },
  popup: {
    debug: (message, data) => log('popup', 'debug', message, data),
    info: (message, data) => log('popup', 'info', message, data),
    warn: (message, data) => log('popup', 'warn', message, data),
    error: (message, data) => log('popup', 'error', message, data)
  },
  platform: {
    debug: (message, data) => log('platform', 'debug', message, data),
    info: (message, data) => log('platform', 'info', message, data),
    warn: (message, data) => log('platform', 'warn', message, data),
    error: (message, data) => log('platform', 'error', message, data)
  },
  message: {
    debug: (message, data) => log('message', 'debug', message, data),
    info: (message, data) => log('message', 'info', message, data),
    warn: (message, data) => log('message', 'warn', message, data),
    error: (message, data) => log('message', 'error', message, data)
  },
  service: {
    debug: (message, data) => log('service', 'debug', message, data),
    info: (message, data) => log('service', 'info', message, data),
    warn: (message, data) => log('service', 'warn', message, data),
    error: (message, data) => log('service', 'error', message, data)
  },
  sidebar: {
    debug: (message, data) => log('sidebar', 'debug', message, data),
    info: (message, data) => log('sidebar', 'info', message, data),
    warn: (message, data) => log('sidebar', 'warn', message, data),
    error: (message, data) => log('sidebar', 'error', message, data)
  },
  getLogs,
  clearLogs
};
module.exports = logger;

/***/ }),

/***/ "./src/shared/utils/message-utils.js":
/*!*******************************************!*\
  !*** ./src/shared/utils/message-utils.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   robustSendMessage: () => (/* binding */ robustSendMessage)
/* harmony export */ });
/* harmony import */ var _logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../logger */ "./src/shared/logger.js");
/* harmony import */ var _logger__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_logger__WEBPACK_IMPORTED_MODULE_0__);
// src/shared/utils/message-utils.js

const RETRY_DELAY = 250;

/**
 * Sends a message to the background script, handling potential connection errors
 * and performing a single retry if the Service Worker was inactive.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @param {number} [retries=1] - Maximum number of retries allowed (default is 1 retry).
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
async function robustSendMessage(message, retries = 1) {
  if (!message || typeof message.action !== 'string') {
    _logger__WEBPACK_IMPORTED_MODULE_0___default().message.error('robustSendMessage: Invalid message object. "action" property is required.', message);
    return Promise.reject(new Error('Invalid message object passed to robustSendMessage'));
  }
  return new Promise((resolve, reject) => {
    // Ensure chrome API is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      _logger__WEBPACK_IMPORTED_MODULE_0___default().message.error('robustSendMessage: Chrome runtime API is not available.');
      return reject(new Error('Chrome runtime API not available'));
    }
    _logger__WEBPACK_IMPORTED_MODULE_0___default().message.info(`robustSendMessage: Sending action "${message.action}"...`);
    chrome.runtime.sendMessage(message, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        // Check if it's a connection error and retries are left
        const isConnectionError = lastError.message?.includes('Receiving end does not exist') || lastError.message?.includes('Could not establish connection');
        if (retries > 0 && isConnectionError) {
          _logger__WEBPACK_IMPORTED_MODULE_0___default().message.warn(`robustSendMessage: Connection error for action "${message.action}". Retrying in ${RETRY_DELAY}ms... (Retries left: ${retries - 1})`);
          setTimeout(() => {
            robustSendMessage(message, retries - 1) // Recursive call with decremented retries
            .then(resolve).catch(reject);
          }, RETRY_DELAY);
        } else {
          // Not a retryable error or retries exhausted
          _logger__WEBPACK_IMPORTED_MODULE_0___default().message.error(`robustSendMessage: Unrecoverable error for action "${message.action}":`, {
            message: lastError.message
          });
          reject(new Error(lastError.message || 'Unknown runtime error'));
        }
      } else {
        // Success
        _logger__WEBPACK_IMPORTED_MODULE_0___default().message.info(`robustSendMessage: Received response for action "${message.action}".`);
        resolve(response);
      }
    });
  });
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*****************************************!*\
  !*** ./src/content/platform-content.js ***!
  \*****************************************/
// src/content/platform-content.js
const PlatformFactory = __webpack_require__(/*! ../platforms/platform-factory */ "./src/platforms/platform-factory.js");

/**
 * Entry point for platform integration
 * This is the content script that will be injected into the AI platform pages
 */
(async () => {
  try {
    // Create the appropriate platform for the current page
    const platform = PlatformFactory.createPlatform();
    if (platform) {
      // Initialize the platform
      await platform.initialize();
    } else {
      console.warn('No matching AI platform found for the current page');
    }
  } catch (error) {
    console.error('Error initializing AI platform integration:', error);
  }
})();
})();

/******/ })()
;
//# sourceMappingURL=platform-content.bundle.js.map