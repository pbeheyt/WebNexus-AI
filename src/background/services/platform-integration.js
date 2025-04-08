// src/background/services/platform-integration.js - AI platform interactions

import { AI_PLATFORMS, INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
// Removed getPlatformConfig import
import logger from '../../shared/logger.js';

/**
 * Get platform content script path
 * @param {string} platformId - Platform identifier
 * @returns {string} Path to content script
 */
export function getPlatformContentScript() {
  // We use a unified platform content script for all platforms
  return 'dist/platform-content.bundle.js';
}

// REMOVED getPreferredAiPlatform function

/**
 * Open AI platform with extracted content
 * @param {string} contentType - Content type
 * @param {string} promptId - Prompt ID
 * @param {string} platformId - Platform ID
 * @returns {Promise<number|null>} Tab ID or null
 */
export async function openAiPlatformWithContent(contentType, promptId, platformId) {
  try {
    // Prepare platform and prompt information
    const effectivePlatformId = platformId; // Assuming platformId is always provided now
    if (!effectivePlatformId) {
        throw new Error('Platform ID must be provided to openAiPlatformWithContent');
    }

    // Fetch display config directly
    const displayConfigResponse = await fetch(chrome.runtime.getURL('platform-display-config.json'));
    const displayConfig = await displayConfigResponse.json();
    const platformDisplayInfo = displayConfig?.aiPlatforms?.[effectivePlatformId];

    if (!platformDisplayInfo || !platformDisplayInfo.url || !platformDisplayInfo.name) {
      throw new Error(`Could not load display config (url, name) for platform: ${effectivePlatformId}`);
    }

    // Open platform in a new tab using display info
    const platformUrl = platformDisplayInfo.url;
    const platformName = platformDisplayInfo.name;
    logger.background.info(`Opening ${platformName} at URL: ${platformUrl}`);
    const newTab = await chrome.tabs.create({ url: platformUrl });

    if (!newTab || !newTab.id) {
      throw new Error(`Failed to create ${platformName} tab or get tab ID`);
    }

    logger.background.info(`${platformName} tab created with ID: ${newTab.id}`);
    
    // The prompt content will be retrieved by the caller and passed to savePlatformTabInfo
    
    return newTab.id;
  } catch (error) {
    logger.background.error('Error opening AI platform:', error);
    return null;
  }
}

/**
 * Check if a tab is a platform tab
 * @param {number} tabId - Tab ID to check
 * @param {string} url - Tab URL
 * @param {string} platformId - Platform ID
 * @returns {boolean} Whether this is a platform tab
 */
export function isPlatformTab(tabId, url, platformId) {
  let isPlatformTab = false;

  if (platformId === AI_PLATFORMS.CLAUDE && url.includes('claude.ai')) {
    isPlatformTab = true;
  } else if (platformId === AI_PLATFORMS.CHATGPT && url.includes('chatgpt.com')) {
    isPlatformTab = true;
  } else if (platformId === AI_PLATFORMS.DEEPSEEK && url.includes('chat.deepseek.com')) {
    isPlatformTab = true;
  } else if (platformId === AI_PLATFORMS.MISTRAL && url.includes('chat.mistral.ai')) {
    isPlatformTab = true;
  } else if (platformId === AI_PLATFORMS.GEMINI && url.includes('gemini.google.com')) {
    isPlatformTab = true;
  } else if (platformId === AI_PLATFORMS.GROK && url.includes('grok.com')) {
    isPlatformTab = true;
  }

  return isPlatformTab;
}
