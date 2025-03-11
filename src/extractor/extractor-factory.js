// src/extractor/extractor-factory.js
const GeneralExtractorStrategy = require('./strategies/general-strategy');
const RedditExtractorStrategy = require('./strategies/reddit-strategy');
const YoutubeExtractorStrategy = require('./strategies/youtube-strategy');

/**
 * Factory to create the appropriate content extractor
 */
class ExtractorFactory {
  /**
   * Create an extractor based on the current URL
   * @param {string} url - The URL of the current page
   * @returns {BaseExtractor} An instance of the appropriate extractor
   */
  static createExtractor(url) {
    if (url.includes('youtube.com/watch')) {
      return new YoutubeExtractorStrategy();
    } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
      return new RedditExtractorStrategy();
    } else {
      return new GeneralExtractorStrategy();
    }
  }
  
  /**
   * Initialize the appropriate extractor based on the current page
   * This is the main entry point for content scripts
   */
  static initialize() {
    const url = window.location.href;
    const extractor = ExtractorFactory.createExtractor(url);
    extractor.initialize();
    return extractor;
  }
}

module.exports = ExtractorFactory;