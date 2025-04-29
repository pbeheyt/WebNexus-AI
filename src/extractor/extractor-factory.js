// src/extractor/extractor-factory.js
import { CONTENT_TYPES } from '../shared/constants.js';
import { determineContentType } from '../shared/utils/content-utils.js';

import GeneralExtractorStrategy from './strategies/general-strategy.js';
import RedditExtractorStrategy from './strategies/reddit-strategy.js';
import YoutubeExtractorStrategy from './strategies/youtube-strategy.js';
import PdfExtractorStrategy from './strategies/pdf-strategy.js';

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
  };

  /**
   * Create an extractor based on the current URL
   */
  static createExtractor(url) {
    const contentType = determineContentType(url);
    const StrategyClass =
      this.STRATEGY_MAP[contentType] || GeneralExtractorStrategy;
    return new StrategyClass();
  }

  /**
   * Initialize the appropriate extractor based on the current page
   */
  static initialize() {
    // Clean up any existing extractor
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
    }

    const url = window.location.href;
    this.activeExtractor = ExtractorFactory.createExtractor(url);
    this.activeExtractor.initialize();
    return this.activeExtractor;
  }

  /**
   * Reinitialize extractor based on selection state change
   * @returns {BaseExtractor} The reinitialized extractor
   */
  static reinitialize() {
    // Clean up existing extractor
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
      this.activeExtractor = null;
    }

    // Create new extractor with current URL
    const url = window.location.href;
    const contentType = determineContentType(url);

    this.logger.info(`Creating new extractor for content type: ${contentType}`);

    // Create and initialize the new extractor
    this.activeExtractor = this.createExtractor(url);
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

export default ExtractorFactory;
