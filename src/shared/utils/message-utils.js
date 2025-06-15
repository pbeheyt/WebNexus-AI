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
    // --- Guard against missing runtime API ---
    // This can happen in orphaned content scripts after an extension reload.
    if (
      typeof chrome === 'undefined' ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      // Silently resolve, as this context is non-functional and cannot recover.
      // This prevents console errors from orphaned scripts.
      return resolve();
    }

    // Attempt to send the message
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          // --- Context Invalidated Error Handling (Permanent & Unrecoverable) ---
          if (
            lastError.message?.includes('Extension context invalidated') ||
            lastError.message?.includes('Chrome runtime API is not available')
          ) {
            // This is an expected error from an orphaned content script.
            // Silently resolve to prevent console spam. The script is non-functional.
            return resolve();
          }

          // --- Retryable Connection Error Handling ---
          const isRetryableError =
            lastError.message?.includes('Port closed') ||
            lastError.message?.includes('Could not establish connection') ||
            lastError.message?.includes('The message port closed');

          if (isRetryableError && attempt <= MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.message.info(
              `robustSendMessage: Connection error for action "${message.action}" on attempt ${attempt}. Retrying in ${delay}ms...`
            );
            setTimeout(() => {
              robustSendMessage(message, attempt + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
            return; // Important: exit promise callback after starting timeout
          }

          // --- Max Retries Reached or Non-Retryable Error ---
          if (isRetryableError && attempt > MAX_RETRIES) {
            logger.message.warn(
              `robustSendMessage: Communication failed for action "${message.action}" after ${attempt} attempts.`
            );
            const communicationError = new Error(
              `Communication failed after ${MAX_RETRIES + 1} attempts.`
            );
            communicationError.isPortClosed = true;
            return reject(communicationError);
          }

          // --- Other Unrecoverable Errors ---
          logger.message.error(
            `robustSendMessage: Unrecoverable error for action "${message.action}".`,
            lastError
          );
          return reject(
            new Error(
              lastError.message ||
                `Unknown runtime error for action ${message.action}`
            )
          );
        }

        // --- Success Logic ---
        resolve(response);
      });
    } catch (e) {
      // This catches synchronous errors thrown by sendMessage, which can happen if the context
      // is invalidated so severely that the browser knows it's impossible to even attempt the call.
      if (e.message?.includes('Extension context invalidated')) {
        // This is an expected error from an orphaned content script.
        // Silently resolve to prevent console spam. The script is non-functional.
        return resolve();
      }
      // For any other unexpected synchronous error, we should reject.
      return reject(e);
    }
  });
}
