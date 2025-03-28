// src/background/services/tab-extraction-preference.js
const { STORAGE_KEYS } = require('../../shared/constants');
const logger = require('../../utils/logger').service;
// Import the function from state-manager
const { clearStoredFormattedContentForTab } = require('../core/state-manager');

/**
 * Get the content extraction preference for a specific tab.
 * @param {number} tabId - The ID of the tab.
 * @returns {Promise<boolean>} - True if extraction is enabled (default), false otherwise.
 */
export async function getExtractionPreference(tabId) {
  if (!tabId) {
    logger.warn('getExtractionPreference called without tabId, returning default true.');
    return true; // Default to enabled if no tabId
  }
  try {
    const key = STORAGE_KEYS.TAB_CONTENT_EXTRACTION_PREFERENCE;
    const result = await chrome.storage.local.get(key);
    const preferences = result[key] || {};
    // Default to true (enabled) if no preference is set for the tab
    return preferences[tabId] === undefined ? true : preferences[tabId];
  } catch (error) {
    logger.error(`Error getting extraction preference for tab ${tabId}:`, error);
    return true; // Default to true on error
  }
}

/**
 * Set the content extraction preference for a specific tab.
 * Also clears any stored formatted content for that tab to reset context.
 * @param {number} tabId - The ID of the tab.
 * @param {boolean} isEnabled - The desired extraction state.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function setExtractionPreference(tabId, isEnabled) {
  if (!tabId) {
    logger.error('setExtractionPreference called without tabId.');
    return false;
  }
  try {
    const key = STORAGE_KEYS.TAB_CONTENT_EXTRACTION_PREFERENCE;
    const result = await chrome.storage.local.get(key);
    const preferences = result[key] || {};
    const newValue = !!isEnabled; // Ensure it's stored as a boolean
    const oldValue = preferences[tabId];

    // Only proceed if the value actually changed or was never set
    if (oldValue === undefined || oldValue !== newValue) {
        preferences[tabId] = newValue;
        await chrome.storage.local.set({ [key]: preferences });
        logger.info(`Set extraction preference for tab ${tabId} to ${newValue}`);

        // Clear stored content when preference changes to reset context state
        await clearStoredFormattedContentForTab(tabId);
    } else {
        logger.info(`Extraction preference for tab ${tabId} already set to ${newValue}. No change needed.`);
    }

    return true;
  } catch (error) {
    logger.error(`Error setting extraction preference for tab ${tabId}:`, error);
    return false;
  }
}

// --- Add other tab preference functions here if needed ---