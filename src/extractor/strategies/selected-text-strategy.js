// src/extractor/strategies/selected-text-strategy.js
const BaseExtractor = require('../base-extractor');

class SelectedTextExtractorStrategy extends BaseExtractor {
  constructor() {
    super('selected_text');
  }

  /**
   * Extract and save selected text data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting selected text extraction...');
      
      // Extract selected text data
      const selectedTextData = await this.extractData();
      
      // Save to Chrome storage
      await this.saveToStorage(selectedTextData);
    } catch (error) {
      this.logger.error('Error in selected text extraction:', error);
      
      // Save error message to storage
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Extract selected text data
   * @returns {Object} The extracted data
   */
  async extractData() {
    try {
      // Get user selection
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (!selectedText) {
        throw new Error('No text selected');
      }
      
      // Extract basic page metadata
      const title = document.title || 'Unknown Title';
      const url = window.location.href;
      const originalContentType = this.detectOriginalContentType(url);
      const contentSubtype = this.detectContentSubtype(selectedText);
      
      // Get surrounding context to improve understanding
      const contextElements = this.getContextElements(selection);
      
      // Return the complete data object
      return {
        pageTitle: title,
        pageUrl: url,
        text: selectedText,
        originalContentType,
        contentSubtype,
        textLength: selectedText.length,
        context: contextElements,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error extracting selected text data:', error);
      throw error;
    }
  }

  /**
   * Determine the original content type of the page
   * @param {string} url - The page URL
   * @returns {string} The original content type
   */
  detectOriginalContentType(url) {
    if (url.endsWith('.pdf') || 
        url.includes('/pdf/') || 
        url.includes('pdfviewer') || 
        (url.includes('chrome-extension://') && url.includes('pdfviewer'))) {
      return 'pdf';
    } else if (url.includes('youtube.com/watch')) {
      return 'youtube';
    } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
      return 'reddit';
    } else {
      return 'general';
    }
  }

  /**
   * Detect the content subtype of the selected text
   * @param {string} text - The selected text
   * @returns {string} The detected content subtype
   */
  detectContentSubtype(text) {
    // Simple patterns to recognize code snippets
    const codePatterns = [
      /function\s+\w+\s*\(/,  // function declarations
      /class\s+\w+/,          // class declarations
      /import\s+.*from/,      // import statements
      /const|let|var\s+\w+\s*=/,  // variable declarations
      /<\/?[a-z][\s\S]*>/i,  // HTML tags
      /^[\s\t]*[#@]\w+/m,     // Python decorators or directives
      /^[\s\t]*def\s+\w+\s*\(/m, // Python function definition
      /public|private|protected\s+\w+\s+\w+/, // Java/C# method declaration
      /^\s*```[a-z]*\s*$/m    // Markdown code blocks
    ];
    
    // JSON pattern
    const jsonPattern = /^\s*[{\[][\s\S]*[}\]]\s*$/;
    
    // CSV pattern (simple check for comma-separated values)
    const csvPattern = /^[^,\n]+(?:,[^,\n]+){2,}$/m;
    
    // Mathematical content pattern
    const mathPattern = /[\+\-\*\/\^]=|[0-9]+\s*[\+\-\*\/\^]\s*[0-9]+|\(\s*[0-9]+\s*[\+\-\*\/\^]|[0-9]+\s*[\+\-\*\/\^]\s*\(|∫|∑|∏|√|∂|∇|∆|≠|≤|≥|≈|∝|∞|∀|∃|∄|∈|∉|∋|∌|∩|∪/;
    
    // Check for code
    if (codePatterns.some(pattern => pattern.test(text))) {
      return 'code';
    }
    
    // Check for JSON
    if (jsonPattern.test(text)) {
      return 'json';
    }
    
    // Check for CSV
    if (csvPattern.test(text)) {
      return 'data';
    }
    
    // Check for mathematical content
    if (mathPattern.test(text)) {
      return 'math';
    }
    
    // Default to plain text
    return 'text';
  }

  /**
   * Get context elements surrounding the selection
   * @param {Selection} selection - The window selection object
   * @returns {Object} Context information
   */
  getContextElements(selection) {
    try {
      const context = {};
      
      // Get the container node and its tag
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Get parent element if text node
        const containerElement = container.nodeType === 3 ? container.parentElement : container;
        
        if (containerElement) {
          // Get tag name
          context.containerTag = containerElement.tagName.toLowerCase();
          
          // Get container classes
          if (containerElement.className) {
            context.containerClass = containerElement.className.toString();
          }
          
          // Get section heading if available
          const nearestHeading = this.findNearestHeading(containerElement);
          if (nearestHeading) {
            context.heading = nearestHeading.textContent.trim();
          }
        }
      }
      
      return context;
    } catch (error) {
      this.logger.warn('Error getting context elements:', error);
      return {};
    }
  }

  /**
   * Find the nearest heading element to the given element
   * @param {Element} element - The starting element
   * @returns {Element|null} The nearest heading element or null
   */
  findNearestHeading(element) {
    // Check if the element itself is a heading
    if (/^h[1-6]$/i.test(element.tagName)) {
      return element;
    }
    
    // Look for previous siblings that are headings
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (/^h[1-6]$/i.test(sibling.tagName)) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    
    // If no heading found, check parent elements
    if (element.parentElement && element.parentElement !== document.body) {
      return this.findNearestHeading(element.parentElement);
    }
    
    return null;
  }
}

module.exports = SelectedTextExtractorStrategy;