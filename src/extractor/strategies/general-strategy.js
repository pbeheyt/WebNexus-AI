import { Readability } from '@mozilla/readability';

import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

const MIN_BROAD_TEXT_LENGTH = 15; // Minimum characters for the entire extracted broad text to be considered useful.

class GeneralExtractorStrategy extends BaseExtractor {
  constructor(config = {}) {
    super('general');
    this.config = { extractionMode: config.extractionMode };
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
        content: content, // Content is already normalized by its respective extraction method
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
      return true;
    }

    const classList = element.classList;
    if (classList && classList.length > 0) {
      for (let i = 0; i < classList.length; i++) {
        const className = classList[i].toLowerCase();
        if (navIdsAndClasses.some(navCls => className.includes(navCls) || className === navCls)) {
          return true;
        }
      }
    }

    if (tagName === 'div' || tagName === 'ul' || tagName === 'section' || tagName === 'header' || tagName === 'footer') {
        const links = element.querySelectorAll('a');
        if (links.length > 2) { 
            let textContentLength = 0;
            Array.from(element.childNodes).forEach(childNode => {
                if (childNode.nodeType === Node.TEXT_NODE) {
                    textContentLength += (childNode.textContent || '').trim().length;
                } else if (childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName.toLowerCase() !== 'a') {
                    textContentLength += (childNode.textContent || '').trim().length;
                }
            });
            if (textContentLength < links.length * 20 + 10) { 
                return true;
            }
        }
    }
    return false;
  }
  
  _isElementOrAncestorNavOrBoilerplate(element) {
    let current = element;
    let depth = 0; 
    const maxDepth = 5; 

    while (current && current !== document.body && depth < maxDepth) {
        if (this._isNavigationOrBoilerplate(current)) {
            return true;
        }
        current = current.parentElement;
        depth++;
    }
    return false;
  }

  _determineSeparator(prevTextNode, currTextNode) {
    const blockTagNames = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'ARTICLE', 'SECTION', 'ASIDE', 'HEADER', 'FOOTER', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'UL', 'OL', 'DL', 'DD', 'DT', 'FIELDSET', 'FORM', 'ADDRESS']);

    const prevParent = prevTextNode.parentElement;
    const currParent = currTextNode.parentElement;

    if (!prevParent || !currParent) {
        return '\n'; // Safety net, should ideally not be hit
    }

    // Case 1: Same parent element
    if (prevParent === currParent) {
        let sibling = prevTextNode.nextSibling;
        while (sibling && sibling !== currTextNode) {
            if (sibling.nodeName === 'BR') {
                return '\n'; // Explicit line break
            }
            // If a significant block element is found between text nodes *within the same parent*
            if (sibling.nodeType === Node.ELEMENT_NODE && blockTagNames.has(sibling.nodeName.toUpperCase())) {
                 return '\n';
            }
            sibling = sibling.nextSibling;
        }
        // Default for same parent, no BR or intervening block: a space
        return ' '; 
    }

    // Case 2: Different parent elements

    // If current text node is inside a list item, it's likely a new line.
    if (currParent.nodeName === 'LI') {
         return '\n';
    }
    // If previous text node was inside a list item and current is not, or vice-versa, likely newline.
    if (prevParent.nodeName === 'LI' && currParent.nodeName !== 'LI') {
        return '\n';
    }


    // Heuristic: If either parent is a known block-level tag, assume a new paragraph.
    if (blockTagNames.has(prevParent.nodeName.toUpperCase()) || blockTagNames.has(currParent.nodeName.toUpperCase())) {
        return '\n';
    }
    
    // More advanced: check computed display style if not a known block tag
    // This can be expensive if called too often, but might be necessary for complex layouts.
    const prevDisplay = window.getComputedStyle(prevParent).display;
    const currDisplay = window.getComputedStyle(currParent).display;

    if (prevDisplay === 'block' || currDisplay === 'block' || prevDisplay === 'list-item' || currDisplay === 'list-item') {
        return '\n';
    }
    
    // Check if the current node's parent is a direct sibling of the previous node's parent,
    // and if there was a BR between those parents.
    // This handles cases like <p>text1</p><br><p>text2</p>
    if (prevParent.nextElementSibling === currParent && prevParent.nextSibling && prevParent.nextSibling.nodeName === 'BR') {
        return '\n';
    }
    if (prevParent.nextSibling && prevParent.nextSibling.nodeName === 'BR' && prevParent.nextSibling.nextSibling === currParent) {
        return '\n';
    }


    // Default for different parents that are not clearly block-level or list items:
    // Prefer a space to avoid over-splitting if they are conceptually part of the same flow
    // (e.g., text split across multiple inline spans in different divs that are themselves inline-block).
    // `normalizeText` will later handle sequences of spaces.
    return ' ';
  }


  async _extractBroadContentTreeWalker() {
    this.logger.info('Starting _extractBroadContent (TreeWalker approach).');
    const textNodes = [];
    const self = this; 

    const EXCLUDED_PARENT_TAGS = new Set([
        'BUTTON', 'SELECT', 'OPTION', 'LABEL', 'LEGEND', 'TEXTAREA', 'INPUT',
        'A', 
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'AUDIO', 'VIDEO', 'SVG', 'CANVAS', 'OBJECT', 'EMBED'
    ]);

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) { 
          const parentElement = node.parentElement;
          if (!parentElement) return NodeFilter.FILTER_REJECT;

          if (EXCLUDED_PARENT_TAGS.has(parentElement.tagName.toUpperCase())) {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (!self._isVisible(parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (self._isElementOrAncestorNavOrBoilerplate(parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const textContent = node.textContent || "";
          if (textContent.trim().length < 3) { 
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    if (textNodes.length === 0) {
      this.logger.warn('_extractBroadContent (TreeWalker) found no text nodes.');
      return this._fallbackToReadability("TreeWalker found no text nodes.");
    }

    let broadText = '';
    let previousTextNode = null;

    for (const currentTextNode of textNodes) {
        const currentText = (currentTextNode.textContent || ""); // Keep internal spaces for now
        
        // Trim only for the check, use untrimmed for concatenation if it's to be joined by space
        if (!currentText.trim()) { 
            continue; 
        }

        if (previousTextNode === null) {
            broadText = currentText.trimStart(); // Trim start of the very first piece
        } else {
            const separator = this._determineSeparator(previousTextNode, currentTextNode);
            if (separator === '\n') {
                broadText = broadText.trimEnd(); // Trim trailing space before a newline
                broadText += separator + currentText.trimStart(); // Trim leading space after a newline
            } else { // separator is ' '
                 // Only add a space if broadText doesn't already end with one
                 // and currentText doesn't start with one (after its own internal trim for this piece)
                if (broadText.length > 0 && !broadText.endsWith(' ') && currentText.length > 0 && !currentText.startsWith(' ')) {
                    broadText += separator;
                }
                broadText += currentText;
            }
        }
        previousTextNode = currentTextNode;
    }
    
    // Final cleanup and normalization
    broadText = this._moderateCleanText(broadText); // Applies further space normalization and overall trim
    const normalizedBroadText = normalizeText(broadText); // Collapses multiple newlines

    if (normalizedBroadText.length < MIN_BROAD_TEXT_LENGTH) {
        this.logger.warn(`_extractBroadContent (TreeWalker) resulted in very little text: ${normalizedBroadText.length} chars.`);
        return this._fallbackToReadability("TreeWalker resulted in insufficient text.");
    }

    this.logger.info(`_extractBroadContent (TreeWalker) extracted normalized text length: ${normalizedBroadText.length} chars.`);
    return normalizedBroadText;
  }

  async _fallbackToReadability(reason) {
      this.logger.info(`Fallback triggered: ${reason}. Attempting Readability.`);
      const readabilityOptions = { charThreshold: 50, nbTopCandidates: 5 }; 
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
