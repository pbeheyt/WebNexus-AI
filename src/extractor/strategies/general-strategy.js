// src/extractor/strategies/general-strategy.js
import { Readability } from '@mozilla/readability';
import BaseExtractor from '../base-extractor.js';

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
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
    const url = this.extractPageUrl();
    let description = this.extractMetaDescription();
    let author = this.extractAuthor(); // Fallback author extraction
    let content = '';
    let isSelection = false;

    try {
      const selectedText = window.getSelection().toString().trim();
      isSelection = !!selectedText;

      if (selectedText) {
        content = this._moderateCleanText(selectedText);
        this.logger.info('Used user-selected text as content.');
      } else {
        isSelection = false;
        this.logger.info('No user selection. Attempting Readability.js extraction.');

        // Configuration options for Readability.js
        // These values are chosen to balance capturing enough content without being overly aggressive.
        const readabilityOptions = {
          // Lowered from Readability's default of 500 to better capture moderately sized articles.
          charThreshold: 150,
          // Slightly increased from Readability's default of 5 to consider more candidate sections.
          nbTopCandidates: 7,
          // For development/troubleshooting, uncomment to enable Readability's internal logging:
          // debug: true,
        };

        // Readability mutates the DOM, so a clone of the document is used.
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone, readabilityOptions);
        const article = reader.parse();

        if (article && article.textContent && article.textContent.trim() !== '') {
          content = this._moderateCleanText(article.textContent);
          this.logger.info(`Readability.js extracted main content (${content.length} chars).`);

          // Override initial metadata if Readability provides non-empty, potentially better values.
          if (article.title && article.title.trim() !== '') {
            title = article.title.trim();
          }
          if (article.byline && article.byline.trim() !== '') {
            author = article.byline.trim();
          }
          if ((!description || description.trim() === '') && article.excerpt && article.excerpt.trim() !== '') {
            description = this._moderateCleanText(article.excerpt.trim());
          }
        } else {
          content = 'Readability.js did not identify sufficient main content.';
          this.logger.warn('Readability.js parsing returned no significant content.');
        }
      }

      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
        content: content,
        isSelection: isSelection,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    } catch (error) {
      this.logger.error('Critical error during page data extraction:', error);
      // Return collected data along with error information
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
        content: `Extraction error: ${error.message}`,
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
    return document.title ? document.title.trim() : 'Unknown Title';
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
   * @returns {string|null} The cleaned meta description, or null if not found.
   */
  extractMetaDescription() {
    const metaElement = document.querySelector('meta[name="description"]');
    if (metaElement && metaElement.getAttribute('content')) {
      return this._moderateCleanText(metaElement.getAttribute('content'));
    }
    return null;
  }

  /**
   * Attempts to extract the author from meta tags or common author-related elements.
   * This serves as a fallback if Readability.js does not provide an author (`byline`).
   * @returns {string|null} The extracted author name, or null if not found.
   */
  extractAuthor() {
    // Prioritize standard meta tags for author information
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]',
    ];
    for (const selector of metaSelectors) {
      const metaElement = document.querySelector(selector);
      if (metaElement && metaElement.getAttribute('content')) {
        const authorText = metaElement.getAttribute('content').trim();
        if (authorText) {
          return authorText;
        }
      }
    }

    // Fallback to common class names or attributes if meta tags fail
    const commonAuthorSelectors = [
      '.author',
      '.byline', // Often used for author credit
      '.post-author',
      '.entry-author',
      '[rel="author"]', // Semantic attribute for author links
      'a[href*="/author/"]', // Links pointing to an author page
      '.author-name',
      '[data-testid="author-name"]', // Common in JS frameworks
      '[itemprop="author"]', // Schema.org microdata
    ];

    for (const selector of commonAuthorSelectors) {
      const authorElements = document.querySelectorAll(selector);
      for (const authorElement of authorElements) {
        // Prefer a more specific name element within the found author container
        const nameNode =
          authorElement.querySelector(
            '.author-name, [data-testid="author-name"], [itemprop="name"]'
          ) || authorElement; // Default to the container itself

        if (nameNode && nameNode.textContent) {
          let name = nameNode.textContent.trim();
          if (name) {
            name = name.replace(/^by\s+/i, '').trim(); // Remove "By " prefix
            if (name) {
              return name;
            }
          }
        }
        // If specific nameNode failed, but the main authorElement has text (and is different)
        if (nameNode !== authorElement && authorElement.textContent) {
            let mainElementText = authorElement.textContent.trim();
            if (mainElementText) {
                mainElementText = mainElementText.replace(/^by\s+/i, '').trim();
                if (mainElementText) {
                    return mainElementText;
                }
            }
        }
      }
    }
    return null;
  }
}

export default GeneralExtractorStrategy;