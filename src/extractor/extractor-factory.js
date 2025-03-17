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
   * Keep track of active extractor instance per tab
   * @type {BaseExtractor}
   */
  static activeExtractor = null;

  /**
   * Strategy mapping for content types
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
   */
  static createExtractor(url, hasSelection = false) {
    const contentType = determineContentType(url, hasSelection);
    const StrategyClass = this.STRATEGY_MAP[contentType] || GeneralExtractorStrategy;
    return new StrategyClass();
  }
  
  /**
   * Initialize the appropriate extractor based on the current page
   */
  static initialize(hasSelection = false) {
    // Clean up any existing extractor
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
    }
    
    const url = window.location.href;
    this.activeExtractor = ExtractorFactory.createExtractor(url, hasSelection);
    this.activeExtractor.initialize();
    return this.activeExtractor;
  }

    /**
   * Reinitialize extractor based on selection state change
   * @param {boolean} hasSelection - Whether there's text selected
   * @returns {BaseExtractor} The reinitialized extractor
   */
  static reinitialize(hasSelection = false) {
    this.logger.info(`Reinitializing extractor with selection state: ${hasSelection}`);
    
    // Clean up existing extractor
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
      this.activeExtractor = null;
    }
    
    // Create new extractor with current URL and selection state
    const url = window.location.href;
    const contentType = determineContentType(url, hasSelection);
    
    this.logger.info(`Creating new extractor for content type: ${contentType}`);
    
    // Create and initialize the new extractor
    this.activeExtractor = this.createExtractor(url, hasSelection);
    this.activeExtractor.initialize();
    
    return this.activeExtractor;
  }

  static cleanup() {
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
      this.activeExtractor = null;
    }
  }
}

module.exports = ExtractorFactory;