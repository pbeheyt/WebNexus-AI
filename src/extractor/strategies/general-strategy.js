// src/extractor/strategies/general-strategy.js
const BaseExtractor = require('../base-extractor');
const cheerio = require('cheerio'); // Make sure cheerio is required

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
  }

  /**
   * Cleans extracted text content with moderate whitespace normalization.
   * Tries to preserve paragraph breaks while collapsing other whitespace.
   * @param {string} text - The raw text content.
   * @returns {string} - The cleaned text content.
   */
  _moderateCleanText(text) {
    if (!text) return '';

    let cleaned = text;

    // 1. Replace various whitespace chars (tabs, vertical tabs, form feeds) with spaces
    cleaned = cleaned.replace(/[\t\v\f]+/g, ' ');

    // 2. Collapse multiple spaces into a single space
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    // 3. Collapse more than two consecutive newlines into exactly two
    cleaned = cleaned.replace(/(\r?\n){3,}/g, '\n\n');

    // 4. Remove spaces directly before newlines
    cleaned = cleaned.replace(/ +\n/g, '\n');

    // 5. Trim leading/trailing whitespace (including newlines)
    cleaned = cleaned.trim();

    return cleaned;
  }


  /**
   * Extract and save page data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting general content extraction (Cheerio - Take 2)...');
      const pageData = await this.extractData();
      await this.saveToStorage(pageData);
    } catch (error) {
      this.logger.error('Error in general content extraction:', error);
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Extract page data using Cheerio with minimal filtering and moderate cleaning.
   * @returns {Promise<Object>} The extracted page data
   */
  async extractData() {
    let title = 'Unknown Title';
    let url = 'Unknown URL';
    let description = null;
    let author = null;
    let content = '';
    let isSelection = false;

    try {
      // Get user selection if any
      const selectedText = window.getSelection().toString().trim();
      isSelection = !!selectedText;

      // Extract basic page metadata (always attempt this)
      title = this.extractPageTitle();
      url = this.extractPageUrl();
      description = this.extractMetaDescription();
      author = this.extractAuthor();

      // Extract content
      if (selectedText) {
        // Use selection directly, apply moderate cleaning
        content = this._moderateCleanText(selectedText);
        this.logger.info('Using selected text as content (moderately cleaned).');
      } else {
        this.logger.info('No selection, extracting content using Cheerio (minimal filtering).');
        content = ''; // Initialize content variable
        try {
            const pageHtml = document.body.innerHTML;
            const $ = cheerio.load(pageHtml);

            // *** Minimal Noise Removal: Only remove truly non-content tags ***
            const essentialNoise = 'script, style, noscript, head, link, meta, svg, canvas, video, audio, iframe';
            $(essentialNoise).remove();
            this.logger.info('Removed essential noise elements using Cheerio.');

            // *** Extract text from the entire body ***
            const extractedText = $('body').text();

            // *** Apply moderate cleaning ***
            content = this._moderateCleanText(extractedText);
            this.logger.info(`Cheerio extracted and moderately cleaned ${content.length} characters.`);

        } catch (cheerioError) {
            this.logger.error('Error during Cheerio processing:', cheerioError);
            content = 'Error extracting content using Cheerio: ' + cheerioError.message;
            // Fallback to basic text extraction on error
            try {
                 let bodyText = document.body.textContent || '';
                 content += this._moderateCleanText(bodyText); // Apply cleaning to fallback
                 if (!content.trim().replace('Error extracting content using Cheerio: ' + cheerioError.message, '')) {
                     content = 'Content extraction failed completely after Cheerio error.';
                 } else {
                     this.logger.info(`Fallback extracted and cleaned ${content.length} characters after Cheerio error.`);
                 }
            } catch (fallbackError) {
                 this.logger.error('Fallback text extraction failed after Cheerio error:', fallbackError);
                 content = 'Content extraction failed completely.';
            }
        }
      }

      // Return the complete page data object
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
        content: content, // Use the moderately cleaned content
        isSelection: isSelection,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error extracting page data:', error);
      // Return minimal data with error message
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
        content: `Error extracting content: ${error.message}`,
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      };
    }
  }

  // --- Metadata Extraction Methods (Unchanged) ---

  extractPageTitle() {
    return document.title || 'Unknown Title';
  }

  extractPageUrl() {
    return window.location.href;
  }

  extractMetaDescription() {
    const metaDescription = document.querySelector('meta[name="description"]');
    return metaDescription ? metaDescription.getAttribute('content') : null;
  }

  extractAuthor() {
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]'
    ];
    for (const selector of metaSelectors) {
      const metaElement = document.querySelector(selector);
      if (metaElement && metaElement.getAttribute('content')) {
        return metaElement.getAttribute('content');
      }
    }

    const authorSelectors = [
      '.author', '.byline', '.post-author', '.entry-author',
      '[rel="author"]', 'a[href*="/author/"]', '.author-name',
      '[data-testid="author-name"]'
    ];
    for (const selector of authorSelectors) {
      const authorElement = document.querySelector(selector);
      const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            if (el.offsetParent === null && style.position !== 'fixed') {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return false;
            }
            if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
            return true;
      };

      if (authorElement && authorElement.textContent?.trim() && isVisible(authorElement)) {
        const nameNode = authorElement.querySelector('.author-name') || authorElement.querySelector('[data-testid="author-name"]') || authorElement;
        let name = nameNode.textContent.trim();
        name = name.replace(/^by\s+/i, '').trim();
        if (name) return name;
      }
    }
    return null;
  }
}

module.exports = GeneralExtractorStrategy;