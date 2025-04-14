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
    if (!element || typeof window.getComputedStyle !== 'function') {
        this.logger.debug('Visibility check failed: No element or getComputedStyle unavailable.');
        return false; // Basic checks
    }
    if (element.nodeType !== Node.ELEMENT_NODE) {
        this.logger.debug('Visibility check failed: Not an element node.');
        return false; // Only check element nodes
    }

    // Check HTML attributes first (quick checks)
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
        this.logger.debug(`Element hidden by attribute: ${element.tagName}`);
        return false;
    }

    // Check inline style (another quick check)
    if (element.style?.display === 'none' || element.style?.visibility === 'hidden' || element.style?.opacity === '0') {
        this.logger.debug(`Element hidden by inline style: ${element.tagName}`);
        return false;
    }

    // Check computed style (more definitive)
    try {
        const style = window.getComputedStyle(element);
        if (!style) {
             this.logger.debug(`Could not get computed style for: ${element.tagName}`);
             return false; // Cannot determine visibility
        }
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            this.logger.debug(`Element hidden by computed style (${style.display}, ${style.visibility}, ${style.opacity}): ${element.tagName}`);
            return false;
        }

    } catch (e) {
        // This can happen for pseudo-elements or elements in detached iframes
        this.logger.warn(`Error getting computed style for ${element.tagName}: ${e.message}`);
        return false; // Assume hidden if we can't compute style
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
        // Important: Check visibility of the *parent* element
        let parentElement = node.parentElement;
        // Traverse up if the immediate parent isn't an element (rare, but possible)
        while (parentElement && parentElement.nodeType !== Node.ELEMENT_NODE) {
            parentElement = parentElement.parentElement;
        }

        if (parentElement && !this._isElementVisible(parentElement)) {
            return ''; // Parent is hidden, so this text is effectively hidden
        }
        // Also check if parent is a noise tag (e.g., text directly inside <script>)
        if (parentElement && this.noiseTags.has(parentElement.tagName)) {
            return '';
        }

        // Return the text content, trimming might remove intentional spacing,
        // let _moderateCleanText handle collapsing later.
        return node.textContent || '';
    }

    // --- Case 2: Element Node ---
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node; // Alias for clarity

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

        // Recursively process child nodes
        let visibleText = '';
        // Handle Shadow DOM if present and open
        if (element.shadowRoot && element.shadowRoot.mode === 'open') {
            this.logger.debug(`Traversing open Shadow DOM for: ${element.tagName}`);
            for (const childNode of element.shadowRoot.childNodes) {
                visibleText += this._extractVisibleText(childNode);
            }
        } else {
            // Traverse regular children
            for (const childNode of element.childNodes) {
                visibleText += this._extractVisibleText(childNode);
            }
        }

        // Add a space after block-level elements to simulate paragraph breaks better
        // This helps _moderateCleanText separate text from different blocks.
        try {
            const displayStyle = window.getComputedStyle(element).display;
            if (displayStyle === 'block' || displayStyle === 'list-item' || displayStyle.includes('table')) {
                 // Append space only if visibleText isn't empty and doesn't end with space
                 if (visibleText.length > 0 && !/\s$/.test(visibleText)) {
                     visibleText += ' ';
                 }
            }
        } catch(e) { /* ignore errors getting style here */ }


        return visibleText;
    }

    // --- Case 3: Other Node Types ---
    // Ignore comments, processing instructions, etc.
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
        try {
          // *** Extract text only from visible elements starting from body ***
          const rawVisibleText = this._extractVisibleText(document.body);

          // *** Apply moderate cleaning ***
          content = this._moderateCleanText(rawVisibleText);
          this.logger.info(`DOM traversal extracted and moderately cleaned ${content.length} characters.`);

        } catch (domError) {
          this.logger.error('Error during DOM traversal for visible text:', domError);
          content = 'Error extracting visible content using DOM traversal: ' + domError.message;
          // Fallback to basic text extraction on error
          try {
            this.logger.warn('Attempting fallback to document.body.textContent...');
            let bodyText = document.body.textContent || '';
            // Append to existing error message or replace if empty
            let fallbackContent = this._moderateCleanText(bodyText);
            if (fallbackContent) {
                 content += (content ? ' ' : '') + ` [Fallback content: ${fallbackContent}]`;
                 this.logger.warn(`Fallback (all text) extracted and cleaned ${fallbackContent.length} characters after DOM traversal error.`);
            } else {
                 content += ' Fallback extraction failed to get text.';
                 this.logger.warn('Fallback extraction yielded no text content.');
            }
          } catch (fallbackError) {
            this.logger.error('Fallback text extraction failed after DOM traversal error:', fallbackError);
            content = 'Content extraction failed completely after DOM traversal error and fallback attempt.';
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