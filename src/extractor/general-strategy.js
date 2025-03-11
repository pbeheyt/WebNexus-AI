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
      this.logger.info('Starting general page data extraction...');
      
      // Extract all page data
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
   * Extract page data
   * @returns {Object} The extracted page data
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
      
      // Extract content (either selection or main content)
      const content = selectedText || this.extractVisibleText();
      
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
   * Extract all visible text from the page
   * @returns {string} All visible text content
   */
  extractVisibleText() {
    let bodyText = '';
    
    /**
     * Recursive function to extract text from DOM node
     * @param {Node} node - The DOM node to extract text from
     * @returns {string} Extracted text
     */
    function extractText(node) {
      // Handle text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim().length > 0) {
          return node.textContent;
        }
        return '';
      }
      
      // Handle element nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        // Skip hidden or non-content elements
        const excludedTags = [
          'script', 'style', 'img', 'svg', 'footer', 'nav', 
          'noscript', 'iframe', 'video', 'audio', 'canvas'
        ];
        
        if (excludedTags.includes(tagName)) {
          return '';
        }
        
        // Check if element is visible using computed style
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return '';
        }
        
        // Extract text from child nodes
        let text = '';
        node.childNodes.forEach(child => {
          text += extractText(child);
        });
        
        // Add spacing based on element type
        if (['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
          text += '\n\n';
        } else if (['br'].includes(tagName)) {
          text += '\n';
        } else if (['span', 'a', 'strong', 'em', 'b', 'i'].includes(tagName)) {
          text += ' ';
        }
        
        return text;
      }
      
      return '';
    }
    
    // Start extraction from body
    document.body.childNodes.forEach(child => {
      bodyText += extractText(child);
    });
    
    // Clean up multiple line breaks and spaces
    return bodyText
      .replace(/\n{3,}/g, '\n\n')  // Replace 3+ line breaks with 2
      .replace(/\s{2,}/g, ' ')     // Replace 2+ spaces with 1
      .trim();
  }

  /**
   * Attempt to extract the author name from the page
   * @returns {string|null} The author name or null if not found
   */
  extractAuthor() {
    // Try meta tags first
    const metaAuthor = document.querySelector('meta[name="author"], meta[property="author"], meta[property="article:author"]');
    if (metaAuthor) {
      return metaAuthor.getAttribute('content');
    }
    
    // Try common author selectors
    const authorSelectors = [
      '.author',
      '.byline',
      '.post-author',
      '.entry-author',
      '[rel="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const authorElement = document.querySelector(selector);
      if (authorElement && authorElement.textContent.trim()) {
        return authorElement.textContent.trim();
      }
    }
    
    return null;
  }
}

module.exports = GeneralExtractorStrategy;