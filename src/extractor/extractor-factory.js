// src/extractor/extractor-factory.js
import {
  CONTENT_TYPES,
  DEFAULT_EXTRACTION_STRATEGY,
} from '../shared/constants.js';
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
  static createExtractor(url, preferredStrategy = null) {
    const contentType = determineContentType(url);
    const StrategyClass =
      this.STRATEGY_MAP[contentType] || GeneralExtractorStrategy;

    if (
      contentType === CONTENT_TYPES.GENERAL &&
      StrategyClass === GeneralExtractorStrategy
    ) {
      // Pass the preferredStrategy in the config object for GeneralExtractorStrategy
      return new StrategyClass({
        extractionMode: preferredStrategy || DEFAULT_EXTRACTION_STRATEGY,
      });
    }
    return new StrategyClass();
  }

  /**
   * Initialize the appropriate extractor based on the current page
   */
  static initialize(preferredStrategy = null) {
    // Clean up any existing extractor
    if (this.activeExtractor) {
      this.activeExtractor.cleanup();
    }

    const url = window.location.href;
    // Pass the preferredStrategy to createExtractor
    this.activeExtractor = ExtractorFactory.createExtractor(
      url,
      preferredStrategy
    );
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
