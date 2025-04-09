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
        this.logger.info('No selection, extracting all text recursively from MAIN or BODY.');
        const textChunks = [];
        // Try to start from <main>, fall back to <body>
        const startNode = document.querySelector('main') || document.body;
        if (startNode) {
            this._extractTextRecursive(startNode, textChunks);
        } else {
            this.logger.warn('Could not find MAIN or BODY element.');
        }
        // Join chunks, normalize multiple newlines/spaces, and trim
        content = textChunks.join('')
                           .replace(/ {2,}/g, ' ') // Replace multiple spaces with one
                           .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
                           .trim();
        this.logger.info(`Extracted ${content.length} characters of text.`);
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

  /**
   * Recursively extracts text content from a node and its children,
   * including Shadow DOM, with minimal exclusions.
   * Appends extracted text chunks to the `accumulatedText` array.
   * @param {Node} node - The current node to process.
   * @param {string[]} accumulatedText - An array to store the extracted text chunks.
   * @private
   */
  _extractTextRecursive(node, accumulatedText) {
    // 1. Filter out non-element/non-text nodes and essential excluded tags
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      // Minimal list of tags to exclude (scripts, styles, non-textual media)
      const excludedTags = ['script', 'style', 'noscript', 'head', 'link', 'meta', 'svg', 'canvas', 'video', 'audio', 'img', 'iframe'];
      if (excludedTags.includes(tagName)) {
        return; // Skip this element and its children entirely
      }
      // Recurse into Shadow DOM if it exists
      if (node.shadowRoot) {
        node.shadowRoot.childNodes.forEach(child => {
            this._extractTextRecursive(child, accumulatedText);
        });
      }

    } else if (node.nodeType === Node.TEXT_NODE) {
      // Process Text Node: Append its content after basic normalization
      const text = node.textContent;
      if (text && text.trim().length > 0) {
        // Normalize whitespace within the text node and add a trailing space.
        // The final cleanup in extractData will handle extra spaces between words/chunks.
        accumulatedText.push(text.replace(/\s+/g, ' ') + ' ');
      }
      return; // Text nodes have no children to recurse into

    } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        // This handles the case when recursing into a shadowRoot
        // Just proceed to iterate children
    }
     else {
      return; // Ignore other node types (comments, etc.)
    }

    // 2. Recurse into children for Element Nodes and Document Fragments (like Shadow Roots)
    if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
            this._extractTextRecursive(child, accumulatedText);
        });
    }


    // 3. Add appropriate newline(s) after processing children of block-level elements
    // This helps preserve some structure, even though we removed visibility checks.
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      // Common block-level tags that usually warrant a line break separation
      const blockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'blockquote', 'pre', 'section', 'article', 'header', 'address', 'dl', 'dt', 'dd', 'ul', 'ol', 'table', 'tr', 'th', 'td', 'hr', 'center', 'main', 'nav', 'footer', 'aside', 'form'];
      // Note: Some tags previously excluded for content (nav, footer, aside, form) are now included here
      // for block formatting, as we are aiming for maximum text capture.
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