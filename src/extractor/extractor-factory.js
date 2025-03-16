// src/extractor/extractor-factory.js
const GeneralExtractorStrategy = require('./strategies/general-strategy');
const RedditExtractorStrategy = require('./strategies/reddit-strategy');
const YoutubeExtractorStrategy = require('./strategies/youtube-strategy');
const PdfExtractorStrategy = require('./strategies/pdf-strategy');
const SelectedTextExtractorStrategy = require('./strategies/selected-text-strategy');

/**
 * Factory to create the appropriate content extractor
 */
class ExtractorFactory {
  /**
   * Create an extractor based on the current URL and selection state
   * @param {string} url - The URL of the current page
   * @param {boolean} hasSelection - Whether there's text selected
   * @returns {BaseExtractor} An instance of the appropriate extractor
   */
  static createExtractor(url, hasSelection = false) {
    // If there's selection, use the selected text extractor
    if (hasSelection) {
      return new SelectedTextExtractorStrategy();
    }
    
    // PDF detection logic
    if (url.endsWith('.pdf') || 
        url.includes('/pdf/') || 
        url.includes('pdfviewer') || 
        url.includes('chrome-extension://') && url.includes('pdfviewer')) {
      return new PdfExtractorStrategy();
    } else if (url.includes('youtube.com/watch')) {
      return new YoutubeExtractorStrategy();
    } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
      return new RedditExtractorStrategy();
    } else {
      return new GeneralExtractorStrategy();
    }
  }
  
  /**
   * Initialize the appropriate extractor based on the current page
   * @param {boolean} hasSelection - Whether there's text selected
   */
  static initialize(hasSelection = false) {
    const url = window.location.href;
    const extractor = ExtractorFactory.createExtractor(url, hasSelection);
    extractor.initialize();
    return extractor;
  }
}

module.exports = ExtractorFactory;