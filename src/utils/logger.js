// src/utils/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Works in background service workers, content scripts, and popups
 */

const LOG_STORAGE_KEY = 'extension_debug_logs';
const MAX_LOGS = 500; // Maximum number of logs to keep

/**
 * Log a message to storage and console
 * @param {string} context - The context (background, content, popup)
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - The message to log
 * @param {any} data - Optional data to include
 */
async function log(context, level, message, data = null) {
  // Always log to console
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  const prefix = `[${context}]`;
  
  if (data !== null) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }
  
  try {
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      level,
      message,
      data: data !== null ? JSON.stringify(data) : null
    };
    
    // Get existing logs
    const { [LOG_STORAGE_KEY]: existingLogs = [] } = await chrome.storage.local.get(LOG_STORAGE_KEY);
    
    // Add new log and limit size
    const updatedLogs = [logEntry, ...existingLogs].slice(0, MAX_LOGS);
    
    // Save to storage
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: updatedLogs });
  } catch (error) {
    // If storage fails, at least we logged to console
    console.error('[Logger] Failed to save log to storage:', error);
  }
}

/**
 * Get all logs from storage
 * @returns {Promise<Array>} Array of log entries
 */
async function getLogs() {
  try {
    const { [LOG_STORAGE_KEY]: logs = [] } = await chrome.storage.local.get(LOG_STORAGE_KEY);
    return logs;
  } catch (error) {
    console.error('[Logger] Failed to retrieve logs:', error);
    return [];
  }
}

/**
 * Clear all logs from storage
 */
async function clearLogs() {
  try {
    await chrome.storage.local.remove(LOG_STORAGE_KEY);
  } catch (error) {
    console.error('[Logger] Failed to clear logs:', error);
  }
}

// Convenience methods
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
  claude: {
    info: (message, data) => log('claude', 'info', message, data),
    warn: (message, data) => log('claude', 'warn', message, data),
    error: (message, data) => log('claude', 'error', message, data)
  },
  getLogs,
  clearLogs
};

module.exports = logger;