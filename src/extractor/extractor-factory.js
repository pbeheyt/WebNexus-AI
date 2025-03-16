// src/extractor/extractor-factory.js
const { CONTENT_TYPES } = require('../shared/constants');
const { determineContentType } = require('../shared/content-utils');

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
   * Strategy mapping for content types
   * Maps each content type to its corresponding extractor strategy
   */
  static STRATEGY_MAP = {
    [CONTENT_TYPES.GENERAL]: GeneralExtractorStrategy,
    [CONTENT_TYPES.REDDIT]: RedditExtractorStrategy,
    [CONTENT_TYPES.YOUTUBE]: YoutubeExtractorStrategy,
    [CONTENT_TYPES.PDF]: PdfExtractorStrategy,
    [CONTENT_TYPES.SELECTED_TEXT]: SelectedTextExtractorStrategy
  };

  /**
   * Create an extractor based on the current URL and selection state
   * @param {string} url - The URL of the current page
   * @param {boolean} hasSelection - Whether there's text selected
   * @returns {BaseExtractor} An instance of the appropriate extractor
   */
  static createExtractor(url, hasSelection = false) {
    // Use the shared utility function to determine content type
    const contentType = determineContentType(url, hasSelection);
    
    // Get the appropriate strategy class from the mapping
    const StrategyClass = this.STRATEGY_MAP[contentType] || GeneralExtractorStrategy;
    
    // Create and return an instance of the strategy
    return new StrategyClass();
  }
  
  /**
   * Initialize the appropriate extractor based on the current page
   * @param {boolean} hasSelection - Whether there's text selected
   * @returns {BaseExtractor} The initialized extractor
   */
  static initialize(hasSelection = false) {
    const url = window.location.href;
    const extractor = ExtractorFactory.createExtractor(url, hasSelection);
    extractor.initialize();
    return extractor;
  }
}

module.exports = ExtractorFactory;