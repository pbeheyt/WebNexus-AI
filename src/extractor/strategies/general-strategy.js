// src/extractor/strategies/general-strategy.js
import { Readability } from '@mozilla/readability';

import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
    // This strategy relies on Mozilla's Readability.js for main content extraction.
  }

  /**
   * Cleans and standardizes text content by normalizing whitespace.
   * Replaces various newline and space characters with single spaces and trims the result.
   * @param {string} text - The raw text content.
   * @returns {string} - The cleaned, condensed text content, or an empty string if input is falsy.
   */
  _moderateCleanText(text) {
    if (!text) return '';
    let cleaned = text;

    cleaned = cleaned.replace(/\r\n/g, '\n'); // Normalize Windows-style newlines
    cleaned = cleaned.replace(/[\t\v\f]+/g, ' '); // Replace tabs, vertical tabs, form feeds with a space
    cleaned = cleaned.replace(/\n+/g, ' '); // Replace all newlines (Unix, Mac) with a space
    cleaned = cleaned.replace(/ {2,}/g, ' '); // Collapse multiple spaces into a single space
    cleaned = cleaned.trim(); // Trim leading/trailing whitespace

    return cleaned;
  }

  /**
   * Orchestrates the extraction of page content and saves it to storage.
   * Primarily uses the extractData method.
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('General content extraction process started.');
      const pageData = await this.extractData();
      await this.saveToStorage(pageData);
      this.logger.info('General content extraction process completed and data saved.');
    } catch (error) {
      this.logger.error('Error during general content extraction and saving:', error);
      // Attempt to save error information to storage for diagnostics
      await this.saveToStorage({
        error: true,
        message: `Extraction failed: ${error.message || 'Unknown error'}`,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      });
    }
  }

  /**
   * Extracts page data. Prioritizes user's selected text if available.
   * Otherwise, uses Mozilla's Readability.js to find and parse the main article content.
   * Basic metadata (title, URL, meta description, author from meta tags) is also extracted.
   * @returns {Promise<Object>} An object containing the extracted page data.
   */
  async extractData() {
    // Initialize with basic metadata, which might be overridden by Readability
    let title = this.extractPageTitle();
    const url = this.extractPageUrl(); // URL doesn't need newline normalization
    let description = this.extractMetaDescription();
    let author = this.extractAuthor();
    let content = '';
    let isSelection = false;

    try {
      const selectedText = window.getSelection().toString(); // Don't trim here, let normalizeText handle it
      isSelection = !!selectedText.trim(); // Check for actual content before trimming for isSelection flag

      if (isSelection) {
        content = normalizeText(this._moderateCleanText(selectedText)); // Apply moderate clean then normalize
        this.logger.info('Used user-selected text as content.');
      } else {
        isSelection = false;
        this.logger.info('No user selection. Attempting Readability.js extraction.');

        const readabilityOptions = {
          charThreshold: 150,
          nbTopCandidates: 7,
        };

        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone, readabilityOptions);
        const article = reader.parse();

        if (article && article.textContent && article.textContent.trim() !== '') {
          content = normalizeText(this._moderateCleanText(article.textContent));
          this.logger.info(`Readability.js extracted main content (${content.length} chars).`);

          if (article.title && article.title.trim() !== '') {
            title = article.title; // Will be normalized before final assignment
          }
          if (article.byline && article.byline.trim() !== '') {
            author = article.byline; // Readability's byline is preferred, will be normalized
          }
          if ((!description || description.trim() === '') && article.excerpt && article.excerpt.trim() !== '') {
            description = this._moderateCleanText(article.excerpt); // Apply moderate clean then normalize
          }
        } else {
          content = 'Could not identify sufficient main content.'; // This is a status, not content to normalize
          this.logger.warn('Content parsing returned no significant content.');
        }
      }

      return {
        pageTitle: normalizeText(title),
        pageUrl: url,
        pageDescription: normalizeText(description),
        pageAuthor: normalizeText(author),
        content: content, // Already normalized if it's actual content
        isSelection: isSelection,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    } catch (error) {
      this.logger.error('Critical error during page data extraction:', error);
      return {
        pageTitle: normalizeText(title),
        pageUrl: url,
        pageDescription: normalizeText(description),
        pageAuthor: normalizeText(author),
        content: `Extraction error: ${error.message}`, // Error message, not typical content
        error: true,
        message: error.message || 'Unknown error in extractData',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    }
  }

  /**
   * Extracts the page title from the document.
   * @returns {string} The page title or a default string.
   */
  extractPageTitle() {
    // Raw extraction, normalization happens in extractData
    return document.title ? document.title : 'Unknown Title';
  }

  /**
   * Retrieves the current page URL.
   * @returns {string} The current page URL.
   */
  extractPageUrl() {
    return window.location.href;
  }

  /**
   * Extracts the meta description content from the page.
   * @returns {string|null} The raw meta description, or null if not found.
   */
  extractMetaDescription() {
    const metaElement = document.querySelector('meta[name="description"]');
    if (metaElement && metaElement.getAttribute('content')) {
      // Raw extraction, _moderateCleanText and normalizeText happens in extractData
      return metaElement.getAttribute('content');
    }
    return null;
  }

  /**
   * Attempts to extract the author SOLELY from standard meta tags.
   * This serves as an initial value if Readability.js does not provide an author (`byline`).
   * @returns {string|null} The extracted raw author name from meta tags, or null if not found.
   */
  extractAuthor() {
    // Prioritize standard meta tags for author information.
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]',
    ];
    for (const selector of metaSelectors) {
      const metaElement = document.querySelector(selector);
      if (metaElement && metaElement.getAttribute('content')) {
        const authorText = metaElement.getAttribute('content');
        if (authorText.trim()) {
          // Raw extraction, normalization happens in extractData
          return authorText;
        }
      }
    }
    return null; // No author found via meta tags
  }
}

export default GeneralExtractorStrategy;
