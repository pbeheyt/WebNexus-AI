// src/shared/utils/message-utils.js
import logger from '../logger';

const RETRY_DELAY = 250;

/**
 * Sends a message to the background script, handling potential connection errors
 * and performing a single retry if the Service Worker was inactive.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @param {number} [retries=1] - Maximum number of retries allowed (default is 1 retry).
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
export async function robustSendMessage(message, retries = 1) {
  if (!message || typeof message.action !== 'string') {
    logger.message.error('robustSendMessage: Invalid message object. "action" property is required.', message);
    return Promise.reject(new Error('Invalid message object passed to robustSendMessage'));
  }

  return new Promise((resolve, reject) => {
    // Ensure chrome API is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      logger.message.error('robustSendMessage: Chrome runtime API is not available.');
      return reject(new Error('Chrome runtime API not available'));
    }

    logger.message.info(`robustSendMessage: Sending action "${message.action}"...`);
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        // Check if it's a connection error and retries are left
        const isConnectionError = lastError.message?.includes('Receiving end does not exist') ||
                                  lastError.message?.includes('Could not establish connection');

        if (retries > 0 && isConnectionError) {
          logger.message.warn(`robustSendMessage: Connection error for action "${message.action}". Retrying in ${RETRY_DELAY}ms... (Retries left: ${retries - 1})`);
          setTimeout(() => {
            robustSendMessage(message, retries - 1) // Recursive call with decremented retries
              .then(resolve)
              .catch(reject);
          }, RETRY_DELAY);
        } else {
          // Not a retryable error or retries exhausted
          logger.message.error(`robustSendMessage: Unrecoverable error for action "${message.action}":`, { message: lastError.message });
          reject(new Error(lastError.message || 'Unknown runtime error'));
        }
      } else {
        // Success
        logger.message.info(`robustSendMessage: Received response for action "${message.action}".`);
        resolve(response);
      }
    });
  });
}