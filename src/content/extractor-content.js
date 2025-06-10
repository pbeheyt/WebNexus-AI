// src/content/extractor-content.js
import ExtractorFactory from '../extractor/extractor-factory.js';
import { logger } from '../shared/logger.js';
import {
  STORAGE_KEYS,
  DEFAULT_EXTRACTION_STRATEGY,
  CONTENT_TYPES,
} from '../shared/constants.js';

// Guard to ensure one-time initialization
if (window.webNexusAIContentScriptInitialized) {
  logger.content.info(
    'Content script already initialized. Skipping listener setup.'
  );
} else {
  window.webNexusAIContentScriptInitialized = true;
  logger.content.info(
    'Initializing central content script message listener.'
  );

  // Centralized message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // --- Message Router Logic ---

    // 1. Handle 'extractContent' action specifically
    if (message.action === 'extractContent') {
      (async () => {
        try {
          let preferredStrategy = DEFAULT_EXTRACTION_STRATEGY;
          // Only fetch strategy if it's general content type
          if (message.contentType === CONTENT_TYPES.GENERAL) {
            const result = await chrome.storage.sync.get(
              STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY
            );
            preferredStrategy =
              result[STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY] ||
              DEFAULT_EXTRACTION_STRATEGY;
            logger.content.info(
              `Using general extraction strategy from storage: ${preferredStrategy}`
            );
          }

          // Always re-initialize the extractor with the content type from the message.
          // This is the core of the fix: it ensures the correct extractor is made active.
          ExtractorFactory.initialize(message.contentType, preferredStrategy);
          logger.content.info(
            `Extractor initialized with content type: ${message.contentType}`
          );
          
          if (ExtractorFactory.activeExtractor) {
            await ExtractorFactory.activeExtractor.extractAndSaveContent();
            sendResponse({
              status: `Extracting content...`,
              contentType: ExtractorFactory.activeExtractor.contentType,
            });
          } else {
            throw new Error('Failed to initialize an active extractor.');
          }
        } catch (e) {
          logger.content.error(
            'Error during extractContent action handling:',
            e
          );
          sendResponse({
            status: 'error',
            message: 'Failed to process extraction request: ' + e.message,
          });
        }
      })();
      return true; // Keep channel open for async response
    }

    // 2. Handle 'resetExtractor' action
    if (message.action === 'resetExtractor') {
      ExtractorFactory.cleanup();
      // On reset, we don't know the content type, so we don't initialize a new one.
      // The next 'extractContent' call will initialize the correct one.
      logger.content.info('Extractor factory cleaned up by reset command.');
      sendResponse({ status: 'reset' });
      return false; // Synchronous response
    }

    // 3. Delegate any other messages to the currently active extractor
    if (ExtractorFactory.activeExtractor) {
      try {
        // The return value of handleMessage determines if the response is async
        return ExtractorFactory.activeExtractor.handleMessage(
          message,
          sender,
          sendResponse
        );
      } catch (error) {
        logger.content.error('Error in delegated message handler:', error);
      }
    }

    // 4. Default case: message was not handled
    return false;
  });
}

// Export for webpack
export default {};
