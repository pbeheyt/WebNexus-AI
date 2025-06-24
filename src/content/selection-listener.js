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
  logger.content.info('Initializing state-aware selection listener script.');

  // State to track the last known selection status to prevent redundant messages.
  let lastHasSelection = false;

  const handleSelectionChange = async () => {
    try {
      const selection = window.getSelection();
      const currentHasSelection = selection
        ? selection.toString().trim().length > 0
        : false;

      // Only send a message if the selection state has actually changed.
      if (currentHasSelection !== lastHasSelection) {
        await robustSendMessage({
          action: 'updateSelectionStatus',
          hasSelection: currentHasSelection,
        });
        // Update the state *after* successfully sending the message.
        lastHasSelection = currentHasSelection;
      }
    } catch (error) {
      // Don't update lastHasSelection on error, so it can be retried.
      logger.content.error('Error sending selection status update:', error);
    }
  };

  // Debounce the handler to avoid flooding the background script with messages during rapid selections.
  const debouncedSelectionChangeHandler = debounce(handleSelectionChange, 150);

  // Listen for selection changes on the document.
  document.addEventListener('selectionchange', debouncedSelectionChangeHandler);

  // Initial check on load, in case a selection already exists when the script is injected.
  handleSelectionChange();
}

// Export for webpack
export default {};
