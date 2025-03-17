// src/background.js
// UPDATED VERSION - With centralized configuration storage

// Import from shared modules
import { CONTENT_TYPES, AI_PLATFORMS, STORAGE_KEYS } from './shared/constants.js';
import { determineContentType, getContentScriptFile } from './shared/content-utils.js';
import configManager from './services/ConfigManager.js';
import promptBuilder from './services/PromptBuilder.js';

// Import logger utility
const logger = require('./utils/logger');

/**
 * Initialize configuration in storage
 */
async function initializeConfiguration() {
  try {
    // Initialize configuration
    await configManager.initialize();
    logger.background.info('Configuration initialized');
  } catch (error) {
    logger.background.error('Error initializing configuration:', error);
  }
}

/**
 * Get platform configuration from config.json
 */
async function getPlatformConfig(platformId) {
  try {
    logger.background.info(`Getting config for platform: ${platformId}`);
    const response = await fetch(chrome.runtime.getURL('platform-config.json'));
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
    const result = await chrome.storage.sync.get(STORAGE_KEYS.PLATFORM_STORAGE_KEY);

    if (result[STORAGE_KEYS.PLATFORM_STORAGE_KEY]) {
      logger.background.info(`Found preferred platform: ${result[STORAGE_KEYS.PLATFORM_STORAGE_KEY]}`);
      return result[STORAGE_KEYS.PLATFORM_STORAGE_KEY];
    }

    // Check config for default platform
    const configResponse = await fetch(chrome.runtime.getURL('platform-config.json'));
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
async function extractContent(tabId, url, hasSelection = false) {
  const contentType = determineContentType(url, hasSelection);
  const scriptFile = getContentScriptFile(contentType, hasSelection);

  logger.background.info(`Extracting content from tab ${tabId}, content type: ${contentType}, hasSelection: ${hasSelection}`);
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

    // Send extraction message with selection info
    chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
      hasSelection: hasSelection
    });

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

    // Determine preferred prompt type
    const typeResult = await chrome.storage.sync.get('prompt_type_preference');
    const promptTypePreferences = typeResult.prompt_type_preference || {};
    const preferredType = promptTypePreferences[contentType] || 'default';

    logger.background.info(`Preferred prompt type: ${preferredType}`);

    // 1. Try preferred type first
    const promptId = await getPromptIdForType(preferredType, contentType);
    if (promptId) {
      logger.background.info(`Using ${preferredType} prompt ID: ${promptId}`);
      return promptId;
    }

    // 2. If preferred type is 'quick' but no valid prompt found, try custom
    if (preferredType === 'quick') {
      logger.background.info("Quick prompt unavailable, attempting to fallback to custom prompt");
      const customPromptId = await getPromptIdForType('custom', contentType);
      if (customPromptId) {
        logger.background.info(`Fallback to custom prompt ID: ${customPromptId}`);
        return customPromptId;
      }
    }

    // 3. Final fallback to default template prompt
    logger.background.info(`Fallback to default template prompt for ${contentType}`);
    return contentType;
  } catch (error) {
    logger.background.error('Error getting preferred prompt ID:', error);
    return contentType;
  }
}

// Helper function to get prompt ID for a specific type
async function getPromptIdForType(promptType, contentType) {
  try {
    if (promptType === 'quick') {
      // Check if quick prompt exists and has content
      const quickResult = await chrome.storage.sync.get('quick_prompts');
      const quickPrompts = quickResult.quick_prompts || {};

      if (quickPrompts[contentType] && quickPrompts[contentType].trim()) {
        logger.background.info('Found valid quick prompt');
        return 'quick';
      }
      return null;
    }
    else if (promptType === 'custom') {
      // First check selected custom prompt ID
      const selectionsResult = await chrome.storage.sync.get('selected_prompt_ids');
      const selections = selectionsResult.selected_prompt_ids || {};
      const key = `${contentType}-custom`;

      if (selections[key]) {
        // Verify this custom prompt still exists
        const customResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
        const customPromptsByType = customResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

        if (customPromptsByType[contentType]?.prompts?.[selections[key]]) {
          logger.background.info(`Found selected custom prompt ID: ${selections[key]}`);
          return selections[key];
        }
      }

      // If no selection or selection invalid, check if any custom prompts exist
      const customResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = customResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

      if (customPromptsByType[contentType]?.prompts) {
        const promptIds = Object.keys(customPromptsByType[contentType].prompts);
        if (promptIds.length > 0) {
          // Use preferred prompt if set, otherwise first available prompt
          const preferredId = customPromptsByType[contentType].preferredPromptId;
          const promptId = (preferredId && promptIds.includes(preferredId)) ?
                          preferredId : promptIds[0];

          logger.background.info(`Using available custom prompt ID: ${promptId}`);
          return promptId;
        }
      }
      return null;
    }
    else if (promptType === 'default') {
      return contentType; // Default prompt ID is same as content type
    }

    return null;
  } catch (error) {
    logger.background.error(`Error getting prompt ID for type ${promptType}:`, error);
    return null;
  }
}

/**
 * Get prompt content by ID
 */
async function getPromptContentById(promptId, contentType) {
  logger.background.info(`Getting prompt content for ID: ${promptId}, type: ${contentType}`);
  
  // Handle quick prompts
  if (promptId === "quick") {
    try {
      const result = await chrome.storage.sync.get('quick_prompts');
      return result.quick_prompts?.[contentType] || null;
    } catch (error) {
      logger.background.error('Error loading quick prompt:', error);
      return null;
    }
  }
  
  // If ID matches content type, it's a default prompt
  if (promptId === contentType) {
    try {
      // Get user preferences
      const userPreferences = await chrome.storage.sync.get('default_prompt_preferences');
      const typePreferences = userPreferences.default_prompt_preferences?.[contentType] || {};
      
      // Build prompt using the preferences
      return promptBuilder.buildPrompt(contentType, typePreferences);
    } catch (error) {
      logger.background.error('Error building default prompt:', error);
      return null;
    }
  }
  
  // For custom prompts
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    
    // First try to find the prompt in the content-specific storage
    let promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS]?.[contentType]?.prompts?.[promptId]?.content;
    
    // If not found, check in the shared storage
    if (!promptContent && result[STORAGE_KEYS.CUSTOM_PROMPTS]?.shared?.prompts?.[promptId]) {
      logger.background.info(`Prompt not found in ${contentType}, found in shared storage instead`);
      promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS].shared.prompts[promptId].content;
    }
    
    return promptContent || null;
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

    // Get prompt content
    const promptContent = await getPromptContentById(promptId, contentType);

    if (!promptContent) {
      throw new Error(`Could not load prompt content for ID: ${promptId}`);
    }

    // NEW: Check for extraction errors
    const { extractedContent } = await chrome.storage.local.get('extractedContent');

    // Transcript error check (existing code)
    if (contentType === CONTENT_TYPES.YOUTUBE) {
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

  // Determine if there's a text selection
  const hasSelection = info.menuItemId === 'summarizeSelection' || !!info.selectionText;

  // Extract content
  await extractContent(tab.id, tab.url, hasSelection);

  // Open AI platform
  const contentType = determineContentType(tab.url, hasSelection);
  await openAiPlatformWithContent(contentType);
}

/**
 * Initialize the extension
 */
async function initialize() {
  logger.background.info('Initializing background service worker');

  // Initialize configuration in storage
  await initializeConfiguration();

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
    } else if (aiPlatform === AI_PLATFORMS.MISTRAL && tab.url.includes('chat.mistral.ai')) {
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

  // Handler for content type detection
  if (message.action === 'getContentType') {
    const contentType = determineContentType(message.url, message.hasSelection);
    sendResponse({ contentType });
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
    return true;
  }

  // Handler for clearing quick prompts
  if (message.action === 'clearQuickPrompt') {
    (async () => {
      try {
        logger.background.info(`Clearing quick prompt for content type: ${message.contentType}`);
        const quickPrompts = await chrome.storage.sync.get('quick_prompts');

        if (quickPrompts.quick_prompts && quickPrompts.quick_prompts[message.contentType]) {
          logger.background.info(`Found quick prompt to clear for ${message.contentType}`);
          quickPrompts.quick_prompts[message.contentType] = '';
          await chrome.storage.sync.set({ quick_prompts: quickPrompts.quick_prompts });
          logger.background.info(`Successfully cleared quick prompt for ${message.contentType}`);
        } else {
          logger.background.info(`No quick prompt found for ${message.contentType}, nothing to clear`);
        }

        sendResponse({ success: true });
      } catch (error) {
        logger.background.error(`Error clearing quick prompt: ${error.message}`, error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  // Handler for summarize requests from popup
  if (message.action === 'summarizeContent') {
    (async () => {
      try {
        const { tabId, contentType, promptId, platformId, url, hasSelection, commentAnalysisRequired } = message;
        logger.background.info(`Summarize content request from popup for tab ${tabId}, type: ${contentType}, promptId: ${promptId}, platform: ${platformId}, hasSelection: ${hasSelection}`);

        // Extract content first
        await extractContent(tabId, url, hasSelection);

        // Get the extracted content
        const { extractedContent } = await chrome.storage.local.get('extractedContent');

        // Check if YouTube transcript extraction failed
        if (contentType === CONTENT_TYPES.YOUTUBE) {
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

          // Check if comment analysis is required but comments aren't loaded
          if (commentAnalysisRequired &&
              extractedContent?.commentStatus?.state === 'not_loaded' &&
              extractedContent?.commentStatus?.commentsExist) {

            logger.background.warn('YouTube comments not loaded but required for analysis, aborting summarization');

            sendResponse({
              success: false,
              youtubeCommentsError: true,
              errorMessage: extractedContent.commentStatus.message ||
                          'Comments exist but are not loaded. Scroll down on YouTube to load comments.'
            });
            return;
          }
        }

        // Check if this was a quick prompt that needs to be marked as consumed
        if (promptId === 'quick') {
          logger.background.info(`Marking quick prompt as consumed for content type: ${contentType}`);
          await chrome.storage.local.set({
            'quick_prompt_consumed': {
              contentType: contentType,
              timestamp: Date.now()
            }
          });
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

// Listen for configuration changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.template_configuration) {
    logger.background.info('Template configuration changed in storage');
  }
});