// src/content/index.js - Modify existing or create new
import ExtractorFactory from '../extractor/extractor-factory.js';
import { debounce } from '../shared/utils/debounce-utils';
import { robustSendMessage } from '../shared/utils/message-utils';
import { logger } from '../shared/logger.js';
import {
  STORAGE_KEYS,
  DEFAULT_EXTRACTION_STRATEGY,
  CONTENT_TYPES,
} from '../shared/constants.js';

// Track active extraction process
let currentExtractionId = null;

// Initialize content script state

// Guard to ensure one-time initialization
if (window.webNexusAIContentScriptInitialized) {
  logger.content.info(
    'Content script already initialized. Skipping listener setup.'
  );
} else {
  window.webNexusAIContentScriptInitialized = true;
  logger.content.info(
    'Initializing content script message listener and one-time setup.'
  );

  // Centralized message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle reset extractor command
    if (message.action === 'resetExtractor') {
      currentExtractionId = Date.now().toString();

      // Force cleanup of all extractors
      ExtractorFactory.cleanup();

      // Initialize fresh extractor - strategy will be fetched again if needed by 'extractContent'
      // or passed if we decide to send it with reset command in future. For now, simple init.
      // Let's assume strategy is only relevant at the point of 'extractContent' for general type.
      // So, for reset, a simple initialize is fine. The strategy will be read/passed upon the next 'extractContent' call.
      ExtractorFactory.initialize(); // Keep simple initialize for reset.
      ExtractorFactory.activeExtractor.extractionId = currentExtractionId;

      sendResponse({ status: 'reset', extractionId: currentExtractionId });
      return true;
    }

    // Extract content command
    if (message.action === 'extractContent') {
      (async () => {
        try {
          let preferredStrategy = DEFAULT_EXTRACTION_STRATEGY;
          // Only fetch strategy if it's general content type
          if (message.contentType === CONTENT_TYPES.GENERAL) {
            const result = await chrome.storage.sync.get(
              STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY
            );
            // The value from storage should exist post-install.
            // If it's somehow undefined (e.g. storage error, manual clear),
            // preferredStrategy will be undefined here, and the factory will use its default.
            preferredStrategy =
              result[STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY];
            logger.content.info(
              `Using general extraction strategy from storage: ${preferredStrategy} (Factory will apply global default if this is undefined)`
            );
          }

          if (!ExtractorFactory.activeExtractor) {
            // Initialize extractor if not present, passing the strategy
            // The factory will decide if the strategy is relevant for the current content type
            ExtractorFactory.initialize(preferredStrategy);
          } else if (message.contentType === CONTENT_TYPES.GENERAL) {
            // If extractor exists and it's general, re-initialize with potentially new strategy
            // This handles cases where the extractor might persist across messages for the same tab
            // if the user changes the strategy in the UI without a page reload.
            // For non-general types, the strategy isn't used by initialize, so no need to re-init.
            ExtractorFactory.initialize(preferredStrategy);
          }

          if (ExtractorFactory.activeExtractor) {
            await ExtractorFactory.activeExtractor.extractAndSaveContent();
            sendResponse({
              status: `Extracting content...`,
              contentType: ExtractorFactory.activeExtractor.contentType,
            });
          } else {
            sendResponse({
              status: 'error',
              message: 'Failed to initialize extractor',
            });
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

    // Let active extractor handle other messages
    if (ExtractorFactory.activeExtractor) {
      try {
        // Custom handler for specialized extractor-specific messages
        const handled = ExtractorFactory.activeExtractor.handleMessage?.(
          message,
          sender,
          sendResponse
        );
        if (handled) return true;
      } catch (error) {
        logger.content.error('Error in extractor message handler:', error);
      }
    }

    return false; // Indicate message was not handled here
  }); // This is the closing of addListener
}

// Export for webpack
// --- Text Selection Detection ---
const handleSelectionChange = async () => {
  try {
    const selection = window.getSelection();
    const hasSelection = selection ? selection.toString().trim().length > 0 : false;
    await robustSendMessage({
      action: 'updateSelectionStatus',
      hasSelection: hasSelection,
    });
  } catch (error) {
    logger.content.error('Error sending selection status update:', error);
  }
};

// Debounce the handler to avoid flooding the background script with messages
const debouncedSelectionChangeHandler = debounce(handleSelectionChange, 250);

// Listen for selection changes on the document
document.addEventListener('selectionchange', debouncedSelectionChangeHandler);

export default {};
