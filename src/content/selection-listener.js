// src/content/selection-listener.js

import { debounce } from '../shared/utils/debounce-utils';
import { robustSendMessage } from '../shared/utils/message-utils';
import { logger } from '../shared/logger.js';

// Guard to ensure one-time initialization
if (window.webNexusAISelectionListenerInitialized) {
  logger.content.info(
    'Selection listener script already initialized. Skipping setup.'
  );
} else {
  window.webNexusAISelectionListenerInitialized = true;
  logger.content.info('Initializing selection listener script.');

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
}

// Export for webpack
export default {};
