// src/platforms/platform-base.js
import { STORAGE_KEYS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

import PlatformInterface from './platform-interface.js';

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
    this.logger = logger.platform;
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
  /**
   * Simulates a realistic click sequence (mousedown -> mouseup -> click)
   * @param {HTMLElement} buttonElement - The button element to click
   * @returns {Promise<boolean>} True if events dispatched successfully, false otherwise
   * @protected
   */
  async _simulateRealClick(buttonElement) {
    try {
      this.logger.info(`[${this.platformId}] Attempting to click submit button with event sequence`);
      
      // Dispatch mousedown with button pressed
      buttonElement.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: 1
        })
      );
      
      // Dispatch mouseup with button released
      buttonElement.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: 0
        })
      );
      
      // Dispatch final click event
      buttonElement.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
      
      this.logger.info(`[${this.platformId}] Successfully dispatched click events.`);
      return true;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Failed to dispatch click events:`, error);
      return false;
    }
  }

  /**
   * Default implementation for clicking the submit button.
   * Uses simulated click sequence by default.
   * Subclasses should override this if the platform requires different behavior.
   * @param {HTMLElement} buttonElement - The submit button element.
   * @returns {Promise<boolean>} - True if click was dispatched without error, false otherwise.
   * @protected
   */
  async _clickSubmitButton(buttonElement) {
    return this._simulateRealClick(buttonElement);
  }

  /**
   * Checks if the platform-specific editor element is considered empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   * @abstract
   */
  _isEditorEmpty(_editorElement) {
    throw new Error('_isEditorEmpty must be implemented by subclasses');
  }

  /**
   * Verifies if submission was likely attempted by checking UI cues after clicking the submit button.
   * Checks if the submit button became disabled OR if the editor element became empty.
   * @returns {Promise<boolean>} True if verification passes (button disabled or editor empty), false otherwise.
   * @protected
   */
  /**
   * Verifies if submission was likely successful by polling to check if the editor element became empty
   * after clicking the submit button.
   * @returns {Promise<boolean>} True if verification passes (editor becomes empty within timeout), false otherwise.
   * @protected
   */
  async _verifySubmissionAttempted() {
    const pollInterval = 200; // Check every 200ms
    const maxWaitTime = 5000; // Max wait 5 seconds
    const startTime = Date.now();

    this.logger.info(
      `[${this.platformId}] Starting post-click verification polling (Interval: ${pollInterval}ms, Timeout: ${maxWaitTime}ms)...`
    );

    return new Promise((resolve) => {
      const checkEditor = async () => {
        let isEditorEmpty = false;
        try {
          const editorElement = this.findEditorElement();
          if (editorElement) {
            isEditorEmpty = this._isEditorEmpty(editorElement);
            if (isEditorEmpty) {
              this.logger.info(
                `[${this.platformId}] Verification polling PASSED: Editor is empty.`
              );
              resolve(true); // Success condition met
              return;
            }
          }
        } catch (error) {
          this.logger.error(
            `[${this.platformId}] Verification polling: Error checking editor state:`,
            error
          );
          // Continue polling unless timed out
        }

        // Check if timeout exceeded
        if (Date.now() - startTime > maxWaitTime) {
          this.logger.warn(
            `[${this.platformId}] Verification polling FAILED: Timeout (${maxWaitTime}ms) reached and editor is still not empty.`
          );
          resolve(false); // Timeout reached
        } else {
          // Schedule next check
          setTimeout(checkEditor, pollInterval);
        }
      };

      // Start the first check
      checkEditor();
    });
  }

  /**
   * Helper method to determine if an element is considered visible and potentially interactive.
   * Checks display, visibility, opacity, dimensions, position, and parent overflow.
   * @param {HTMLElement} element - The element to check.
   * @returns {boolean} True if the element seems visible, false otherwise.
   * @protected
   */
  _isVisibleElement(element) {
    if (!element) return false;

    // Check for explicit hidden attributes or styles
    if (
      element.getAttribute('aria-hidden') === 'true' ||
      element.style.visibility === 'hidden' ||
      element.style.display === 'none'
    ) {
      this.logger.warn(
        `[${this.platformId}] Element hidden by attribute/style:`,
        element
      );
      return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
    ) {
      this.logger.warn(
        `[${this.platformId}] Element hidden by computed style: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}, pointerEvents=${style.pointerEvents}`,
        element
      );
      return false;
    }

    // Check if element has zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Allow zero height for textareas which might start small
      if (element.tagName !== 'TEXTAREA') {
        this.logger.warn(
          `[${this.platformId}] Element has zero dimensions: width=${rect.width}, height=${rect.height}`,
          element
        );
        return false;
      } else {
        this.logger.info(
          `[${this.platformId}] Textarea has zero height, allowing as potentially visible.`
        );
      }
    }

    // Check if element is practically off-screen (adjust threshold as needed)
    const threshold = 5; // Small pixel threshold
    if (
      rect.right < threshold ||
      rect.bottom < threshold ||
      rect.left > window.innerWidth - threshold ||
      rect.top > window.innerHeight - threshold
    ) {
      this.logger.warn(
        `[${this.platformId}] Element is positioned off-screen:`,
        rect,
        element
      );
      return false;
    }

    // Check if the element or its parent is hidden via overflow
    let parent = element.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (
        parentStyle.overflow === 'hidden' ||
        parentStyle.overflowX === 'hidden' ||
        parentStyle.overflowY === 'hidden'
      ) {
        const parentRect = parent.getBoundingClientRect();
        // Check if the element is outside the parent's visible bounds
        if (
          rect.top < parentRect.top ||
          rect.bottom > parentRect.bottom ||
          rect.left < parentRect.left ||
          rect.right > parentRect.right
        ) {
          this.logger.warn(
            `[${this.platformId}] Element hidden by parent overflow:`,
            element,
            parent
          );
          // return false; // Be cautious with this check, might be too strict
        }
      }
      if (parent === document.body) break;
      parent = parent.parentElement;
    }

    return true;
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
            result[STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION];

          if (!prePrompt) {
            throw new Error('Missing prompt data in storage');
          }

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
          await this._wait(500); // Allow time for UI updates or checks
          this.logger.info(`[${this.platformId}] Wait step completed.`);

          // 4. Find Submit Button (with retries)
          this.logger.info(
            `[${this.platformId}] Attempting to find submit button with retries...`
          );
          let submitButton = null;
          const maxButtonRetries = 3;
          const buttonRetryDelay = 500; // ms

          for (let attempt = 1; attempt <= maxButtonRetries; attempt++) {
            submitButton = this.findSubmitButton();
          if (submitButton) {
            this.logger.info(
              `[${this.platformId}] Found submit button on attempt ${attempt}.`
            );
            break; // Exit loop as soon as any submit button is found
          }
            // If button not found OR found but disabled, wait before next attempt
            if (attempt < maxButtonRetries) {
              this.logger.info(
                `[${this.platformId}] Submit button not ready/found on attempt ${attempt}. Retrying in ${buttonRetryDelay}ms...`
              );
              await this._wait(buttonRetryDelay);
            }
          }

          // Check if a button element was found after retries
          if (!submitButton) {
            this.logger.error(
              `[${this.platformId}] Submit button element not found after ${maxButtonRetries} attempts.`
            );
            throw new Error(
              `Could not find the submit button element on ${this.platformId} after multiple attempts.`
            );
          }
          this.logger.info(
            `[${this.platformId}] Found submit button element. Proceeding to click attempt.`
          );
          this.logger.info(
            `[${this.platformId}] Submit button finding step completed successfully.`
          );

          // 5. Click Submit Button Attempt
          try {
            this.logger.info(`[${this.platformId}] Attempting submit button click...`);
            await this._clickSubmitButton(submitButton);
            // Log success of the *attempt*, but don't rely on its return value here
            this.logger.info(`[${this.platformId}] Submit button click attempt finished.`);
          } catch (clickError) {
            // Log errors during the click attempt, but continue to verification
            this.logger.error(`[${this.platformId}] Error occurred during _clickSubmitButton attempt (will proceed to verification):`, clickError);
          }

          // 6. Verify Submission Attempt (always runs after click attempt)
          const verificationSuccess = await this._verifySubmissionAttempted();

          if (verificationSuccess) {
            this.logger.info(`[${this.platformId}] Post-click verification successful.`);
            // --- Submission Likely Succeeded ---
            this.logger.info(
              `[${this.platformId}] Content successfully processed and submitted (pending verification)`
            );
            // Clear the data after successful processing and verification
            chrome.storage.local.remove([
              STORAGE_KEYS.EXTRACTED_CONTENT,
              STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION,
              STORAGE_KEYS.PRE_PROMPT,
              STORAGE_KEYS.CONTENT_READY,
            ]);
            // --- End Success Logic ---
          } else {
            // --- Verification Failed ---
            this.logger.warn(`[${this.platformId}] Post-click verification failed. The interaction may not have been fully processed by the platform.`);

            // Still attempt to clear storage as the process is 'done' from the extension's perspective
            chrome.storage.local.remove([
              STORAGE_KEYS.EXTRACTED_CONTENT,
              STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION,
              STORAGE_KEYS.PRE_PROMPT,
              STORAGE_KEYS.CONTENT_READY,
            ]);
            // Throw an error to indicate the overall process failed due to verification
            throw new Error(`Post-click verification failed for ${this.platformId}. Interaction may not have succeeded.`);
            // --- End Verification Failed Logic ---
          }
          // --- End Template Method Steps ---
        } catch (error) {
          this.logger.error(
            `[${this.platformId}] Error during processContent execution:`,
            error
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

export default BasePlatform;
