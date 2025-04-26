// src/extractor/strategies/general-strategy.js
const BaseExtractor = require('../base-extractor');

class GeneralExtractorStrategy extends BaseExtractor {
  constructor() {
    super('general');
    // Set of tags typically considered non-content or noisy for general text extraction
    this.noiseTags = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'LINK', 'META',
        'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED',
        'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'FORM',
        'NAV', 'ASIDE', 'FOOTER', // Often contain less relevant primary content
        'FIGURE', 'FIGCAPTION' // Can be noisy in some contexts
    ]);
  }

  /**
   * Cleans extracted text content with space-based condensation.
   * Replaces all newlines with spaces for a more compact, inline output.
   * @param {string} text - The raw text content.
   * @returns {string} - The cleaned, condensed text content.
   */
  _moderateCleanText(text) {
    if (!text) return '';
    let cleaned = text;

    // 1. Normalize line breaks to \n
    cleaned = cleaned.replace(/\r\n/g, '\n');

    // 2. Replace various whitespace chars (tabs, vertical tabs, form feeds) with spaces
    cleaned = cleaned.replace(/[\t\v\f]+/g, ' ');

    // 3. Replace all newlines with spaces for condensed output
    cleaned = cleaned.replace(/\n+/g, ' ');

    // 4. Collapse multiple spaces into a single space
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    // 5. Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Checks if an element is visually displayed in the DOM.
   * @param {Element} element - The DOM element to check.
   * @returns {boolean} - True if the element is considered visible, false otherwise.
   * @private
   */
  _isElementVisible(element) {
    // 1. Basic existence and capability checks
    if (!element || typeof window.getComputedStyle !== 'function') {
        this.logger.debug('Visibility check failed: No element or getComputedStyle unavailable.');
        return false;
    }

    // 2. Node type check
    if (element.nodeType !== Node.ELEMENT_NODE) {
        this.logger.debug('Visibility check failed: Not an element node.');
        return false;
    }

    // 3. Attribute checks
    if (element.hasAttribute('hidden')) {
        this.logger.debug(`Element hidden by 'hidden' attribute: ${element.tagName}`);
        return false;
    }
    if (element.getAttribute('aria-hidden') === 'true') {
        this.logger.debug(`Element hidden by 'aria-hidden' attribute: ${element.tagName}`);
        return false;
    }

    // 4. Inline style checks
    if (element.style?.display === 'none') {
        this.logger.debug(`Element hidden by inline display:none: ${element.tagName}`);
        return false;
    }
    if (element.style?.visibility === 'hidden') {
        this.logger.debug(`Element hidden by inline visibility:hidden: ${element.tagName}`);
        return false;
    }
    if (element.style?.opacity === '0') {
        this.logger.debug(`Element hidden by inline opacity:0: ${element.tagName}`);
        return false;
    }

    // 5. Computed style checks (wrapped in try-catch)
    try {
        const style = window.getComputedStyle(element);
        if (!style) {
            this.logger.debug(`Could not get computed style for: ${element.tagName}`);
            return false;
        }

        if (style.display === 'none') {
            this.logger.debug(`Element hidden by computed display:none: ${element.tagName}`);
            return false;
        }
        if (style.visibility === 'hidden') {
            this.logger.debug(`Element hidden by computed visibility:hidden: ${element.tagName}`);
            return false;
        }
        if (style.opacity === '0') {
            this.logger.debug(`Element hidden by computed opacity:0: ${element.tagName}`);
            return false;
        }

        // Additional checks for elements with zero dimensions
        if (style.width === '0px' && style.height === '0px') {
            this.logger.debug(`Element has zero dimensions: ${element.tagName}`);
            return false;
        }

    } catch (e) {
        this.logger.warn(`Error getting computed style for ${element.tagName}: ${e.message}`);
        return false;
    }

    // 6. Parent visibility check (recursive)
    if (element.parentElement && !this._isElementVisible(element.parentElement)) {
        this.logger.debug(`Element hidden by parent visibility: ${element.tagName}`);
        return false;
    }

    this.logger.debug(`Element considered visible: ${element.tagName}`);
    return true;
  }

  /**
   * Recursively extracts text content from visible nodes within a given node.
   * @param {Node} node - The starting DOM node (element or text node).
   * @returns {string} - The concatenated visible text content.
   * @private
   */
  _extractVisibleText(node) {
    if (!node) return '';

    // --- Case 1: Text Node ---
    if (node.nodeType === Node.TEXT_NODE) {
        // Find the closest parent element
        let parentElement = node.parentElement;
        while (parentElement && parentElement.nodeType !== Node.ELEMENT_NODE) {
            parentElement = parentElement.parentElement;
        }

        if (!parentElement) {
            this.logger.debug('Text node has no parent element');
            return '';
        }

        // Check parent visibility
        if (!this._isElementVisible(parentElement)) {
            this.logger.debug(`Text node hidden by parent visibility: ${parentElement.tagName}`);
            return '';
        }

        // Check if parent is a noise tag
        if (this.noiseTags.has(parentElement.tagName)) {
            this.logger.debug(`Text node skipped due to noise tag parent: ${parentElement.tagName}`);
            return '';
        }

        return node.textContent || '';
    }

    // --- Case 2: Element Node ---
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;

        // Skip noise tags entirely
        if (this.noiseTags.has(element.tagName)) {
            this.logger.debug(`Skipping noise tag: ${element.tagName}`);
            return '';
        }

        // Skip non-visible elements
        if (!this._isElementVisible(element)) {
            this.logger.debug(`Skipping hidden element: ${element.tagName}`);
            return '';
        }

        let visibleText = '';

        // Handle Shadow DOM if present and open
        if (element.shadowRoot && element.shadowRoot.mode === 'open') {
            this.logger.debug(`Traversing open Shadow DOM for: ${element.tagName}`);
            for (const childNode of element.shadowRoot.childNodes) {
                const childText = this._extractVisibleText(childNode);
                if (childText) {
                    visibleText += childText;
                }
            }
        } else {
            // Traverse regular children
            for (const childNode of element.childNodes) {
                const childText = this._extractVisibleText(childNode);
                if (childText) {
                    visibleText += childText;
                }
            }
        }

        // Add spacing for block elements if needed
        try {
            const style = window.getComputedStyle(element);
            const display = style.display;
            const isBlock = display === 'block' || display === 'list-item' || display.includes('table');
            
            if (isBlock && visibleText && !/\s$/.test(visibleText)) {
                visibleText += ' ';
                this.logger.debug(`Added spacing after block element: ${element.tagName}`);
            }
        } catch (e) {
            this.logger.debug(`Could not check display style for ${element.tagName}: ${e.message}`);
        }

        return visibleText;
    }

    // --- Case 3: Other Node Types ---
    return '';
  }


  /**
   * Extract and save page data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      // Updated log message
      this.logger.info('Starting general content extraction (DOM Traversal - Visible Only)...');
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
   * Extract page data using DOM traversal for visible elements or user selection.
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
      // Extract basic page metadata (always attempt this)
      title = this.extractPageTitle();
      url = this.extractPageUrl();
      description = this.extractMetaDescription();
      author = this.extractAuthor(); // Now uses _isElementVisible

      // Get user selection if any
      const selectedText = window.getSelection().toString().trim();
      isSelection = !!selectedText;

      // Extract content
      if (selectedText) {
        // Use selection directly, apply moderate cleaning
        content = this._moderateCleanText(selectedText);
        this.logger.info('Using selected text as content (moderately cleaned).');
      } else {
        // *** Extract content using DOM traversal for VISIBLE elements ***
        this.logger.info('No selection, extracting visible content using DOM traversal.');
        content = ''; // Initialize content variable
        
        // Primary extraction attempt with enhanced DOM traversal
        try {
          const rawVisibleText = this._extractVisibleText(document.body);
          content = this._moderateCleanText(rawVisibleText);
          
          if (!content.trim()) {
            throw new Error('DOM traversal returned empty content');
          }
          
          this.logger.info(`Successfully extracted ${content.length} characters using DOM traversal.`);
          
        } catch (domError) {
          this.logger.error('Error during DOM traversal for visible text:', domError);
          
          // Construct error message
          content = `Error extracting visible content: ${domError.message}`;
          
          // First fallback: Try document.body.textContent
          try {
            this.logger.warn('Attempting first fallback to document.body.textContent');
            const fallbackText = document.body.textContent || '';
            const cleanedFallback = this._moderateCleanText(fallbackText);
            
            if (cleanedFallback) {
              content += ` [Fallback content: ${cleanedFallback}]`;
              this.logger.warn(`First fallback extracted ${cleanedFallback.length} characters`);
            } else {
              throw new Error('First fallback returned empty content');
            }
            
          } catch (fallbackError1) {
            this.logger.error('First fallback failed:', fallbackError1);
            
            // Second fallback: Try document.body.innerText
            try {
              this.logger.warn('Attempting second fallback to document.body.innerText');
              const innerText = document.body.innerText || '';
              const cleanedInnerText = this._moderateCleanText(innerText);
              
              if (cleanedInnerText) {
                content += ` [InnerText fallback: ${cleanedInnerText}]`;
                this.logger.warn(`Second fallback extracted ${cleanedInnerText.length} characters`);
              } else {
                throw new Error('Second fallback returned empty content');
              }
              
            } catch (fallbackError2) {
              this.logger.error('Second fallback failed:', fallbackError2);
              content += ' All fallback attempts failed.';
            }
          }
        }
      }

      // Return the complete page data object
      return {
        pageTitle: title,
        pageUrl: url,
        pageDescription: description,
        pageAuthor: author,
        content: content,
        isSelection: isSelection,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error extracting page data:', error);
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

  // --- Metadata Extraction Methods ---
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
    // 1. Try meta tags first
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]'
    ];
    for (const selector of metaSelectors) {
      const metaElement = document.querySelector(selector);
      if (metaElement && metaElement.getAttribute('content')) {
        this.logger.info(`Author found in meta tag (${selector})`);
        return metaElement.getAttribute('content').trim();
      }
    }

    // 2. Try common visible elements
    const authorSelectors = [
      '.author', '.byline', '.post-author', '.entry-author',
      '[rel="author"]', 'a[href*="/author/"]', '.author-name',
      '[data-testid="author-name"]', // Common in React apps
      '[itemprop="author"]' // Schema.org markup
    ];

    // Use the shared visibility checker
    const isVisible = (el) => this._isElementVisible(el);

    for (const selector of authorSelectors) {
        // Use querySelectorAll to handle cases where multiple elements match,
        // but prioritize the first visible one.
        const authorElements = document.querySelectorAll(selector);
        for (const authorElement of authorElements) {
            // Check visibility *before* accessing textContent
            if (authorElement && isVisible(authorElement)) {
                const text = authorElement.textContent?.trim();
                if (text) {
                    // Try to find a more specific name node inside, if it exists and is visible
                    const nameNode = authorElement.querySelector('.author-name, [data-testid="author-name"], [itemprop="name"]') || authorElement; // Check itemprop too

                    if (nameNode && isVisible(nameNode)) {
                        let name = nameNode.textContent.trim();
                        name = name.replace(/^by\s+/i, '').trim(); // Clean "By " prefix
                        if (name) {
                            this.logger.info(`Author found in visible element (${selector} -> specific name node)`);
                            return name;
                        }
                    }

                    // Fallback to the main element's text if inner node not found/visible/empty,
                    // but the main element itself is visible and has text.
                    let name = authorElement.textContent.trim();
                    name = name.replace(/^by\s+/i, '').trim(); // Clean "By " prefix
                    if (name) {
                         this.logger.info(`Author found in visible element (${selector} -> main element text)`);
                         return name;
                    }
                }
            }
        }
    }

    this.logger.info('Author not found via meta tags or common selectors.');
    return null; // No author found
  }
}

module.exports = GeneralExtractorStrategy;
