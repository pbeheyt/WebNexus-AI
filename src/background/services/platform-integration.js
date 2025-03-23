// src/background/services/platform-integration.js - AI platform interactions

import { AI_PLATFORMS, INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import { getPlatformConfig } from '../core/config-loader.js';
import logger from '../../utils/logger.js';

/**
 * Get platform content script path
 * @param {string} platformId - Platform identifier
 * @returns {string} Path to content script
 */
export function getPlatformContentScript() {
  // We use a unified platform content script for all platforms
  return 'dist/platform-content.bundle.js';
}

/**
 * Get preferred AI platform
 * @param {string} source - Interface source (popup, sidebar)
 * @returns {Promise<string>} Platform identifier
 */
export async function getPreferredAiPlatform(source = INTERFACE_SOURCES.POPUP) {
  try {
    logger.background.info(`Getting preferred AI platform for ${source}`);
    
    // Use source-specific storage key
    const storageKey = source === INTERFACE_SOURCES.SIDEBAR 
      ? STORAGE_KEYS.SIDEBAR_PLATFORM 
      : STORAGE_KEYS.POPUP_PLATFORM;
    
    const result = await chrome.storage.sync.get(storageKey);

    if (result[storageKey]) {
      logger.background.info(`Found preferred platform for ${source}: ${result[storageKey]}`);
      return result[storageKey];
    }

    // Check config for default platform
    const configResponse = await fetch(chrome.runtime.getURL('platform-config.json'));
    const config = await configResponse.json();

    if (config.defaultAiPlatform) {
      logger.background.info(`Using default platform from config: ${config.defaultAiPlatform}`);
      return config.defaultAiPlatform;
    }

    // Fallback to ChatGPT
    logger.background.info('No preferred platform found, using ChatGPT as default');
    return AI_PLATFORMS.CHATGPT;
  } catch (error) {
    logger.background.error('Error getting preferred AI platform:', error);
    return AI_PLATFORMS.CHATGPT; // Fallback to ChatGPT
  }
}

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
    const effectivePlatformId = platformId || await getPreferredAiPlatform();
    const platformConfig = await getPlatformConfig(effectivePlatformId);

    if (!platformConfig) {
      throw new Error(`Could not load config for platform: ${effectivePlatformId}`);
    }

    // Open platform in a new tab
    const platformUrl = platformConfig.url;
    logger.background.info(`Opening ${platformConfig.name} at URL: ${platformUrl}`);
    const newTab = await chrome.tabs.create({ url: platformUrl });

    if (!newTab || !newTab.id) {
      throw new Error(`Failed to create ${platformConfig.name} tab or get tab ID`);
    }

    logger.background.info(`${platformConfig.name} tab created with ID: ${newTab.id}`);
    
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