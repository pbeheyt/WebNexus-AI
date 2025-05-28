import { Readability } from '@mozilla/readability';

import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

// Default mode if not specified in config. Can be 'focused' or 'broad'.
const DEFAULT_EXTRACTION_MODE = 'broad';
const MIN_BROAD_TEXT_LENGTH = 15; // Minimum characters for the entire extracted broad text to be considered useful.

class GeneralExtractorStrategy extends BaseExtractor {
  constructor(config = {}) { // Accept a config object
    super('general');
    this.config = { ...{ extractionMode: DEFAULT_EXTRACTION_MODE }, ...config };
    this.logger.info(`GeneralExtractorStrategy initialized with mode: ${this.config.extractionMode}`);
  }

  /**
   * Cleans and standardizes text content by normalizing whitespace.
   * @param {string} text - The raw text content.
   * @returns {string} - The cleaned, condensed text content, or an empty string if input is falsy.
   */
  _moderateCleanText(text) {
    if (!text) return '';
    let cleaned = text;

    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/[\t\v\f]+/g, ' ');
    // For broad content, joining with \n\n and then moderate cleaning helps preserve some structure
    // before final normalization.
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Orchestrates the extraction of page content and saves it to storage.
   */
  async extractAndSaveContent() {
    try {
      this.logger.info(`General content extraction process started (Mode: ${this.config.extractionMode}).`);
      const pageData = await this.extractData();
      await this.saveToStorage(pageData);
      this.logger.info('General content extraction process completed and data saved.');
    } catch (error) {
      this.logger.error('Error during general content extraction and saving:', error);
      await this.saveToStorage({
        error: true,
        message: `Extraction failed: ${error.message || 'Unknown error'}`,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
        mode: this.config.extractionMode,
      });
    }
  }

  /**
   * Extracts page data. Prioritizes user's selected text.
   * Otherwise, uses Readability.js (focused mode) or TreeWalker (broad mode).
   * @returns {Promise<Object>} An object containing the extracted page data.
   */
  async extractData() {
    let title = this.extractPageTitle();
    const url = this.extractPageUrl();
    let description = this.extractMetaDescription();
    let author = this.extractAuthor();
    let content = '';
    let isSelection = false;
    const extractionMode = this.config.extractionMode;

    try {
      const selectedText = window.getSelection().toString();
      isSelection = !!selectedText.trim();

      if (isSelection) {
        content = normalizeText(this._moderateCleanText(selectedText));
        this.logger.info('Used user-selected text as content.');
      } else {
        isSelection = false;
        if (extractionMode === 'focused') {
          this.logger.info('No user selection. Attempting FOCUSED (Readability.js) extraction.');
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
            if (article.title && article.title.trim() !== '') title = article.title;
            if (article.byline && article.byline.trim() !== '') author = article.byline;
            if ((!description || description.trim() === '') && article.excerpt && article.excerpt.trim() !== '') {
              description = this._moderateCleanText(article.excerpt);
            }
          } else {
            content = 'Could not identify sufficient main content (focused mode).';
            this.logger.warn('Readability.js returned no significant content.');
          }
        } else { // extractionMode === 'broad'
          this.logger.info('No user selection. Attempting BROAD content extraction (TreeWalker).');
          content = await this._extractBroadContentTreeWalker();
        }
      }

      return {
        pageTitle: normalizeText(title),
        pageUrl: url,
        pageDescription: normalizeText(description),
        pageAuthor: normalizeText(author),
        content: content,
        isSelection: isSelection,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
        mode: extractionMode,
      };
    } catch (error) {
      this.logger.error('Critical error during page data extraction:', error);
      return {
        pageTitle: normalizeText(title),
        pageUrl: url,
        pageDescription: normalizeText(description),
        pageAuthor: normalizeText(author),
        content: `Extraction error: ${error.message}`,
        error: true,
        message: error.message || 'Unknown error in extractData',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
        mode: extractionMode,
      };
    }
  }

  _isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
        return false;
    }
    if (element.offsetWidth > 0 || element.offsetHeight > 0) {
        return true;
    }
    const rect = element.getBoundingClientRect();
    return !!(rect.width || rect.height || element.getClientRects().length);
  }

  _isNavigationOrBoilerplate(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    if (tagName === 'nav' || role === 'navigation' || role === 'menu' || role === 'menubar' || role === 'directory' || role === 'banner' || role === 'contentinfo') {
      //this.logger.debug(`Element <${tagName}> identified as nav/boilerplate by explicit tag/role.`);
      return true;
    }
    
    const navIdsAndClasses = [
      'nav', 'menu', 'navbar', 'sidebar', 'breadcrumb', 'pagination', 'toc', 'crumbs',
      'header', 'masthead', 'main-nav', 'primary-nav', 'secondary-nav', 'top-nav', 'site-header',
      'footer', 'site-footer', 'colophon', 'legal', 'copyright', 'privacy', 'disclaimer', 'site-info',
      'skip-link', 'accessibility',
      'widget', 'aside', 'secondary', 'complementary',
      'share', 'social-links', 'social-media',
      'popup', 'modal', 'cookie-banner', 'alert', 'gdpr', 'cookie-consent',
    ];

    const id = element.id ? element.id.toLowerCase() : '';
    if (id && navIdsAndClasses.some(cls => id.includes(cls))) {
      //this.logger.debug(`Element <${tagName} id="${id}"> identified as nav/boilerplate by ID.`);
      return true;
    }

    const classList = element.classList;
    if (classList && classList.length > 0) {
      for (let i = 0; i < classList.length; i++) {
        const className = classList[i].toLowerCase();
        if (navIdsAndClasses.some(navCls => className.includes(navCls) || className === navCls)) {
          //this.logger.debug(`Element <${tagName} class="${element.className}"> identified as nav/boilerplate by class.`);
          return true;
        }
      }
    }

    if (tagName === 'div' || tagName === 'ul' || tagName === 'section' || tagName === 'header' || tagName === 'footer') {
        const links = element.querySelectorAll('a');
        if (links.length > 2) { // Adjusted threshold
            let textContentLength = 0;
            Array.from(element.childNodes).forEach(childNode => {
                if (childNode.nodeType === Node.TEXT_NODE) {
                    textContentLength += (childNode.textContent || '').trim().length;
                } else if (childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName.toLowerCase() !== 'a') {
                    textContentLength += (childNode.textContent || '').trim().length; // Include text from non-link children
                }
            });
            // If it's mostly links or links with very little surrounding non-link text
            if (textContentLength < links.length * 20 + 10) { // Adjusted heuristic
                //this.logger.debug(`Element <${tagName}> identified as nav-like by link density.`);
                return true;
            }
        }
    }
    return false;
  }
  
  _isElementOrAncestorNavOrBoilerplate(element) {
    let current = element;
    let depth = 0; // Limit ancestor check to avoid excessive checks on deep trees
    const maxDepth = 5; // Check up to 5 levels of ancestors

    while (current && current !== document.body && depth < maxDepth) {
        if (this._isNavigationOrBoilerplate(current)) {
            return true;
        }
        current = current.parentElement;
        depth++;
    }
    return false;
  }

  async _extractBroadContentTreeWalker() {
    this.logger.info('Starting _extractBroadContent (TreeWalker approach).');
    const texts = [];
    const self = this; // To access 'this' inside acceptNode

    // Tags whose direct text content is often UI noise rather than main content
    const EXCLUDED_PARENT_TAGS = new Set([
        'BUTTON', 'SELECT', 'OPTION', 'LABEL', 'LEGEND', 'TEXTAREA', 'INPUT',
        'A', // Text of links themselves can be very noisy if not part of a paragraph.
             // Navigational links should be caught by _isElementOrAncestorNavOrBoilerplate.
             // Content links might be okay, but often the surrounding text is more valuable.
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'AUDIO', 'VIDEO', 'SVG', 'CANVAS', 'OBJECT', 'EMBED'
    ]);

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) { // Use a regular function to maintain 'this' context if needed, or pass 'self'
          const parentElement = node.parentElement;
          if (!parentElement) return NodeFilter.FILTER_REJECT;

          // Rule 1: Check if parent is an excluded tag type
          if (EXCLUDED_PARENT_TAGS.has(parentElement.tagName.toUpperCase())) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Rule 2: Check for general visibility of the parent element using _isVisible
          // This is more robust than just offsetParent.
          if (!self._isVisible(parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Rule 3: Check if parent or its relevant ancestors are navigation/boilerplate
          if (self._isElementOrAncestorNavOrBoilerplate(parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Rule 4: Ensure the text node itself has meaningful content
          const textContent = node.textContent || "";
          if (textContent.trim().length < 3) { // Ignore very short text nodes (e.g., just symbols or single chars)
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode = walker.nextNode();
        while (currentNode) {
          texts.push((currentNode.textContent || "").trim());
          currentNode = walker.nextNode();
        }

    if (texts.length === 0) {
      this.logger.warn('_extractBroadContent (TreeWalker) found no text snippets.');
      // Fallback to Readability if TreeWalker fails
      return this._fallbackToReadability("TreeWalker found no text.");
    }

    // Join distinct text blocks. Using Set to remove exact duplicates before joining.
    const uniqueTexts = Array.from(new Set(texts));
    let broadText = uniqueTexts.join('\n\n'); // Join with double newlines for better structure
    
    broadText = this._moderateCleanText(broadText);
    const normalizedBroadText = normalizeText(broadText);

    if (normalizedBroadText.length < MIN_BROAD_TEXT_LENGTH) {
        this.logger.warn(`_extractBroadContent (TreeWalker) resulted in very little text: ${normalizedBroadText.length} chars.`);
        return this._fallbackToReadability("TreeWalker resulted in insufficient text.");
    }

    this.logger.info(`_extractBroadContent (TreeWalker) extracted normalized text length: ${normalizedBroadText.length} chars.`);
    return normalizedBroadText;
  }

  async _fallbackToReadability(reason) {
      this.logger.info(`Fallback triggered: ${reason}. Attempting Readability.`);
      const readabilityOptions = { charThreshold: 50, nbTopCandidates: 5 }; // More lenient for fallback
      const originalDocClone = document.cloneNode(true);
      const reader = new Readability(originalDocClone, readabilityOptions);
      const article = reader.parse();
      if (article && article.textContent && article.textContent.trim().length >= MIN_BROAD_TEXT_LENGTH) {
        this.logger.info(`Fallback to Readability successful. Length: ${article.textContent.trim().length}`);
        return normalizeText(this._moderateCleanText(article.textContent));
      }
      this.logger.warn('Fallback to Readability also yielded insufficient content.');
      return 'Could not identify sufficient broad content.';
  }


  extractPageTitle() {
    return document.title ? document.title.trim() : 'Unknown Title';
  }

  extractPageUrl() {
    return window.location.href;
  }

  extractMetaDescription() {
    const metaElement = document.querySelector('meta[name="description"]');
    if (metaElement && metaElement.getAttribute('content')) {
      return metaElement.getAttribute('content').trim();
    }
    return null;
  }

  extractAuthor() {
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]',
    ];
    for (const selector of metaSelectors) {
      const metaElement = document.querySelector(selector);
      if (metaElement && metaElement.getAttribute('content')) {
        const authorText = metaElement.getAttribute('content').trim();
        if (authorText) return authorText;
      }
    }
    return null;
  }
}

export default GeneralExtractorStrategy;