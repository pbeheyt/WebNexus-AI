// src/shared/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Console-only implementation with backward compatibility
 */

// Determine if running in production mode (set by Webpack's mode option)
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Log a message to console, conditionally skipping 'info' and 'debug' logs in production.
 * @param {string} context - The context (background, content, popup, etc.)
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - The message to log
 * @param {any} [data=null] - Optional data to include
 */
function log(context, level, message, data = null) {
  // --- Production Log Filtering ---
  // Skip 'info' and 'debug' level logs when in production mode
  if (isProduction && (level === 'info' || level === 'debug')) {
    return; // Exit early, do not log
  }
  // -----------------------------

  // Map level to allowed console method
  let consoleMethod;
  switch (level) {
    case 'error':
      consoleMethod = 'error';
      break;
    case 'warn':
      consoleMethod = 'warn';
      break;
    case 'info':
    case 'debug': // Map debug to info as console.debug is not explicitly allowed
      consoleMethod = 'info';
      break;
    default:
      consoleMethod = 'info'; // Default to info for unknown levels
  }

  // Format prefix with context
  const prefix = `[${context}]`;

  // Log to console with or without data using the determined allowed method
  if (data !== null) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }
}

export const logger = {
  api: {
    debug: (message, data) => log('api', 'debug', message, data),
    info: (message, data) => log('api', 'info', message, data),
    warn: (message, data) => log('api', 'warn', message, data),
    error: (message, data) => log('api', 'error', message, data),
  },
  background: {
    debug: (message, data) => log('background', 'debug', message, data),
    info: (message, data) => log('background', 'info', message, data),
    warn: (message, data) => log('background', 'warn', message, data),
    error: (message, data) => log('background', 'error', message, data),
  },
  content: {
    debug: (message, data) => log('content', 'debug', message, data),
    info: (message, data) => log('content', 'info', message, data),
    warn: (message, data) => log('content', 'warn', message, data),
    error: (message, data) => log('content', 'error', message, data),
  },
  extractor: {
    debug: (message, data) => log('extractor', 'debug', message, data),
    info: (message, data) => log('extractor', 'info', message, data),
    warn: (message, data) => log('extractor', 'warn', message, data),
    error: (message, data) => log('extractor', 'error', message, data),
  },
  popup: {
    debug: (message, data) => log('popup', 'debug', message, data),
    info: (message, data) => log('popup', 'info', message, data),
    warn: (message, data) => log('popup', 'warn', message, data),
    error: (message, data) => log('popup', 'error', message, data),
  },
  platform: {
    debug: (message, data) => log('platform', 'debug', message, data),
    info: (message, data) => log('platform', 'info', message, data),
    warn: (message, data) => log('platform', 'warn', message, data),
    error: (message, data) => log('platform', 'error', message, data),
  },
  message: {
    debug: (message, data) => log('message', 'debug', message, data),
    info: (message, data) => log('message', 'info', message, data),
    warn: (message, data) => log('message', 'warn', message, data),
    error: (message, data) => log('message', 'error', message, data),
  },
  service: {
    debug: (message, data) => log('service', 'debug', message, data),
    info: (message, data) => log('service', 'info', message, data),
    warn: (message, data) => log('service', 'warn', message, data),
    error: (message, data) => log('service', 'error', message, data),
  },
  settings: {
    debug: (message, data) => log('settings', 'debug', message, data),
    info: (message, data) => log('settings', 'info', message, data),
    warn: (message, data) => log('settings', 'warn', message, data),
    error: (message, data) => log('settings', 'error', message, data),
  },
  sidebar: {
    debug: (message, data) => log('sidebar', 'debug', message, data),
    info: (message, data) => log('sidebar', 'info', message, data),
    warn: (message, data) => log('sidebar', 'warn', message, data),
    error: (message, data) => log('sidebar', 'error', message, data),
  },
};