// src/extractor/strategies/general-strategy.js
const BaseExtractor = require('../base-extractor');

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
  }

  /**
   * Extract and save page data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting comprehensive visible text extraction...');

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
   * Extract page data using revised logic (capture all visible text).
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
      const author = this.extractAuthor();

      // Extract content (either selection or all visible text)
      let content;
      if (selectedText) {
        content = selectedText;
        this.logger.info('Using selected text as content.');
      } else {
        this.logger.info('No selection, extracting all visible text from BODY.');
        const textChunks = [];
        this._extractVisibleTextRecursive(document.body, textChunks);
        // Join chunks, normalize multiple newlines/spaces, and trim
        content = textChunks.join('')
                           .replace(/ {2,}/g, ' ') // Replace multiple spaces with one
                           .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
                           .trim();
        this.logger.info(`Extracted ${content.length} characters of visible text.`);
      }

      // Return the complete page data object
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
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
        content: 'Error extracting content: ' + error.message,
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Checks if an element is visible in the DOM.
   * @param {HTMLElement} element - The element to check.
   * @returns {boolean} True if the element is considered visible.
   * @private
   */
  _isElementVisible(element) {
    if (!element) return false;
    // Check computed style first, as it's often the most definitive
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') {
        return false;
    }
    // Check offsetParent as a fallback (null means not rendered or fixed/absolute ancestor is hidden)
    if (element.offsetParent === null) {
        // Allow fixed position elements even if offsetParent is null initially
        if (style.position !== 'fixed') {
            // Check if it has dimensions, maybe it's just not in flow
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return false;
            }
        }
    }
    // Check hidden attributes
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    return true;
  }


  /**
   * Recursively extracts visible text content from a node and its children.
   * Appends extracted text chunks to the `accumulatedText` array.
   * @param {Node} node - The current node to process.
   * @param {string[]} accumulatedText - An array to store the extracted text chunks.
   * @private
   */
  _extractVisibleTextRecursive(node, accumulatedText) {
    // 1. Filter out non-element/non-text nodes, excluded tags, and hidden elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      // More comprehensive list of tags to generally ignore for text content
      const excludedTags = ['script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio', 'button', 'input', 'select', 'textarea', 'img', 'nav', 'footer', 'aside', 'form', 'head', 'link', 'meta'];
      if (excludedTags.includes(tagName) || !this._isElementVisible(node)) {
        return; // Skip this element and its children
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Process Text Node: Ensure parent is visible and text has content
      if (!node.parentElement || !this._isElementVisible(node.parentElement)) {
        return; // Skip text node if parent is hidden
      }
      const text = node.textContent;
      if (text && text.trim().length > 0) {
        // Normalize whitespace within the text node and add a trailing space
        // The final cleanup will handle extra spaces between words/chunks.
        accumulatedText.push(text.replace(/\s+/g, ' ') + ' ');
      }
      return; // Text nodes have no children
    } else {
      return; // Ignore other node types (comments, etc.)
    }

    // 2. Recurse into children
    node.childNodes.forEach(child => {
      this._extractVisibleTextRecursive(child, accumulatedText);
    });

    // 3. Add appropriate newline(s) after processing children of block-level elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      // Common block-level tags that usually warrant a line break separation
      const blockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'blockquote', 'pre', 'section', 'article', 'header', 'address', 'dl', 'dt', 'dd', 'ul', 'ol', 'table', 'tr', 'th', 'td', 'hr', 'center'];
      const lineBreakTags = ['br'];

      if (blockTags.includes(tagName)) {
        // Add a newline marker. We'll consolidate them later.
        accumulatedText.push('\n');
      } else if (lineBreakTags.includes(tagName)) {
        accumulatedText.push('\n');
      }
      // Inline elements generally don't add newlines; spacing comes from text nodes.
    }
  }


  // --- Metadata Extraction Methods ---

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

    // Try common author selectors
    const authorSelectors = [
      '.author', '.byline', '.post-author', '.entry-author',
      '[rel="author"]', 'a[href*="/author/"]', '.author-name',
      '[data-testid="author-name"]'
    ];
    for (const selector of authorSelectors) {
      const authorElement = document.querySelector(selector);
      if (authorElement && authorElement.textContent?.trim() && this._isElementVisible(authorElement)) {
        const nameNode = authorElement.querySelector('.author-name') || authorElement;
        let name = nameNode.textContent.trim();
        name = name.replace(/^by\s+/i, '').trim();
        if (name) return name;
      }
    }

    return null;
  }
}

module.exports = GeneralExtractorStrategy;