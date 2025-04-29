// src/shared/utils/message-utils.js
import { logger } from '../logger';

const INITIAL_RETRY_DELAY = 250; // ms
const MAX_RETRIES = 2; // Total attempts = 1 initial + 2 retries = 3

/**
 * Sends a message to the background script with robust error handling.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @param {number} [attempt=1] - The current attempt number (for internal retry logic).
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
export async function robustSendMessage(message, attempt = 1) {
  // Input validation
  if (!message || typeof message.action !== 'string') {
    const errorMsg =
      'robustSendMessage: Invalid message object. "action" property is required.';
    logger.message.error(errorMsg, message);
    return Promise.reject(new Error(errorMsg));
  }

  return new Promise((resolve, reject) => {
    // Check for Chrome API availability
    if (
      typeof chrome === 'undefined' ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      const errorMsg =
        'robustSendMessage: Chrome runtime API is not available.';
      logger.message.error(errorMsg);
      return reject(new Error(errorMsg));
    }

    logger.message.info(
      `robustSendMessage: Sending action "${message.action}"...`
    );

    // Attempt to send the message
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        const isConnectionError =
          lastError.message?.includes('Port closed') ||
          lastError.message?.includes('Could not establish connection') ||
          lastError.message?.includes('The message port closed');

        if (isConnectionError && attempt <= MAX_RETRIES) {
          // --- Retry Logic ---
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
          logger.message.info(
            `robustSendMessage: Connection error for action "${message.action}" on attempt ${attempt}. Retrying in ${delay}ms...`
          );

          setTimeout(() => {
            robustSendMessage(message, attempt + 1) // Recursive call with incremented attempt count
              .then(resolve) // Pass successful resolution up the promise chain
              .catch(reject); // Pass final rejection up the promise chain
          }, delay);
          // --- End Retry Logic ---
        } else if (isConnectionError && attempt > MAX_RETRIES) {
          // --- Max Retries Reached Logic ---
          logger.message.warn(
            `robustSendMessage: Communication failed for action "${message.action}" after ${attempt} attempts (Max retries reached).`
          );
          const communicationError = new Error(
            `Communication failed for action "${message.action}" after ${MAX_RETRIES + 1} attempts.`
          );
          communicationError.isPortClosed = true;
          reject(communicationError);
          // --- End Max Retries Reached Logic ---
        } else {
          // --- Non-Connection Error Logic ---
          logger.message.error(
            `robustSendMessage: Unrecoverable error for action "${message.action}".`,
            lastError
          );
          reject(
            new Error(
              lastError.message ||
                `Unknown runtime error for action ${message.action}`
            )
          );
          // --- End Non-Connection Error Logic ---
        }
      } else {
        // --- Success Logic ---
        logger.message.info(
          `robustSendMessage: Received response for action "${message.action}" (Attempt ${attempt}).`
        );
        resolve(response);
        // --- End Success Logic ---
      }
    });
  });
}
