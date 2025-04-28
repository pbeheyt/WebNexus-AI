// src/shared/utils/message-utils.js
import logger from '../logger';

/**
 * Sends a message to the background script with robust error handling.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
export async function robustSendMessage(message) {
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

    logger.message.info(`robustSendMessage: Sending action "${message.action}"...`);

    // Attempt to send the message
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        if (lastError.message?.includes('The message port closed before a response was received')) {
          logger.message.warn(`robustSendMessage: Port closed before response for action "${message.action}". This might be expected (e.g., popup closed).`);
          const portClosedError = new Error(`Port closed before response for action: ${message.action}`);
          portClosedError.isPortClosed = true;
          reject(portClosedError);
        } else {
          logger.message.error(`robustSendMessage: Unrecoverable error for action "${message.action}".`, lastError);
          reject(new Error(lastError.message || `Unknown runtime error for action ${message.action}`));
        }
      } else {
        // Message sent and response received successfully
        logger.message.info(`robustSendMessage: Received response for action "${message.action}".`);
        resolve(response);
      }
    });
  });
}
