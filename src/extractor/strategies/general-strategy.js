// src/extractor/strategies/general-strategy.js
const BaseExtractor = require('../base-extractor');
const cheerio = require('cheerio');

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
  }

  /**
   * Extract and save page data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting less restrictive text extraction...');

      // Extract all page data using the revised method
      const pageData = await this.extractData();

      // Save to Chrome storage
      await this.saveToStorage(pageData);
    } catch (error) {
      this.logger.error('Error in general content extraction:', error);

      // Save error message to storage
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Extract page data using revised logic (capture almost all text).
   * @returns {Promise<Object>} The extracted page data
   */
  async extractData() {
    try {
      // Get user selection if any
      const selectedText = window.getSelection().toString().trim();

      // Extract basic page metadata
      const title = this.extractPageTitle();
      const url = this.extractPageUrl();
      const description = this.extractMetaDescription();
      const author = this.extractAuthor(); // Keep existing author logic

      // Extract content (either selection or all text from main/body)
      let content;
      if (selectedText) {
        content = selectedText;
        this.logger.info('Using selected text as content.');
      } else {
        this.logger.info('No selection, extracting content using Cheerio.');
        content = ''; // Initialize content variable
        try {
            const pageHtml = document.body.innerHTML;
            const $ = cheerio.load(pageHtml);

            // Selectors for elements to remove (noise)
            const noiseSelectors = [
                'script', 'style', 'noscript', 'head', 'link', 'meta',
                'svg', 'canvas', 'video', 'audio', 'img', 'iframe',
                'nav', 'footer', 'aside', '[role="banner"]', '[role="navigation"]',
                '[role="complementary"]', '[class*="ad"], [id*="ad"]',
                '[class*="advert"], [id*="advert"]', '[class*="popup"], [id*="popup"]',
                '[class*="modal"], [id*="modal"]', '[aria-modal="true"]',
                '.cookie-banner', '#cookie-banner', '.sidebar', '#sidebar'
            ].join(', '); // Join selectors into a single string

            $(noiseSelectors).remove();
            this.logger.info('Removed noise elements using Cheerio.');

            // Selectors for potential main content areas (prioritized)
            const contentSelectors = ['main', 'article', '[role="main"]'];
            let contentElement = null;

            for (const selector of contentSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                    contentElement = element.first();
                    this.logger.info(`Using Cheerio content selector: ${selector}`);
                    break;
                }
            }

            // Fallback to body if no specific container found
            if (!contentElement) {
                contentElement = $('body');
                this.logger.info('Using Cheerio fallback selector: body');
            }

            // Extract text from the selected container
            let extractedText = contentElement.text();

            // Clean up whitespace: replace multiple spaces/newlines with single ones, then trim
            content = extractedText
                .replace(/[\t\f\v ]+/g, ' ')   // Replace various spaces with a single space
                .replace(/(\r?\n){2,}/g, '\n\n') // Replace 2+ newlines with exactly two
                .replace(/ \n/g, '\n')         // Remove spaces before newlines
                .trim();                       // Trim leading/trailing whitespace

            this.logger.info(`Cheerio extracted ${content.length} characters of text.`);

        } catch (cheerioError) {
            this.logger.error('Error during Cheerio processing:', cheerioError);
            content = 'Error extracting content using Cheerio: ' + cheerioError.message;
            // Consider adding error flag here if needed, similar to the outer catch
        }
      }

      // Return the complete page data object
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author, // Include extracted author
        content: content,
        isSelection: !!selectedText,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error extracting page data:', error);

      // Return what we could get, with error message
      return {
        pageTitle: this.extractPageTitle(),
        pageUrl: this.extractPageUrl(),
        pageDescription: this.extractMetaDescription(), // Attempt to get metadata even on error
        pageAuthor: this.extractAuthor(), // Attempt to get metadata even on error
        content: 'Error extracting content: ' + error.message,
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      };
    }
  }

  // _isElementVisible function is REMOVED as it's no longer needed.


  // --- Metadata Extraction Methods ---
  // These remain unchanged as they target specific elements/attributes

  /**
   * Extract the page title
   * @returns {string} The page title
   */
  extractPageTitle() {
    return document.title || 'Unknown Title';
  }

  /**
   * Extract the page URL
   * @returns {string} The current page URL
   */
  extractPageUrl() {
    return window.location.href;
  }

  /**
   * Extract meta description from the page
   * @returns {string|null} The meta description or null if not found
   */
  extractMetaDescription() {
    const metaDescription = document.querySelector('meta[name="description"]');
    return metaDescription ? metaDescription.getAttribute('content') : null;
  }

  /**
   * Attempt to extract the author name from the page
   * (Kept the original logic, including its visibility check, as it's specific metadata hunting)
   * @returns {string|null} The author name or null if not found
   */
  extractAuthor() {
    // Try meta tags first
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

    // Try common author selectors - *Keeping the original visibility check here*
    // because we are looking for a specific, *visibly presented* author name,
    // not just any text that might match the selector.
    const authorSelectors = [
      '.author', '.byline', '.post-author', '.entry-author',
      '[rel="author"]', 'a[href*="/author/"]', '.author-name',
      '[data-testid="author-name"]' // Added from Reddit example
    ];
    for (const selector of authorSelectors) {
      const authorElement = document.querySelector(selector);
      // Use a temporary visibility check function just for this specific metadata extraction
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
        // Prefer a specific child element if available, otherwise use the element itself
        const nameNode = authorElement.querySelector('.author-name') || authorElement.querySelector('[data-testid="author-name"]') || authorElement;
        let name = nameNode.textContent.trim();
        // Basic cleanup like removing "by " prefix
        name = name.replace(/^by\s+/i, '').trim();
        if (name) return name;
      }
    }

    return null;
  }
}

module.exports = GeneralExtractorStrategy;
