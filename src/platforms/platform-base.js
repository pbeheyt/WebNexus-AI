// src/platforms/platform-base.js
const PlatformInterface = require('./platform-interface');

const STORAGE_KEYS = require('../shared/constants').STORAGE_KEYS;
const logger = require('../shared/logger').platform;
const { robustSendMessage } = require('../shared/utils/message-utils');

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
    const observerConfig = { childList: true, subtree: true };
    let retryCount = 0;

    const observer = new MutationObserver(() => {
      const editorElement = this.findEditorElement();

      if (editorElement && !this.processingStarted) {
        this.logger.info(
          `[${this.platformId}] Interface ready, starting processing`
        );
        this.processingStarted = true;
        observer.disconnect();
        this.processContent();
      } else {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          observer.disconnect();
          this.logger.error(
            `[${this.platformId}] Failed to find interface elements after maximum retries`
          );
          robustSendMessage({
            action: 'notifyError',
            error: `Could not interact with ${this.platformId} interface. The page may still be loading or the interface may have changed.`,
          }).catch((err) =>
            this.logger.error('Failed to send notifyError message:', err)
          );
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Utility method to dispatch events on an element.
   * @param {HTMLElement} element - The target element.
   * @param {string[]} eventTypes - Array of event names (e.g., ['input', 'change']).
   * @protected
   */
  _dispatchEvents(element, eventTypes) {
    eventTypes.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
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
      this.logger.info(
        `[${this.platformId}] Inserting text into standard input/textarea`
      );
      editorElement.focus();
      editorElement.value = text;
      this._dispatchEvents(editorElement, ['input', 'change']);
      this.logger.info(
        `[${this.platformId}] Successfully inserted text into editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to insert text into editor:`,
        error
      );
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
      this.logger.info(
        `[${this.platformId}] Attempting to click submit button`
      );
      if (
        buttonElement.disabled ||
        buttonElement.getAttribute('aria-disabled') === 'true'
      ) {
        this.logger.warn(
          `[${this.platformId}] Submit button is disabled, cannot click.`
        );
        return false; // Indicate failure
      }

      // Dispatch click event
      buttonElement.click();
      this.logger.info(
        `[${this.platformId}] Successfully clicked submit button.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to click submit button:`,
        error
      );
      return false;
    }
  }

  /**
   * Template Method: Process content from storage, find elements, insert, and submit.
   */
  async processContent() {
    this.logger.info(
      `[${this.platformId}] Starting template method processContent`
    );
    chrome.storage.local.get(
      [STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION],
      async (result) => {
        try {
          this.logger.info(`[${this.platformId}] Retrieved data from storage`, {
            hasPrompt: !!result[STORAGE_KEYS.PRE_PROMPT],
            hasFormattedContent:
              !!result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION],
          });

          const prePrompt = result[STORAGE_KEYS.PRE_PROMPT];
          const formattedContentString =
            result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION]; // Keep retrieval

          if (!prePrompt) {
            // Keep the check for prePrompt, as it's always required
            throw new Error('Missing prompt data in storage');
          }
          // Removed the check: if (!formattedContentString) { ... }

          // Pass the potentially null formattedContentString
          const fullText = this.createStructuredPrompt(
            prePrompt,
            formattedContentString
          );
          this.logger.info(
            `[${this.platformId}] Combined prompt and content (content may be null)`
          );

          // --- Template Method Steps ---
          // 1. Find Editor
          const editorElement = this.findEditorElement();
          if (!editorElement) {
            this.logger.error(`[${this.platformId}] Editor element not found.`);
            throw new Error(
              `Could not find the editor element on ${this.platformId}.`
            );
          }
          this.logger.info(`[${this.platformId}] Found editor element.`);

          // 2. Insert Text
          const insertSuccess = await this._insertTextIntoEditor(
            editorElement,
            fullText
          );
          if (!insertSuccess) {
            this.logger.error(
              `[${this.platformId}] Failed to insert text using _insertTextIntoEditor.`
            );
            throw new Error(
              `Failed to insert text into the ${this.platformId} editor.`
            );
          }
          this.logger.info(
            `[${this.platformId}] Text insertion step completed.`
          );

          // 3. Wait
          await this._wait(800); // Allow time for UI updates or checks
          this.logger.info(`[${this.platformId}] Wait step completed.`);

          // 4. Find Submit Button (with retries)
          this.logger.info(
            `[${this.platformId}] Attempting to find submit button with retries...`
          );
          let submitButton = null;
          const maxButtonRetries = 3;
          const buttonRetryDelay = 600; // ms

          for (let attempt = 1; attempt <= maxButtonRetries; attempt++) {
            submitButton = this.findSubmitButton();
            if (submitButton) {
              // Check if button is actually enabled now before breaking
              if (
                !submitButton.disabled &&
                submitButton.getAttribute('aria-disabled') !== 'true'
              ) {
                this.logger.info(
                  `[${this.platformId}] Found enabled submit button on attempt ${attempt}.`
                );
                break; // Exit loop only if found AND enabled
              } else {
                this.logger.warn(
                  `[${this.platformId}] Found submit button on attempt ${attempt}, but it's disabled. Continuing retries...`
                );
                submitButton = null; // Reset submitButton so loop continues
              }
            }
            // If button not found OR found but disabled, wait before next attempt
            if (attempt < maxButtonRetries) {
              this.logger.info(
                `[${this.platformId}] Submit button not ready/found on attempt ${attempt}. Retrying in ${buttonRetryDelay}ms...`
              );
              await this._wait(buttonRetryDelay);
            }
          }

          // Check if button was found and ready after retries
          if (!submitButton) {
            this.logger.error(
              `[${this.platformId}] Submit button not found or not enabled after ${maxButtonRetries} attempts.`
            );
            throw new Error(
              `Could not find an enabled submit button on ${this.platformId} after multiple attempts.`
            );
          }
          this.logger.info(
            `[${this.platformId}] Submit button finding step completed successfully.`
          );

          // 5. Click Submit Button
          const clickSuccess = await this._clickSubmitButton(submitButton);
          if (!clickSuccess) {
            this.logger.error(
              `[${this.platformId}] Failed to click submit button using _clickSubmitButton.`
            );
            throw new Error(
              `Failed to click the submit button on ${this.platformId}.`
            );
          }
          this.logger.info(
            `[${this.platformId}] Submit button click step completed.`
          );
          // --- End Template Method Steps ---

          this.logger.info(
            `[${this.platformId}] Content successfully processed and submitted`
          );
          // Clear the data after successful processing
          chrome.storage.local.remove([
            STORAGE_KEYS.EXTRACTED_CONTENT,
            STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION,
            STORAGE_KEYS.PRE_PROMPT,
            STORAGE_KEYS.CONTENT_READY,
          ]);
        } catch (error) {
          this.logger.error(
            `[${this.platformId}] Error during processContent execution:`,
            error
          );
          robustSendMessage({
            action: 'notifyError',
            error: `Error interacting with ${this.platformId}: ${error.message}`,
          }).catch((err) =>
            this.logger.error('Failed to send notifyError message:', err)
          );
          chrome.storage.local.remove([
            STORAGE_KEYS.EXTRACTED_CONTENT,
            STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION,
            STORAGE_KEYS.PRE_PROMPT,
            STORAGE_KEYS.CONTENT_READY,
          ]);
        }
      }
    );
  }

  /**
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string} formattedContent - The formatted content
   * @returns {string} The full structured prompt
   */
  createStructuredPrompt(prePrompt, formattedContent) {
    // Check if formattedContent is null, undefined, or an empty string
    if (!formattedContent) {
      this.logger.info(
        `[${this.platformId}] No formatted content provided, returning only the prompt.`
      );
      return prePrompt; // Return only the instruction/prompt
    }
    // If content exists, return the structured prompt
    this.logger.info(
      `[${this.platformId}] Formatting prompt with included content.`
    );
    return `# INSTRUCTION
${prePrompt}
# EXTRACTED CONTENT
${formattedContent}`;
  }
}

module.exports = BasePlatform;
