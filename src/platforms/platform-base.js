// src/platforms/platform-base.js
const PlatformInterface = require('./platform-interface');
const STORAGE_KEYS = require('../shared/constants').STORAGE_KEYS;

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
    this.logger = this.createLogger();
    this.maxRetries = 20;
    this.processingStarted = false;
  }
  
  /**
   * Create a logger specific to this platform
   * @returns {Object} Logger object
   */
  createLogger() {
    return {
      info: (message, data = null) => console.log(`[${this.platformId}] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[${this.platformId}] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[${this.platformId}] ERROR: ${message}`, data || '')
    };
  }
  
  /**
   * Initialize the platform integration
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.isCurrentPlatform()) {
      this.logger.info(`Not on ${this.platformId}, exiting`);
      return;
    }
    
    this.logger.info(`Initializing ${this.platformId} platform integration`);
    
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
        this.logger.info(`${this.platformId} interface ready, starting processing`);
        this.processingStarted = true;
        observer.disconnect();
        this.processContent();
      } else {
        retryCount++;
        if (retryCount >= this.maxRetries) {
          observer.disconnect();
          this.logger.error(`Failed to find ${this.platformId} interface elements after maximum retries`);
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: `Could not interact with ${this.platformId} interface. The page may still be loading or the interface may have changed.`
          });
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
      this.logger.info(`Inserting text into standard input/textarea for ${this.platformId}`);
      editorElement.focus();
      editorElement.value = text;
      this._dispatchEvents(editorElement, ['input', 'change']);
      this.logger.info(`Successfully inserted text into ${this.platformId} editor.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to insert text into ${this.platformId} editor:`, error);
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
      this.logger.info(`Attempting to click submit button for ${this.platformId}`);
      if (buttonElement.disabled || buttonElement.getAttribute('aria-disabled') === 'true') {
        this.logger.warn(`Submit button for ${this.platformId} is disabled.`);
        return false;
      }
      buttonElement.click();
      this.logger.info(`Successfully clicked submit button for ${this.platformId}.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to click submit button for ${this.platformId}:`, error);
      return false;
    }
  }

  /**
   * Template Method: Process content from storage, find elements, insert, and submit.
   */
  async processContent() {
    this.logger.info(`Starting template method processContent for ${this.platformId}`);
    chrome.storage.local.get(
      [STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION],
      async (result) => {
        try {
          this.logger.info('Retrieved data from storage', {
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
          this.logger.info(`Combined prompt and content for ${this.platformId}`);

          // --- Template Method Steps ---
          // 1. Find Editor
          const editorElement = this.findEditorElement();
          if (!editorElement) {
            this.logger.error(`Editor element not found for ${this.platformId}.`);
            throw new Error(`Could not find the editor element on ${this.platformId}.`);
          }
          this.logger.info(`Found editor element for ${this.platformId}.`);

          // 2. Insert Text
          const insertSuccess = await this._insertTextIntoEditor(editorElement, fullText);
          if (!insertSuccess) {
            this.logger.error(`Failed to insert text using _insertTextIntoEditor for ${this.platformId}.`);
            throw new Error(`Failed to insert text into the ${this.platformId} editor.`);
          }
          this.logger.info(`Text insertion step completed for ${this.platformId}.`);

          // 3. Wait
          await this._wait(800); // Allow time for UI updates or checks
          this.logger.info(`Wait step completed for ${this.platformId}.`);

          // 4. Find Submit Button
          const submitButton = this.findSubmitButton();
          if (!submitButton) {
            this.logger.error(`Submit button not found for ${this.platformId}.`);
            throw new Error(`Could not find the submit button on ${this.platformId}.`);
          }
          this.logger.info(`Found submit button for ${this.platformId}.`);

          // 5. Click Submit Button
          const clickSuccess = await this._clickSubmitButton(submitButton);
          if (!clickSuccess) {
            this.logger.error(`Failed to click submit button using _clickSubmitButton for ${this.platformId}.`);
            throw new Error(`Failed to click the submit button on ${this.platformId}.`);
          }
          this.logger.info(`Submit button click step completed for ${this.platformId}.`);
          // --- End Template Method Steps ---

          this.logger.info(`Content successfully processed and submitted for ${this.platformId}`);
          // Clear the data after successful processing
          chrome.storage.local.remove([
            STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION,
            STORAGE_KEYS.PRE_PROMPT,
            STORAGE_KEYS.CONTENT_READY
          ]);

        } catch (error) {
          this.logger.error(`Error during ${this.platformId} processContent execution:`, error);
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: `Error interacting with ${this.platformId}: ${error.message}`
          });
          // Optionally clear storage even on error? Depends on desired retry behavior.
          // chrome.storage.local.remove([STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION, STORAGE_KEYS.PRE_PROMPT, STORAGE_KEYS.CONTENT_READY]);
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
    // Use a simple structural approach that preserves the entire prePrompt
    return `# INSTRUCTION
${prePrompt}
# EXTRACTED CONTENT
${formattedContent}
# END CONTENT`
  }
}

module.exports = BasePlatform;
