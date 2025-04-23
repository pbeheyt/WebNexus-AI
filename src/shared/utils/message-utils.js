// src/shared/utils/message-utils.js
import logger from '../logger';

const INITIAL_RETRY_DELAY = 250; // ms
const MAX_RETRIES = 2; // Total attempts = 1 initial + 2 retries = 3

/**
 * Sends a message to the background script, handling potential initial connection errors
 * with retries.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @param {number} [attempt=1] - Current attempt number (internal use for recursion).
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
export async function robustSendMessage(message, attempt = 1) {
  // Input validation
  if (!message || typeof message.action !== 'string') {
    const errorMsg = 'robustSendMessage: Invalid message object. "action" property is required.';
    logger.message.error(errorMsg, message);
    return Promise.reject(new Error(errorMsg));
  }

  return new Promise((resolve, reject) => {
    // Check for Chrome API availability
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      const errorMsg = 'robustSendMessage: Chrome runtime API is not available.';
      logger.message.error(errorMsg);
      return reject(new Error(errorMsg));
    }

    logger.message.info(`robustSendMessage: Sending action "${message.action}" (Attempt ${attempt})...`);

    // Attempt to send the message
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        // Check if the error is a known connection issue
        const isConnectionError = lastError.message?.includes('Receiving end does not exist') ||
                                  lastError.message?.includes('Could not establish connection');

        // Check if it's a retryable scenario (connection error and retries left)
        if (isConnectionError && attempt <= MAX_RETRIES) {
           // Calculate delay (optional: implement exponential backoff)
           const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff

           logger.message.warn(`robustSendMessage: Connection error for action "${message.action}" on attempt ${attempt}. Retrying in ${delay}ms...`);

           // Schedule the retry
           setTimeout(() => {
             robustSendMessage(message, attempt + 1) // Recursive call with incremented attempt count
               .then(resolve) // Pass successful resolution up
               .catch(reject); // Pass final rejection up if all retries fail
           }, delay);

        } else {
          // Error is not retryable OR max retries have been reached
          const errorContext = isConnectionError ? `Max retries (${MAX_RETRIES}) reached.` : 'Non-connection error.';
          logger.message.error(`robustSendMessage: Unrecoverable error for action "${message.action}" after ${attempt} attempts. ${errorContext}`, { message: lastError.message });
          // Reject with the specific error message from Chrome
          reject(new Error(lastError.message || `Unknown runtime error after ${attempt} attempts`));
        }
      } else {
        // Message sent and response received successfully
        logger.message.info(`robustSendMessage: Received response for action "${message.action}" (Attempt ${attempt}).`);
        resolve(response);
      }
    });
  });
}
