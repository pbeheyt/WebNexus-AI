// src/background/services/content-extraction.js - Content extraction coordination

import {
  determineContentType,
  isInjectablePage,
} from '../../shared/utils/content-utils.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

/**
 * Extract content from a tab
 * @param {number} tabId - Tab ID to extract content from
 * @param {string} url - URL of the page
 * @returns {Promise<boolean>} Success indicator
 */
export async function extractContent(tabId, url) {
  // Check if the page is injectable before proceeding
  if (!isInjectablePage(url)) {
    logger.background.warn(
      `Cannot extract content from non-injectable URL: ${url}`
    );
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONTENT_READY_FLAG]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
    });
    return false;
  }

  const contentType = determineContentType(url);
  // Use a single content script for all types
  const scriptFile = 'dist/content-script.bundle.js';

  logger.background.info(
    `Extracting content from tab ${tabId}, type: ${contentType}`
  );

  // Always inject the content script
  const result = await injectContentScript(tabId, scriptFile);
  if (!result) {
    logger.background.error(
      `Failed to inject content script into tab ${tabId}`
    );
    return false; // Stop if injection fails
  }

  // Always reset previous extraction state after successful injection
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'resetExtractor',
    });
    logger.background.info('Reset command sent to extractor');
  } catch (error) {
    // Log error but potentially continue if reset fails, as extraction might still work
    logger.background.error('Error sending reset command:', error);
  }

  // Return promise that resolves when content extraction completes
  return new Promise((resolve) => {
    const storageListener = (changes, area) => {
      if (
        area === 'local' &&
        changes[STORAGE_KEYS.CONTENT_READY_FLAG]?.newValue === true
      ) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on success
        chrome.storage.onChanged.removeListener(storageListener);
        resolve(true);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Send extraction command
    chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
      contentType: contentType,
    });

    // Failsafe timeout
    const timeoutId = setTimeout(() => {
      chrome.storage.onChanged.removeListener(storageListener);
      logger.background.warn(
        `Extraction timeout for ${contentType}, proceeding anyway`
      );
      resolve(false);
    }, 15000);
  });
}

/**
 * Inject content script into tab
 * @param {number} tabId - Tab ID to inject into
 * @param {string} scriptFile - Script file to inject
 * @returns {Promise<boolean>} Success flag
 */
export async function injectContentScript(tabId, scriptFile) {
  try {
    logger.background.info(
      `Injecting script: ${scriptFile} into tab: ${tabId}`
    );
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile],
    });
    logger.background.info(
      `Successfully injected script: ${scriptFile} into tab: ${tabId}`
    );
    return true;
  } catch (error) {
    logger.background.error(`Script injection error for tab ${tabId}:`, error);
    return false;
  }
}
