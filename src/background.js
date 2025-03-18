// src/background.js
// UPDATED VERSION - With centralized summarization workflow

// Import from shared modules
import { CONTENT_TYPES, AI_PLATFORMS, STORAGE_KEYS } from './shared/constants.js';
import { determineContentType, getContentScriptFile } from './shared/content-utils.js';
import configManager from './services/ConfigManager.js';
import promptBuilder from './services/PromptBuilder.js';
const ApiServiceManager = require('./services/ApiServiceManager');
const CredentialManager = require('./services/CredentialManager');


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
    logger.background.info('No preferred platform found, using Chatgpt as default');
    return AI_PLATFORMS.CHATGPT;
  } catch (error) {
    logger.background.error('Error getting preferred AI platform:', error);
    return AI_PLATFORMS.CHATGPT; // Fallback to Claude
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
  // Use a single content script for all types
  const scriptFile = 'dist/content-script.bundle.js';

  logger.background.info(`Extracting content from tab ${tabId}, type: ${contentType}, hasSelection: ${hasSelection}`);
  
  // Check if content script is loaded
  let isScriptLoaded = false;
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'ping' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300))
    ]);
    isScriptLoaded = !!(response && response.ready);
  } catch (error) {
    logger.background.info('Content script not loaded, will inject');
  }
  
  // Inject if needed
  if (!isScriptLoaded) {
    const result = await injectContentScript(tabId, scriptFile);
    if (!result) {
      logger.background.error(`Failed to inject content script`);
      return false;
    }
  }

  // Always reset previous extraction state
  try {
    await chrome.tabs.sendMessage(tabId, { 
      action: 'resetExtractor',
      hasSelection: hasSelection
    });
    logger.background.info('Reset command sent to extractor');
  } catch (error) {
    logger.background.error('Error sending reset command:', error);
  }
  
  // Return promise that resolves when content extraction completes
  return new Promise((resolve) => {
    const storageListener = (changes, area) => {
      if (area === 'local' && changes.contentReady?.newValue === true) {
        chrome.storage.onChanged.removeListener(storageListener);
        resolve(true);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Send extraction command
    chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
      hasSelection: hasSelection,
      contentType: contentType
    });

    // Failsafe timeout
    setTimeout(() => {
      chrome.storage.onChanged.removeListener(storageListener);
      logger.background.warn(`Extraction timeout for ${contentType}, proceeding anyway`);
      resolve(false);
    }, 15000);
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

    // Check for extraction errors
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
 * Centralized function to handle content summarization
 * This is the key improvement - all paths now go through this function
 * @param {Object} params - Parameters object containing all necessary info for summarization
 * @returns {Promise<Object>} Result object with success/error information
 */
async function summarizeContent(params) {
  const { 
    tabId, 
    url, 
    hasSelection = false, 
    promptId = null, 
    platformId = null, 
    commentAnalysisRequired = false,
    useApi = false // New parameter for API mode
  } = params;
  
  try {
    logger.background.info('Starting centralized content summarization process', { ...params, useApi });
    
    // Check if we should use API mode
    if (useApi) {
      return await summarizeContentViaApi(params);
    }
    
    // 1. Reset previous state
    await chrome.storage.local.set({
      contentReady: false,
      extractedContent: null,
      aiPlatformTabId: null,
      scriptInjected: false,
      currentSummarizationMode: 'browser' // Track that we're using browser mode
    });
    logger.background.info('Cleared previous extracted content and tab state');
    
    // 2. Extract content (single extraction point)
    const contentType = determineContentType(url, hasSelection);
    logger.background.info(`Content type determined: ${contentType}, hasSelection: ${hasSelection}`);
    
    const extractionResult = await extractContent(tabId, url, hasSelection);
    if (!extractionResult) {
      logger.background.warn('Content extraction completed with issues');
    }

    // 3. Check for specific errors, especially for YouTube
    const { extractedContent } = await chrome.storage.local.get('extractedContent');
    
    // YouTube transcript error check
    if (contentType === CONTENT_TYPES.YOUTUBE && !hasSelection) {
      if (extractedContent?.error &&
          extractedContent?.transcript &&
          typeof extractedContent.transcript === 'string' &&
          (extractedContent.transcript.includes('No transcript') ||
          extractedContent.transcript.includes('Transcript is not available'))) {
        
        logger.background.warn('YouTube transcript error detected, aborting summarization');
        
        return {
          success: false,
          youtubeTranscriptError: true,
          errorMessage: extractedContent.message || 'Failed to retrieve YouTube transcript.'
        };
      }
      
      // YouTube comments check (only if required by the prompt)
      if (commentAnalysisRequired &&
          extractedContent?.commentStatus?.state === 'not_loaded' &&
          extractedContent?.commentStatus?.commentsExist) {
          
        logger.background.warn('YouTube comments required but not loaded');
        
        // Notify popup if it's open
        try {
          chrome.runtime.sendMessage({
            action: 'youtubeCommentsNotLoaded'
          });
        } catch (error) {
          // Ignore message sending error if popup isn't open
        }
        
        return {
          success: false,
          youtubeCommentsError: true,
          errorMessage: extractedContent.commentStatus.message ||
                      'Comments exist but are not loaded. Scroll down on YouTube to load comments.'
        };
      }
    }
    
    // 4. Handle quick prompt consumption tracking if needed
    if (promptId === 'quick') {
      logger.background.info(`Marking quick prompt as consumed for content type: ${contentType}`);
      await chrome.storage.local.set({
        'quick_prompt_consumed': {
          contentType: contentType,
          timestamp: Date.now()
        }
      });
    }
    
    // 5. Open AI platform with the content
    const aiPlatformTabId = await openAiPlatformWithContent(contentType, promptId, platformId);
    
    if (!aiPlatformTabId) {
      return {
        success: false,
        error: 'Failed to open AI platform tab'
      };
    }
    
    return {
      success: true,
      aiPlatformTabId,
      contentType
    };
  } catch (error) {
    logger.background.error('Error in summarizeContent:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Summarize content via API
 * @param {Object} params - Parameters object
 * @returns {Promise<Object>} Result object
 */
async function summarizeContentViaApi(params) {
  const { 
    tabId, 
    url, 
    hasSelection = false, 
    promptId = null, 
    platformId = null
  } = params;
  
  try {
    logger.background.info('Starting API-based summarization', params);
    
    // 1. Reset previous state
    await chrome.storage.local.set({
      contentReady: false,
      extractedContent: null,
      apiProcessingStatus: 'extracting'
    });
    
    // 2. Extract content (uses existing extraction logic)
    const contentType = determineContentType(url, hasSelection);
    logger.background.info(`Content type determined: ${contentType}, hasSelection: ${hasSelection}`);
    
    const extractionResult = await extractContent(tabId, url, hasSelection);
    
    if (!extractionResult) {
      logger.background.warn('Content extraction completed with warnings');
    }
    
    // 3. Get the extracted content
    const { extractedContent } = await chrome.storage.local.get('extractedContent');
    
    if (!extractedContent) {
      throw new Error('Failed to extract content');
    }
    
    // YouTube transcript error check (similar to existing code)
    if (contentType === CONTENT_TYPES.YOUTUBE) {
      if (extractedContent?.error &&
          extractedContent?.transcript &&
          typeof extractedContent.transcript === 'string' &&
          (extractedContent.transcript.includes('No transcript') ||
          extractedContent.transcript.includes('Transcript is not available'))) {

        logger.background.warn('YouTube transcript error detected, aborting API summarization');

        return {
          success: false,
          youtubeTranscriptError: true,
          errorMessage: extractedContent.message || 'Failed to retrieve YouTube transcript.'
        };
      }
    }
    
    // 4. Get the prompt
    const effectivePromptId = promptId || await getPreferredPromptId(contentType);
    const promptContent = await getPromptContentById(effectivePromptId, contentType);
    
    if (!promptContent) {
      throw new Error(`Prompt not found for ID: ${effectivePromptId}`);
    }
    
    // 5. Determine platform to use
    const effectivePlatformId = platformId || await getPreferredAiPlatform();
    
    // 6. Update processing status
    await chrome.storage.local.set({
      apiProcessingStatus: 'processing',
      currentSummarizationMode: 'api',
      apiSummarizationPlatform: effectivePlatformId,
      apiSummarizationTimestamp: Date.now()
    });
    
    // 7. Process with API
    const apiResponse = await ApiServiceManager.processContent(
      effectivePlatformId, 
      extractedContent, 
      promptContent
    );
    
    // 8. Store the response
    await chrome.storage.local.set({
      apiProcessingStatus: apiResponse.success ? 'completed' : 'error',
      apiResponse: apiResponse,
      apiResponseTimestamp: Date.now()
    });
    
    // 9. Notify the popup if open
    try {
      chrome.runtime.sendMessage({
        action: apiResponse.success ? 'apiResponseReady' : 'apiProcessingError',
        response: apiResponse
      });
    } catch (error) {
      // Ignore if popup isn't open
    }
    
    return {
      success: apiResponse.success,
      response: apiResponse,
      contentType
    };
  } catch (error) {
    logger.background.error('API summarization error:', error);
    
    // Update state for error
    await chrome.storage.local.set({
      apiProcessingStatus: 'error',
      apiProcessingError: error.message
    });
    
    // Notify popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiProcessingError',
        error: error.message
      });
    } catch (msgError) {
      // Ignore if popup isn't open
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle context menu click - now uses the centralized summarizeContent function
 */
async function handleContextMenuClick(info, tab) {
  logger.background.info('Context menu clicked', { info, tabId: tab.id });

  // Determine if there's a text selection
  const hasSelection = info.menuItemId === 'summarizeSelection' || !!info.selectionText;
  
  logger.background.info(`Summarize content request from menu context`);

  // Use centralized summarization process
  const result = await summarizeContent({
    tabId: tab.id,
    url: tab.url,
    hasSelection
    // No promptId/platformId to use user's preferred defaults
  });
  
  // Handle any errors that need UI feedback
  if (!result.success) {
    logger.background.error('Context menu action failed:', result);
  }
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

// Command listener for keyboard shortcuts - now uses the centralized summarizeContent function
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "summarize-page") {
    try {
      logger.background.info('Keyboard shortcut triggered: summarize-page');
      
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        logger.background.warn('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      logger.background.info(`Active tab: ${activeTab.id}, URL: ${activeTab.url}`);
      
      // First, determine behavior based on user settings
      let useSelection = true; // Default to respecting selection
      
      try {
        const result = await chrome.storage.sync.get('shortcut_settings');
        if (result.shortcut_settings && result.shortcut_settings.summarization_behavior) {
          useSelection = result.shortcut_settings.summarization_behavior === 'selection';
          logger.background.info(`Using shortcut behavior from settings: ${useSelection ? 'Respect selection' : 'Always full page'}`);
        }
      } catch (error) {
        logger.background.error('Error getting shortcut settings:', error);
        // Continue with default behavior
      }
      
      // If we're set to respect selection, we need to check if there's a selection
      let hasSelection = false;
      
      if (useSelection) {
        // We need to inject a content script to check for selection
        try {
          // Create and inject a temporary script to check selection
          const injectionResult = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: () => window.getSelection().toString().trim().length > 0
          });
          
          if (injectionResult && injectionResult[0]) {
            hasSelection = injectionResult[0].result;
            logger.background.info(`Selection detection result: ${hasSelection}`);
          }
        } catch (error) {
          logger.background.error('Error detecting selection:', error);
          // Continue with no selection
        }
      }

      logger.background.info(`Summarize content request from keyboard`);
      
      // Use centralized summarization process
      const result = await summarizeContent({
        tabId: activeTab.id,
        url: activeTab.url,
        hasSelection
        // No promptId/platformId to use user's preferred defaults
      });
      
      // Handle any errors that need UI feedback
      if (!result.success) {
        logger.background.error('Keyboard shortcut action failed:', result);
      }
      
    } catch (error) {
      logger.background.error('Error handling keyboard shortcut:', error);
    }
  }
});

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
    } else if (aiPlatform === AI_PLATFORMS.GEMINI && tab.url.includes('gemini.google.com')) {
      isPlatformTab = true;
    } else if (aiPlatform === AI_PLATFORMS.GROK && tab.url.includes('grok.com')) {
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

// Update your existing 'summarizeContent' handler to support API mode
if (message.action === 'summarizeContent') {
  (async () => {
    try {
      const { tabId, contentType, promptId, platformId, url, hasSelection, commentAnalysisRequired, useApi } = message;
      logger.background.info(`Summarize content request from popup for tab ${tabId}, type: ${contentType}, promptId: ${promptId}, platform: ${platformId}, hasSelection: ${hasSelection}, useApi: ${useApi}`);

      // Call centralized summarization function with API mode parameter
      const result = await summarizeContent({
        tabId,
        url,
        hasSelection,
        promptId,
        platformId,
        commentAnalysisRequired,
        useApi // Pass through API mode flag
      });

      sendResponse(result);
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

// Handler for checking API mode availability
if (message.action === 'checkApiModeAvailable') {
  (async () => {
    try {
      const platformId = message.platformId || await getPreferredAiPlatform();
      const isAvailable = await ApiServiceManager.isApiModeAvailable(platformId);
      
      sendResponse({
        success: true,
        isAvailable,
        platformId
      });
    } catch (error) {
      logger.background.error('Error checking API mode availability:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();
  return true; // Keep channel open for async response
}

// Handler for getting API models
if (message.action === 'getApiModels') {
  (async () => {
    try {
      const platformId = message.platformId || await getPreferredAiPlatform();
      const models = await ApiServiceManager.getAvailableModels(platformId);
      
      sendResponse({
        success: true,
        models,
        platformId
      });
    } catch (error) {
      logger.background.error('Error getting API models:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();
  return true; // Keep channel open for async response
}

// Handler for credential operations
if (message.action === 'credentialOperation') {
  (async () => {
    try {
      const { operation, platformId, credentials } = message;
      
      switch (operation) {
        case 'get':
          const storedCredentials = await CredentialManager.getCredentials(platformId);
          sendResponse({
            success: true,
            credentials: storedCredentials
          });
          break;
          
        case 'store':
          const storeResult = await CredentialManager.storeCredentials(platformId, credentials);
          sendResponse({
            success: storeResult
          });
          break;
          
        case 'remove':
          const removeResult = await CredentialManager.removeCredentials(platformId);
          sendResponse({
            success: removeResult
          });
          break;
          
        case 'validate':
          const validationResult = await CredentialManager.validateCredentials(platformId, credentials);
          sendResponse({
            success: true,
            validationResult
          });
          break;
          
        default:
          throw new Error(`Unknown credential operation: ${operation}`);
      }
    } catch (error) {
      logger.background.error('Error in credential operation:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();
  return true; // Keep channel open for async response
}

// Handler for API-based summarization
if (message.action === 'summarizeContentViaApi') {
  (async () => {
    try {
      const result = await summarizeContentViaApi(message);
      sendResponse(result);
    } catch (error) {
      logger.background.error('Error in API summarization:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();
  return true; // Keep channel open for async response
}

// Handler for getting API response
if (message.action === 'getApiResponse') {
  (async () => {
    try {
      const result = await chrome.storage.local.get(['apiResponse', 'apiProcessingStatus', 'apiResponseTimestamp']);
      sendResponse({
        success: true,
        response: result.apiResponse || null,
        status: result.apiProcessingStatus || 'unknown',
        timestamp: result.apiResponseTimestamp || null
      });
    } catch (error) {
      logger.background.error('Error getting API response:', error);
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


