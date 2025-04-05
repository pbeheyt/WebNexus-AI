// src/shared/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Console-only implementation with backward compatibility
 */

/**
 * Log a message to console
 * @param {string} context - The context (background, content, popup)
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - The message to log
 * @param {any} data - Optional data to include
 */
function log(context, level, message, data = null) {
  // Map level to console method
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  
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
  console.log('[Logger] getLogs called - logs are not being stored in this version');
  return [];
}

/**
 * Stub function for backward compatibility
 */
async function clearLogs() {
  console.log('[Logger] clearLogs called - logs are not being stored in this version');
}

// Maintain the exact same interface for backward compatibility
const logger = {
  background: {
    info: (message, data) => log('background', 'info', message, data),
    warn: (message, data) => log('background', 'warn', message, data),
    error: (message, data) => log('background', 'error', message, data)
  },
  content: {
    info: (message, data) => log('content', 'info', message, data),
    warn: (message, data) => log('content', 'warn', message, data),
    error: (message, data) => log('content', 'error', message, data)
  },
  popup: {
    info: (message, data) => log('popup', 'info', message, data),
    warn: (message, data) => log('popup', 'warn', message, data),
    error: (message, data) => log('popup', 'error', message, data)
  },
  service: {
    info: (message, data) => log('service', 'info', message, data),
    warn: (message, data) => log('service', 'warn', message, data),
    error: (message, data) => log('service', 'error', message, data)
  },
  sidebar: { // Add sidebar logger instance
    info: (message, data) => log('sidebar', 'info', message, data),
    warn: (message, data) => log('sidebar', 'warn', message, data),
    error: (message, data) => log('sidebar', 'error', message, data)
  },
  getLogs,
  clearLogs
};

module.exports = logger;
