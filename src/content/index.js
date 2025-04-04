// src/content/index.js - Modify existing or create new
const ExtractorFactory = require('../extractor/extractor-factory');
const logger = require('../shared/logger.js').content;

// Track active extraction process
let currentExtractionId = null;

// Initialize content script state

// Centralized message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Handle reset extractor command
  if (message.action === 'resetExtractor') {
    currentExtractionId = Date.now().toString();
    
    // Force cleanup of all extractors
    ExtractorFactory.cleanup();
    
    // Initialize fresh extractor
    ExtractorFactory.initialize();
    ExtractorFactory.activeExtractor.extractionId = currentExtractionId;
    
    sendResponse({ status: 'reset', extractionId: currentExtractionId });
    return true;
  }
  
  // Basic ping check
  if (message.action === 'ping') {
    const isReady = !!ExtractorFactory.activeExtractor && 
                    ExtractorFactory.activeExtractor.contentScriptReady;
    sendResponse({ status: 'pong', ready: isReady });
    return true;
  }
  
  // Extract content command
  if (message.action === 'extractContent') {
    if (!ExtractorFactory.activeExtractor) {
      // Initialize extractor if not present
      ExtractorFactory.initialize();
    }
    
    if (ExtractorFactory.activeExtractor) {
      ExtractorFactory.activeExtractor.extractAndSaveContent();
      sendResponse({ 
        status: `Extracting content...`, 
        contentType: ExtractorFactory.activeExtractor.contentType 
      });
    } else {
      sendResponse({ status: 'error', message: 'Failed to initialize extractor' });
    }
    return true;
  }
  
  // Let active extractor handle other messages
  if (ExtractorFactory.activeExtractor) {
    try {
      // Custom handler for specialized extractor-specific messages
      const handled = ExtractorFactory.activeExtractor.handleMessage?.(message, sender, sendResponse);
      if (handled) return true;
    } catch (error) {
      logger.error('Error in extractor message handler:', error);
    }
  }
  
  return false; // Indicate message was not handled here
});

// Export for webpack
export default {};
