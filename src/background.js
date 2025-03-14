// src/background.js
// FIXED VERSION - Removed document references

// Import logger utility
const logger = require('./utils/logger');

// Constants
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

const AI_PLATFORMS = {
  CLAUDE: 'claude',
  CHATGPT: 'chatgpt',
  DEEPSEEK: 'deepseek'
};

const STORAGE_KEY = 'custom_prompts_by_type';
const PLATFORM_STORAGE_KEY = 'preferred_ai_platform';

/**
 * Determine content type based on URL
 */
function getContentTypeForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return CONTENT_TYPES.REDDIT;
  } else {
    return CONTENT_TYPES.GENERAL;
  }
}

/**
 * Get platform configuration from config.json
 */
async function getPlatformConfig(platformId) {
  try {
    logger.background.info(`Getting config for platform: ${platformId}`);
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();

    if (config.aiPlatforms && config.aiPlatforms[platformId]) {
      return config.aiPlatforms[platformId];
    } else {
      logger.background.error(`Platform config not found for: ${platformId}`);
      return null;
    }
  } catch (error) {
    logger.background.error(`Error loading platform config for ${platformId}:`, error);
    return null;
  }
}

/**
 * Get preferred AI platform or default
 */
async function getPreferredAiPlatform() {
  try {
    logger.background.info('Getting preferred AI platform');
    const result = await chrome.storage.sync.get(PLATFORM_STORAGE_KEY);

    if (result[PLATFORM_STORAGE_KEY]) {
      logger.background.info(`Found preferred platform: ${result[PLATFORM_STORAGE_KEY]}`);
      return result[PLATFORM_STORAGE_KEY];
    }

    // Check config for default platform
    const configResponse = await fetch(chrome.runtime.getURL('config.json'));
    const config = await configResponse.json();

    if (config.defaultAiPlatform) {
      logger.background.info(`Using default platform from config: ${config.defaultAiPlatform}`);
      return config.defaultAiPlatform;
    }

    // Fallback to Claude
    logger.background.info('No preferred platform found, using Claude as default');
    return AI_PLATFORMS.CLAUDE;
  } catch (error) {
    logger.background.error('Error getting preferred AI platform:', error);
    return AI_PLATFORMS.CLAUDE; // Fallback to Claude
  }
}

/**
 * Get content script file for platform
 */
function getPlatformContentScript(platformId) {
  // Now we just return the unified platform content script
  return 'dist/platform-content.bundle.js';
}

/**
 * Inject content script into tab
 */
async function injectContentScript(tabId, scriptFile) {
  try {
    logger.background.info(`Injecting script: ${scriptFile} into tab: ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });
    logger.background.info(`Successfully injected script: ${scriptFile} into tab: ${tabId}`);
    return true;
  } catch (error) {
    logger.background.error(`Script injection error for tab ${tabId}:`, error);
    return false;
  }
}

/**
 * Extract content from a tab
 */
async function extractContent(tabId, url) {
  const contentType = getContentTypeForUrl(url);
  let scriptFile = `dist/${contentType}-content.bundle.js`;

  logger.background.info(`Extracting content from tab ${tabId}, content type: ${contentType}`);
  await injectContentScript(tabId, scriptFile);

  // Return promise that resolves when content extraction completes
  return new Promise((resolve) => {
    // Set up storage change listener before sending extraction message
    const storageListener = (changes, area) => {
      if (area === 'local' && changes.contentReady?.newValue === true) {
        chrome.storage.onChanged.removeListener(storageListener);
        resolve(true);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Send extraction message
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' });

    // Set timeout to prevent indefinite hanging
    setTimeout(() => {
      chrome.storage.onChanged.removeListener(storageListener);
      logger.background.warn(`Extraction timeout for ${contentType}, proceeding anyway`);
      resolve(false);
    }, 15000); // 15 second failsafe
  });
}

/**
 * Get preferred prompt ID for a content type
 */
async function getPreferredPromptId(contentType) {
  try {
    logger.background.info(`Getting preferred prompt ID for content type: ${contentType}`);
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const customPromptsByType = result[STORAGE_KEY] || {};

    // If we have custom prompts for this type with a preferred prompt set
    if (customPromptsByType[contentType] && customPromptsByType[contentType].preferredPromptId) {
      logger.background.info(`Found preferred prompt ID: ${customPromptsByType[contentType].preferredPromptId}`);
      return customPromptsByType[contentType].preferredPromptId;
    }

    // Default to the default prompt ID (same as the content type)
    logger.background.info(`No preferred prompt found, using default: ${contentType}`);
    return contentType;
  } catch (error) {
    logger.background.error('Error getting preferred prompt ID:', error);
    return contentType;
  }
}

/**
 * Get prompt content by ID
 */
async function getPromptContentById(promptId, contentType) {
  logger.background.info(`Getting prompt content for ID: ${promptId}, type: ${contentType}`);

  // If the promptId is the same as contentType, it's a default prompt
  if (promptId === contentType) {
    try {
      // Get default prompt template and user preferences
      logger.background.info('Loading default prompt from config');
      const [config, userPreferences] = await Promise.all([
        fetch(chrome.runtime.getURL('config.json')).then(r => r.json()),
        chrome.storage.sync.get('default_prompt_preferences')
      ]);

      const promptConfig = config.defaultPrompts && config.defaultPrompts[contentType];

      if (!promptConfig) {
        logger.background.warn(`No default prompt found for ${contentType}`);
        return null;
      }

      // Get user preferences for this content type
      const typePreferences = userPreferences.default_prompt_preferences?.[contentType] || {};
      const defaultPreferences = promptConfig.defaultPreferences || {};

      // Merge default preferences with user preferences
      const preferences = { ...defaultPreferences, ...typePreferences };

      // Get parameters
      const parameters = promptConfig.parameters || {};

      // Build prompt by replacing placeholders
      let prompt = promptConfig.baseTemplate;

      // Process each parameter type
      for (const [paramKey, paramOptions] of Object.entries(parameters)) {
        const userValue = preferences[paramKey];
        const replacement = paramOptions[String(userValue)] || '';

        // Replace in template
        const placeholder = `{{${paramKey}}}`;
        prompt = prompt.replace(placeholder, replacement);
      }

      return prompt;
    } catch (error) {
      logger.background.error('Error loading default prompt:', error);
      return null;
    }
  }

  // Otherwise, it's a custom prompt
  try {
    logger.background.info('Loading custom prompt from storage');
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const customPromptsByType = result[STORAGE_KEY] || {};

    if (customPromptsByType[contentType] &&
        customPromptsByType[contentType].prompts &&
        customPromptsByType[contentType].prompts[promptId]) {
      logger.background.info('Custom prompt found in storage');
      return customPromptsByType[contentType].prompts[promptId].content;
    } else {
      logger.background.warn(`Custom prompt not found: ${promptId}`);
      return null;
    }
  } catch (error) {
    logger.background.error('Error loading custom prompt:', error);
    return null;
  }
}

/**
 * Open AI platform with extracted content
 */
async function openAiPlatformWithContent(contentType, promptId = null, platformId = null) {
  try {
    // If no promptId provided, use the preferred prompt for this content type
    if (!promptId) {
      promptId = await getPreferredPromptId(contentType);
    }

    // If no platformId provided, use the preferred platform
    if (!platformId) {
      platformId = await getPreferredAiPlatform();
    }

    // NEW: Check if content extraction had errors for YouTube
    if (contentType === CONTENT_TYPES.YOUTUBE) {
      const { extractedContent } = await chrome.storage.local.get('extractedContent');

      if (extractedContent?.error &&
          extractedContent?.transcript &&
          typeof extractedContent.transcript === 'string' &&
          (extractedContent.transcript.includes('No transcript') ||
           extractedContent.transcript.includes('Transcript is not available'))) {

        logger.background.warn('YouTube transcript error detected, aborting platform open');

        // Notify popup about transcript error
        chrome.runtime.sendMessage({
          action: 'youtubeTranscriptError',
          message: extractedContent.message || 'Failed to retrieve YouTube transcript.'
        });

        return null; // Return null to indicate operation was aborted
      }
    }

    // Get prompt content
    const promptContent = await getPromptContentById(promptId, contentType);

    if (!promptContent) {
      throw new Error(`Could not load prompt content for ID: ${promptId}`);
    }

    // Get platform config
    const platformConfig = await getPlatformConfig(platformId);

    if (!platformConfig) {
      throw new Error(`Could not load config for platform: ${platformId}`);
    }

    // Open platform in a new tab
    const platformUrl = platformConfig.url;
    logger.background.info(`Opening ${platformConfig.name} at URL: ${platformUrl}`);
    const newTab = await chrome.tabs.create({ url: platformUrl });

    if (!newTab || !newTab.id) {
      throw new Error(`Failed to create ${platformConfig.name} tab or get tab ID`);
    }

    logger.background.info(`${platformConfig.name} tab created with ID: ${newTab.id}`);

    // Save tab ID, platform, and prompt for later
    await chrome.storage.local.set({
      aiPlatformTabId: newTab.id,
      aiPlatform: platformId,
      scriptInjected: false,
      prePrompt: promptContent
    });

    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get(['aiPlatformTabId', 'aiPlatform', 'scriptInjected']);
    logger.background.info(`Storage verification: aiPlatformTabId=${verifyData.aiPlatformTabId}, aiPlatform=${verifyData.aiPlatform}, scriptInjected=${verifyData.scriptInjected}`);

    return newTab.id;
  } catch (error) {
    logger.background.error('Error opening AI platform:', error);
    return null;
  }
}

/**
 * Handle context menu click
 */
async function handleContextMenuClick(info, tab) {
  logger.background.info('Context menu clicked', { info, tabId: tab.id });

  // Clear any existing content
  await chrome.storage.local.set({
    contentReady: false,
    extractedContent: null,
    aiPlatformTabId: null,
    scriptInjected: false
  });
  logger.background.info('Cleared previous extracted content and tab state');

  // Extract content
  await extractContent(tab.id, tab.url);

  // Open AI platform
  const contentType = getContentTypeForUrl(tab.url);
  await openAiPlatformWithContent(contentType);
}

/**
 * Initialize the extension
 */
async function initialize() {
  logger.background.info('Initializing background service worker');

  // Create context menus
  chrome.contextMenus.create({
    id: 'summarizeContent',
    title: 'Summarize with AI',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: 'Summarize Selection with AI',
    contexts: ['selection']
  });
  logger.background.info('Context menus created');

  // Reset state
  await chrome.storage.local.set({
    scriptInjected: false,
    aiPlatformTabId: null
  });
  logger.background.info('Initial state reset complete');
}

// Tab update listener for AI platform integration
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  try {
    const storageData = await chrome.storage.local.get(['aiPlatformTabId', 'aiPlatform', 'scriptInjected']);
    const { aiPlatformTabId, aiPlatform, scriptInjected } = storageData;

    // Check if this is our AI platform tab
    if (tabId !== aiPlatformTabId || scriptInjected) {
      return;
    }

    // Determine which platform we're dealing with
    let isPlatformTab = false;

    if (aiPlatform === AI_PLATFORMS.CLAUDE && tab.url.includes('claude.ai')) {
      isPlatformTab = true;
    } else if (aiPlatform === AI_PLATFORMS.CHATGPT && tab.url.includes('chatgpt.com')) {
      isPlatformTab = true;
    } else if (aiPlatform === AI_PLATFORMS.DEEPSEEK && tab.url.includes('chat.deepseek.com')) {
      isPlatformTab = true;
    }

    if (!isPlatformTab) {
      return;
    }

    logger.background.info(`${aiPlatform} tab detected and loaded: ${tabId}`, { url: tab.url });

    // Get the appropriate content script
    const contentScript = getPlatformContentScript(aiPlatform);

    // Inject content script
    logger.background.info(`Injecting ${aiPlatform} content script into tab: ${tabId}`);
    await injectContentScript(tabId, contentScript);

    logger.background.info(`Setting scriptInjected flag to true for tab: ${tabId}`);
    await chrome.storage.local.set({ scriptInjected: true });

    // Retrieve the extracted content to verify it's available
    const { extractedContent } = await chrome.storage.local.get('extractedContent');
    logger.background.info('Content available for AI platform:', {
      hasContent: !!extractedContent,
      contentType: extractedContent?.contentType
    });
  } catch (error) {
    logger.background.error(`Error handling tab update for tab ${tabId}:`, error);
  }
});

// Context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Extension installation listener
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.background.info('Extension installed/updated', details);
  await initialize();
});

// Message listener for handling requests from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.background.info('Message received in background', {
    message,
    sender: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
  });

  if (message.action === 'checkStatus') {
    sendResponse({ status: 'ok' });
    return true;
  }

  // Handler for YouTube comments not loaded notification
  if (message.action === 'youtubeCommentsNotLoaded') {
    logger.background.info('YouTube comments not loaded notification received');
    // Relay to popup if open
    chrome.runtime.sendMessage({
      action: 'youtubeCommentsNotLoaded'
    });
    return true;
  }

  // Handler for error notifications from content scripts
  if (message.action === 'notifyError') {
    logger.background.error('Error from content script:', message.error);
    // We could show a notification here or handle in some other way
    return true;
  }

  // Handler for summarize requests from popup
  if (message.action === 'summarizeContent') {
    (async () => {
      try {
        const { tabId, contentType, promptId, platformId, url } = message;
        logger.background.info(`Summarize content request from popup for tab ${tabId}, type: ${contentType}, promptId: ${promptId}, platform: ${platformId}`);

        // Extract content first
        await extractContent(tabId, url);

        // Check if YouTube transcript extraction failed
        if (contentType === CONTENT_TYPES.YOUTUBE) {
          const { extractedContent } = await chrome.storage.local.get('extractedContent');

          if (extractedContent?.error &&
              extractedContent?.transcript &&
              typeof extractedContent.transcript === 'string' &&
              (extractedContent.transcript.includes('No transcript') ||
               extractedContent.transcript.includes('Transcript is not available'))) {

            logger.background.warn('YouTube transcript error detected, aborting summarization');

            sendResponse({
              success: false,
              youtubeTranscriptError: true,
              errorMessage: extractedContent.message || 'Failed to retrieve YouTube transcript.'
            });
            return;
          }
        }

        // Give time for content extraction to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Then open AI platform with the content
        const aiPlatformTabId = await openAiPlatformWithContent(contentType, promptId, platformId);

        sendResponse({
          success: true,
          aiPlatformTabId
        });
      } catch (error) {
        logger.background.error('Error handling summarize content request:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // Keep channel open for async response
  }
});

// Debug logging for extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
  logger.background.info('Background service worker suspending');
});
