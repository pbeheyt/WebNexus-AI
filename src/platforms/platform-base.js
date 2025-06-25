// src/platforms/platform-base.js
import { STORAGE_KEYS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { createStructuredPromptString } from '../shared/utils/prompt-formatting-utils.js';

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

    const observer = new MutationObserver(async () => {
      const editorElement = await this.findEditorElement();

      if (editorElement && !this.processingStarted) {
        this.logger.info(
          `[${this.platformId}] Interface ready, starting processing`
        );
        this.processingStarted = true;
        observer.disconnect();
        this.processContent();
      } else if (!editorElement && !this.processingStarted) {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          observer.disconnect();
          this.logger.error(
            `[${this.platformId}] Failed to find editor element after maximum retries in observer. Automation cannot proceed.`
          );
          // Clear storage here if automation cannot proceed
          // to prevent stale data if the tab is left open.
          chrome.storage.local.remove([
            STORAGE_KEYS.EXTRACTED_CONTENT,
            STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT,
            STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT,
            STORAGE_KEYS.CONTENT_READY_FLAG,
          ]);
        }
      }
    });

    observer.observe(document.body, observerConfig);
  }

  /**
   * Abstract method for subclasses to provide an array of CSS selectors for the editor.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   * @abstract
   */
  _getEditorSelectors() {
    this.logger.error(
      `[${this.platformId}] _getEditorSelectors method not implemented.`
    );
    throw new Error('_getEditorSelectors must be implemented by subclasses');
  }

  /**
   * Abstract method for subclasses to provide an array of CSS selectors for the submit button.
   * @returns {string[]} Array of CSS selector strings.
   * @protected
   * @abstract
   */
  _getSubmitButtonSelectors() {
    this.logger.error(
      `[${this.platformId}] _getSubmitButtonSelectors method not implemented.`
    );
    throw new Error(
      '_getSubmitButtonSelectors must be implemented by subclasses'
    );
  }

  /**
   * Finds the editor element using configured selectors and waits for it to be ready.
   * @returns {Promise<HTMLElement|null>} The editor element or null if not found/ready.
   */
  async findEditorElement() {
    this.logger.info(
      `[${this.platformId}] Attempting to find editor element using configured selectors...`
    );
    const selectors = this._getEditorSelectors();
    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      this.logger.error(
        `[${this.platformId}] No editor selectors provided by the platform implementation or selectors is not an array.`
      );
      return null;
    }
    if (selectors.some((s) => typeof s !== 'string')) {
      this.logger.error(
        `[${this.platformId}] All editor selectors must be strings.`
      );
      return null;
    }

    const result = await this._waitForElementState(
      selectors,
      (el) => this._isVisibleElement(el), // Basic visibility check for editor
      5000, // timeoutMs
      300, // pollIntervalMs
      `${this.platformId} editor element`
    );

    if (result.status === 'found') {
      this.logger.info(`[${this.platformId}] Editor element found and ready.`);
      return result.element;
    } else {
      this.logger.warn(
        `[${this.platformId}] Editor element did not become ready within the timeout (status: ${result.status}).`
      );
      return null;
    }
  }

  /**
   * Finds the submit button using configured selectors and waits for it to be ready,
   * or returns a special value if the editor empties early.
   * @returns {Promise<{status: 'found'|'timeout'|'editor_emptied_early', button: HTMLElement|null}>} An object with the status and the found button.
   */
  async findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find submit button using configured selectors...`
    );
    const selectors = this._getSubmitButtonSelectors();
    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      this.logger.error(
        `[${this.platformId}] No submit button selectors provided by the platform implementation or selectors is not an array.`
      );
      return null;
    }
    if (selectors.some((s) => typeof s !== 'string')) {
      this.logger.error(
        `[${this.platformId}] All submit button selectors must be strings.`
      );
      return null;
    }

    const earlyExitCheck = async () => {
      // Attempt to find the editor quickly.
      // This uses a non-waiting find, as it's part of a poll.
      const editorSelectors = this._getEditorSelectors();
      let editorElement = null;
      for (const editorSelector of editorSelectors) {
        try {
          const foundElement = document.querySelector(editorSelector);
          if (foundElement) {
            editorElement = foundElement;
            break;
          }
        } catch (e) {
          /* ignore selector error during this quick check */
        }
      }

      if (editorElement && this._isEditorEmpty(editorElement)) {
        this.logger.info(
          `[${this.platformId}] findSubmitButton: Editor emptied while polling for submit button.`
        );
        return true; // Signal early exit
      }
      return false;
    };

    const result = await this._waitForElementState(
      selectors,
      async (el) => {
        // Condition for submit button readiness
        if (!el) return false;
        const isEnabled = this._isButtonEnabled(el);
        const isVisible = this._isVisibleElement(el);
        const pointerEvents = window.getComputedStyle(el).pointerEvents;
        const hasPointerEvents = pointerEvents !== 'none';
        return isEnabled && isVisible && hasPointerEvents;
      },
      5000, // timeoutMs
      300, // pollIntervalMs
      `${this.platformId} submit button`,
      earlyExitCheck // Pass the early exit condition checker
    );

    switch (result.status) {
      case 'early_exit':
        this.logger.info(
          `[${this.platformId}] Submit button search exited early: Editor emptied.`
        );
        return { status: 'editor_emptied_early', button: null };
      case 'found':
        this.logger.info(`[${this.platformId}] Submit button found and ready.`);
        return { status: 'found', button: result.element };
      case 'timeout':
      default:
        this.logger.warn(
          `[${this.platformId}] Submit button did not become ready within the timeout.`
        );
        return { status: 'timeout', button: null };
    }
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
   * Gets the platform-specific wait time in milliseconds before attempting to find the submit button.
   * Subclasses can override this to adjust timing.
   * @returns {Promise<number>} Milliseconds to wait.
   * @protected
   */
  async _getPreSubmitWaitMs() {
    return 200; // Default wait time
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
   * Checks if a button element is currently enabled and ready for interaction.
   * @param {HTMLElement} button - The button element to check.
   * @returns {boolean} True if the button is enabled, false otherwise.
   * @protected
   */
  _isButtonEnabled(button) {
    if (!button) return false;
    const isDisabled =
      button.disabled || button.getAttribute('aria-disabled') === 'true';
    return !isDisabled;
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
      editorElement.value = text; // Standard for textarea/input
      this._dispatchEvents(editorElement, ['input', 'change', 'blur', 'focus']);
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
   * Helper method for inserting text into contenteditable div editors.
   * @param {HTMLElement} editorElement - The contenteditable editor element.
   * @param {string} text - The text to insert.
   * @param {object} [options={}] - Optional parameters.
   * @param {string} [options.lineElementTag='p'] - The HTML tag to use for each line of text.
   * @param {boolean} [options.clearExisting=true] - Whether to clear existing content.
   * @param {string[]} [options.dispatchEvents=['input', 'change']] - Events to dispatch after insertion.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   * @protected
   */
  async _insertTextIntoContentEditable(editorElement, text, options = {}) {
    const defaultOptions = {
      lineElementTag: 'p',
      clearExisting: true,
      dispatchEvents: ['input', 'change', 'blur', 'focus', 'compositionend'],
    };
    const effectiveOptions = { ...defaultOptions, ...options };

    try {
      this.logger.info(
        `[${this.platformId}] Inserting text into contenteditable editor with tag <${effectiveOptions.lineElementTag}> (Clear: ${effectiveOptions.clearExisting})`
      );

      editorElement.focus();

      if (effectiveOptions.clearExisting) {
        editorElement.innerHTML = '';
      }

      const lines = text.split('\n');
      lines.forEach((line) => {
        const p = document.createElement(effectiveOptions.lineElementTag);
        p.textContent = line;
        // For empty lines, Quill often uses <p><br></p>. Let's try to mimic that for better compatibility.
        // However, a simple non-breaking space might be more robust if <br> causes issues.
        if (line === '') {
          p.appendChild(document.createElement('br'));
        }
        editorElement.appendChild(p);
      });

      // Ensure cursor is at the end
      const range = document.createRange();
      const sel = window.getSelection();
      if (editorElement.lastChild) {
        range.setStartAfter(editorElement.lastChild);
      } else {
        range.setStart(editorElement, 0);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      this._dispatchEvents(editorElement, effectiveOptions.dispatchEvents);

      this.logger.info(
        `[${this.platformId}] Successfully inserted text into contenteditable editor.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error inserting text into contenteditable editor:`,
        error
      );
      return false;
    }
  }

  /**
   * Simulates a realistic click sequence (mousedown -> mouseup -> click)
   * @param {HTMLElement} buttonElement - The button element to click
   * @returns {Promise<boolean>} True if events dispatched successfully, false otherwise
   * @protected
   */
  async _simulateRealClick(buttonElement) {
    try {
      this.logger.info(
        `[${this.platformId}] Attempting to click submit button with event sequence`
      );

      buttonElement.focus(); // Ensure button has focus

      // Dispatch mousedown with button pressed
      buttonElement.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: 1,
        })
      );

      // Dispatch mouseup with button released
      buttonElement.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: 0, // Important: buttons should be 0 for mouseup
        })
      );

      // Dispatch final click event
      buttonElement.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );

      this.logger.info(
        `[${this.platformId}] Successfully dispatched click events.`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Failed to dispatch click events:`,
        error
      );
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
    this.logger.error(
      `[${this.platformId}] _isEditorEmpty method not implemented.`
    );
    throw new Error('_isEditorEmpty must be implemented by subclasses');
  }

  /**
   * Verifies if submission was likely successful by polling to check if the editor element became empty
   * after an interaction attempt.
   * @returns {Promise<boolean>} True if verification passes (editor becomes empty within timeout), false otherwise.
   * @protected
   */
  async _verifySubmissionAttempted() {
    const pollInterval = 200; // Check every 200ms
    const maxWaitTime = 5000; // Max wait 5 seconds
    const startTime = Date.now();

    this.logger.info(
      `[${this.platformId}] Starting post-interaction verification polling (Interval: ${pollInterval}ms, Timeout: ${maxWaitTime}ms)... Checking for empty editor.`
    );

    return new Promise((resolve) => {
      const checkEditor = async () => {
        try {
          // Re-find the editor element in each check, as it might be replaced or re-rendered.
          // For simplicity in this step, let's try a direct query first.
          const editorSelectors = this._getEditorSelectors();
          let editorElement = null;
          for (const selector of editorSelectors) {
            try {
              const foundElement = document.querySelector(selector);
              if (foundElement) {
                editorElement = foundElement;
                break;
              }
            } catch (e) {
              /* ignore */
            }
          }

          if (editorElement === null || this._isEditorEmpty(editorElement)) {
            this.logger.info(
              `[${this.platformId}] Verification polling PASSED: Editor element no longer found or is empty.`
            );
            resolve(true);
            return;
          }
        } catch (error) {
          this.logger.error(
            `[${this.platformId}] Verification polling: Error checking editor state:`,
            error
          );
          // Continue polling on error to see if it resolves
        }

        if (Date.now() - startTime > maxWaitTime) {
          this.logger.warn(
            `[${this.platformId}] Verification polling FAILED: Timeout (${maxWaitTime}ms) reached and editor is still present and not empty.`
          );
          resolve(false);
        } else {
          setTimeout(checkEditor, pollInterval);
        }
      };
      checkEditor();
    });
  }

  /**
   * Helper method to determine if an element is considered visible and potentially interactive.
   * @param {HTMLElement} element - The element to check.
   * @returns {boolean} True if the element seems visible, false otherwise.
   * @protected
   */
  _isVisibleElement(element) {
    if (!element) return false;

    if (
      element.getAttribute('aria-hidden') === 'true' ||
      element.style.visibility === 'hidden' ||
      element.style.display === 'none'
    ) {
      this.logger.debug(
        `[${this.platformId}] Element hidden by attribute/style:`,
        element.tagName,
        element.id,
        element.className
      );
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0 // Check numeric opacity
      // pointerEvents === 'none' is checked in submit button condition, not generic visibility
    ) {
      this.logger.debug(
        `[${this.platformId}] Element hidden by computed style: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`,
        element.tagName,
        element.id,
        element.className
      );
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Only fail if both are zero
      this.logger.debug(
        `[${this.platformId}] Element has zero dimensions: width=${rect.width}, height=${rect.height}`,
        element.tagName,
        element.id,
        element.className
      );
      return false;
    }

    // Check if element is practically off-screen
    const threshold = 1; // Small pixel threshold
    if (
      rect.right <= threshold || // Use <= and >= to catch elements exactly at the edge
      rect.bottom <= threshold ||
      rect.left >= window.innerWidth - threshold ||
      rect.top >= window.innerHeight - threshold
    ) {
      // Check if it's a textarea that might be scrolled into view
      if (
        element.tagName === 'TEXTAREA' &&
        (rect.width > 0 || rect.height > 0)
      ) {
        // If it's a textarea and has some dimension, it might be scrollable into view.
        // This check is tricky; for now, let's assume if it has dimensions, it's potentially visible.
      } else {
        this.logger.debug(
          `[${this.platformId}] Element is positioned off-screen:`,
          rect,
          element.tagName,
          element.id,
          element.className
        );
        return false;
      }
    }

    let currentParent = element.parentElement;
    const elemRectForOverflowCheck = element.getBoundingClientRect();

    while (
      currentParent &&
      currentParent !== document.body &&
      currentParent !== document.documentElement
    ) {
      const parentStyle = window.getComputedStyle(currentParent);
      if (
        parentStyle.overflow === 'hidden' ||
        parentStyle.overflowX === 'hidden' ||
        parentStyle.overflowY === 'hidden'
      ) {
        const parentRect = currentParent.getBoundingClientRect();

        const isOutsideParent =
          elemRectForOverflowCheck.right <= parentRect.left + 1 || // +1 for tolerance
          elemRectForOverflowCheck.left >= parentRect.right - 1 || // -1 for tolerance
          elemRectForOverflowCheck.bottom <= parentRect.top + 1 ||
          elemRectForOverflowCheck.top >= parentRect.bottom - 1;

        if (isOutsideParent) {
          this.logger.debug(
            `[${this.platformId}] Element hidden by parent '${currentParent.tagName}' with overflow: hidden. Element is outside parent's bounds.`,
            element.tagName,
            element.id,
            element.className
          );
          return false;
        }
      }
      currentParent = currentParent.parentElement;
    }

    return true;
  }

  /**
   * Waits for an element to be found by one of the provided selectors and meet a specific condition.
   * @param {string[]} selectorStringsArray - An array of CSS selector strings to try.
   * @param {function} conditionFn - An asynchronous or synchronous function that takes the found element and returns true if the desired state is met.
   * @param {number} [timeoutMs=3000] - Maximum time in milliseconds to wait.
   * @param {number} [pollIntervalMs=200] - How often in milliseconds to check.
   * @param {string} [description='element state'] - Description for logging.
   * @param {function|null} [checkEarlyExitConditionFn=null] - Optional async function to check for early exit.
   * @returns {Promise<{status: 'found'|'timeout'|'early_exit', element: HTMLElement|null}>} An object with the status and the found element.
   * @protected
   */
  async _waitForElementState(
    selectorStringsArray,
    conditionFn,
    timeoutMs = 3000,
    pollIntervalMs = 200,
    description = 'element state',
    checkEarlyExitConditionFn = null
  ) {
    this.logger.info(
      `[${this.platformId}] Waiting for ${description} (Timeout: ${timeoutMs}ms, Interval: ${pollIntervalMs}ms)...`
    );
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkCondition = async () => {
        if (checkEarlyExitConditionFn) {
          try {
            const earlyExitMet = await checkEarlyExitConditionFn();
            if (earlyExitMet) {
              this.logger.info(
                `[${this.platformId}] Early exit condition met for ${description}.`
              );
              resolve({ status: 'early_exit', element: null });
              return;
            }
          } catch (earlyExitError) {
            this.logger.warn(
              `[${this.platformId}] Error checking early exit condition for ${description}:`,
              earlyExitError
            );
            // Continue polling as if early exit wasn't met or error occurred
          }
        }

        let element = null;
        let successfulSelector = null;

        for (const selector of selectorStringsArray) {
          try {
            const foundElement = document.querySelector(selector);
            if (foundElement) {
              element = foundElement;
              successfulSelector = selector;
              this.logger.debug(
                `[${this.platformId}] Element for ${description} candidate found using selector: "${selector}"`
              );
              break;
            }
          } catch (selectorError) {
            this.logger.error(
              `[${this.platformId}] Error querying selector "${selector}" for ${description}:`,
              selectorError
            );
          }
        }

        if (element) {
          try {
            const conditionMet = await conditionFn(element);
            if (conditionMet) {
              this.logger.info(
                `[${this.platformId}] Condition for ${description} met successfully (selector: "${successfulSelector}").`
              );
              resolve({ status: 'found', element });
              return;
            }
            // Condition not met, log and continue polling
            this.logger.debug(
              `[${this.platformId}] Condition for ${description} NOT met for element found by "${successfulSelector}". Polling...`
            );
          } catch (error) {
            this.logger.error(
              `[${this.platformId}] Error in conditionFn for ${description} (selector: "${successfulSelector}"):`,
              error
            );
          }
        } else {
          // this.logger.debug(`[${this.platformId}] Element for ${description} not found by any selector on this poll.`);
        }

        if (Date.now() - startTime > timeoutMs) {
          this.logger.warn(
            `[${this.platformId}] Timeout reached waiting for ${description}. Attempted selectors: ${selectorStringsArray.join('; ')}`
          );
          resolve({ status: 'timeout', element: null });
        } else {
          setTimeout(checkCondition, pollIntervalMs);
        }
      };
      checkCondition();
    });
  }

  /**
   * Template Method: Process content from storage, find elements, insert, and submit.
   */
  async processContent() {
    this.logger.info(
      `[${this.platformId}] Starting template method processContent`
    );
    chrome.storage.local.get(
      [
        STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT,
        STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT,
      ],
      async (result) => {
        try {
          this.logger.info(`[${this.platformId}] Retrieved data from storage`, {
            hasPrompt: !!result[STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT],
            hasFormattedContent:
              !!result[STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT],
          });

          const prePrompt = result[STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT];
          const formattedContentString =
            result[STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT];

          if (!prePrompt) {
            this.logger.error(
              `[${this.platformId}] Missing prompt data in storage. Aborting processContent.`
            );
            // Clear storage even on error to prevent reprocessing stale data
            chrome.storage.local.remove([
              STORAGE_KEYS.EXTRACTED_CONTENT,
              STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT,
              STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT,
              STORAGE_KEYS.CONTENT_READY_FLAG,
            ]);
            return; // Exit if no prompt
          }

          const fullText = this.createStructuredPrompt(
            prePrompt,
            formattedContentString
          );
          this.logger.info(
            `[${this.platformId}] Combined prompt and content (content may be null)`
          );

          const editorElement = await this.findEditorElement();
          if (!editorElement) {
            this.logger.error(
              `[${this.platformId}] Critical: Editor element not found during processContent.`
            );
            throw new Error( // Throw to be caught by the outer try-catch
              `Could not find the editor element on ${this.platformId}. Automation cannot proceed.`
            );
          }
          this.logger.info(`[${this.platformId}] Found editor element.`);

          const insertSuccess = await this._insertTextIntoEditor(
            editorElement,
            fullText
          );
          if (!insertSuccess) {
            this.logger.error(
              `[${this.platformId}] Failed to insert text using _insertTextIntoEditor.`
            );
            throw new Error( // Throw
              `Failed to insert text into the ${this.platformId} editor.`
            );
          }
          this.logger.info(
            `[${this.platformId}] Text insertion step completed.`
          );

          await this._wait(await this._getPreSubmitWaitMs());
          this.logger.info(`[${this.platformId}] Wait step completed.`);

          const submitResult = await this.findSubmitButton();

          switch (submitResult.status) {
            case 'editor_emptied_early':
              this.logger.info(
                `[${this.platformId}] Submission successful: Editor emptied before explicit submit button interaction.`
              );
              // Submission is successful, verification is implicitly passed.
              break;

            case 'found': {
              const submitButton = submitResult.button;
              this.logger.info(
                `[${this.platformId}] Found submit button element. Proceeding to click attempt.`
              );

              try {
                await this._clickSubmitButton(submitButton);
                this.logger.info(
                  `[${this.platformId}] Submit button click attempt finished.`
                );
              } catch (clickError) {
                this.logger.error(
                  `[${this.platformId}] Error occurred during _clickSubmitButton attempt:`,
                  clickError
                );
              }

              const verificationSuccess =
                await this._verifySubmissionAttempted();
              if (verificationSuccess) {
                this.logger.info(
                  `[${this.platformId}] Post-interaction verification successful.`
                );
              } else {
                this.logger.warn(
                  `[${this.platformId}] Post-interaction verification failed.`
                );
              }
              break;
            }

            case 'timeout':
            default: {
              this.logger.warn(
                `[${this.platformId}] Submit button not found or not ready within timeout. Attempting verification as a fallback.`
              );
              const verificationSuccess =
                await this._verifySubmissionAttempted();
              if (verificationSuccess) {
                this.logger.info(
                  `[${this.platformId}] Fallback verification successful (editor emptied).`
                );
              } else {
                this.logger.warn(
                  `[${this.platformId}] Fallback verification failed (editor did not empty).`
                );
              }
              break;
            }
          }
        } catch (error) {
          // Catches errors from findEditor, insertText, findSubmitButton, or verification
          this.logger.error(
            `[${this.platformId}] Error during processContent execution:`,
            error
          );
        } finally {
          // Always clear storage after attempting processing, regardless of success or failure
          // to prevent reprocessing stale data on page reload or re-injection.
          this.logger.info(
            `[${this.platformId}] Clearing WebUI injection storage keys after processContent attempt.`
          );
          chrome.storage.local.remove([
            STORAGE_KEYS.EXTRACTED_CONTENT,
            STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT,
            STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT,
            STORAGE_KEYS.CONTENT_READY_FLAG,
            // Also clear the target tab ID and script injected flag, as this specific injection sequence is done.
            STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID,
            STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID,
            STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
          ]);
        }
      }
    );
  }

  /**
   * Create a structured prompt combining instructions and formatted content
   * @param {string} prePrompt - The pre-prompt instructions
   * @param {string|null|undefined} formattedContent - The formatted content (can be null/undefined)
   * @returns {string} The full structured prompt
   */
  createStructuredPrompt(prePrompt, formattedContent) {
    this.logger.info(
      `[${this.platformId}] Structuring prompt. Content provided: ${!!(formattedContent && formattedContent.trim() !== '')}`
    );
    // Use the shared utility to create the structured prompt.
    return createStructuredPromptString(prePrompt, formattedContent);
  }
}

export default BasePlatform;
