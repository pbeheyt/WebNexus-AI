// src/extractor/strategies/pdf-strategy.js
const BaseExtractor = require('../base-extractor');
// Import pdf.js library
const pdfjsLib = require('pdfjs-dist');
// Set worker source path - make sure the path is correct
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('dist/pdf.worker.bundle.js');

class PdfExtractorStrategy extends BaseExtractor {
  constructor() {
    super('pdf');
  }

  /**
   * Extract and save PDF data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting PDF data extraction...');
      
      // Extract all PDF data
      const pdfData = await this.extractData();
      
      // Save to Chrome storage
      await this.saveToStorage(pdfData);
    } catch (error) {
      this.logger.error('Error in PDF content extraction:', error);
      
      // Save error message to storage
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        diagnostics: this.gatherDiagnostics(error)
      });
    }
  }

  /**
   * Gather diagnostic information for troubleshooting
   * @param {Error} error - The error that occurred
   * @returns {Object} - Diagnostic information
   */
  gatherDiagnostics(error) {
    return {
      pdfUrl: window.location.href,
      viewerType: this.isChromePdfViewer() ? 'chrome-native' : 
                 this.isPdfJs() ? 'pdf-js' : 'unknown',
      domAccessible: !!document.querySelector('.textLayer, .text-layer'),
      shadowDomPresent: !!document.querySelector('embed[type="application/pdf"]')?.shadowRoot,
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
      errorMessage: error?.message || 'Unknown error occurred',
      stackTrace: error?.stack,
      browserInfo: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract PDF data
   * @returns {Object} The extracted PDF data
   */
  async extractData() {
    try {
      // Get title from document or viewer
      const title = this.extractPdfTitle();
      const url = window.location.href;
      
      // Extract the PDF content based on the viewer type
      const { content, pageCount, isSearchable } = await this.extractPdfContent();
      
      // Extract metadata if available
      const metadata = await this.extractPdfMetadata(pageCount);
      
      // Return the complete PDF data object
      return {
        pdfTitle: title,
        pdfUrl: url,
        content: content,
        metadata: metadata,
        pageCount: pageCount || metadata.pageCount || 'Unknown',
        extractedAt: new Date().toISOString(),
        ocrRequired: !isSearchable,
        extractionNotes: !isSearchable ? 
          'This PDF appears to be image-based. OCR might be needed for better text extraction.' : null
      };
    } catch (error) {
      this.logger.error('Error extracting PDF data:', error);
      
      // Enhanced diagnostic information
      const diagnostics = this.gatherDiagnostics(error);
      
      // Return what we could get, with error message and diagnostics
      return {
        pdfTitle: this.extractPdfTitle() || 'Unknown PDF',
        pdfUrl: window.location.href,
        content: 'Error extracting content. See diagnostic information.',
        error: true,
        message: error.message || 'Unknown error occurred',
        diagnostics: diagnostics,
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract the PDF title
   * @returns {string} The PDF title
   */
  extractPdfTitle() {
    // Try to get from document title
    const documentTitle = document.title;
    if (documentTitle && !documentTitle.includes('PDF viewer')) {
      return documentTitle.replace('.pdf', '').trim();
    }
    
    // Try Chrome's PDF viewer specific elements
    const titleElement = document.querySelector('#toolbar #file-name');
    if (titleElement) {
      return titleElement.textContent.trim();
    }
    
    // Try other common PDF viewer elements
    const viewerTitle = document.querySelector('.pdf-title, .document-title, .filename');
    if (viewerTitle) {
      return viewerTitle.textContent.trim();
    }
    
    // Fall back to filename from URL
    const urlParts = window.location.pathname.split('/');
    const fileName = urlParts[urlParts.length - 1];
    if (fileName.endsWith('.pdf')) {
      return fileName.replace('.pdf', '');
    }
    
    return 'Unknown PDF Document';
  }

  /**
   * Extract PDF metadata
   * @param {number} knownPageCount - Page count if already known
   * @returns {Object} PDF metadata
   */
  async extractPdfMetadata(knownPageCount = null) {
    const metadata = {
      author: null,
      creationDate: null,
      pageCount: knownPageCount,
      title: null,
      keywords: null,
      subject: null,
      producer: null
    };
    
    // Try direct PDF access first
    try {
      if (!knownPageCount) {
        const pdfUrl = window.location.href;
        
        // Use a timeout to prevent hanging on large PDFs
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF metadata extraction timeout')), 5000)
        );
        
        const fetchPromise = async () => {
          const response = await fetch(pdfUrl, { credentials: 'include' });
          
          // Check if fetch was successful
          if (response.ok) {
            const pdfData = await response.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({
              data: pdfData,
              cMapUrl: chrome.runtime.getURL('dist/cmaps/'),
              cMapPacked: true,
              disableFontFace: false
            });
            const pdf = await loadingTask.promise;
            
            metadata.pageCount = pdf.numPages;
            
            // Get document info if available
            const info = await pdf.getMetadata();
            if (info && info.info) {
              metadata.author = info.info.Author || null;
              metadata.creationDate = info.info.CreationDate || null;
              metadata.title = info.info.Title || null;
              metadata.keywords = info.info.Keywords || null;
              metadata.subject = info.info.Subject || null;
              metadata.producer = info.info.Producer || null;
            }
          }
        };
        
        // Try with timeout to prevent hanging
        await Promise.race([fetchPromise(), timeoutPromise]);
      }
    } catch (error) {
      this.logger.warn('Error accessing PDF directly for metadata:', error);
      // Continue with DOM-based extraction fallbacks
    }
    
    // If page count is still missing, try UI elements
    if (!metadata.pageCount) {
      const pageCountIndicators = [
        // Chrome's PDF viewer
        '#pageNumber[max]',
        '#numPages',
        '.page-count',
        // Generic PDF viewers
        '[data-page-count]',
        '[data-total-pages]',
        '.total-pages'
      ];
      
      for (const selector of pageCountIndicators) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.getAttribute('max')) {
            metadata.pageCount = parseInt(element.getAttribute('max'), 10);
            break;
          } else if (element.textContent) {
            const match = element.textContent.match(/(\d+)/);
            if (match) {
              metadata.pageCount = parseInt(match[1], 10);
              break;
            }
          } else if (element.getAttribute('data-page-count')) {
            metadata.pageCount = parseInt(element.getAttribute('data-page-count'), 10);
            break;
          } else if (element.getAttribute('data-total-pages')) {
            metadata.pageCount = parseInt(element.getAttribute('data-total-pages'), 10);
            break;
          }
        }
      }
    }
    
    // Try PDF.js metadata if available
    if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
      try {
        const pdfDoc = window.PDFViewerApplication.pdfDocument;
        if (!metadata.pageCount) {
          metadata.pageCount = pdfDoc.numPages;
        }
        
        // Get document metadata if available
        try {
          const data = await pdfDoc.getMetadata();
          if (data.info) {
            metadata.author = metadata.author || data.info.Author || null;
            metadata.creationDate = metadata.creationDate || data.info.CreationDate || null;
            metadata.title = metadata.title || data.info.Title || null;
            metadata.keywords = metadata.keywords || data.info.Keywords || null;
            metadata.subject = metadata.subject || data.info.Subject || null;
            metadata.producer = metadata.producer || data.info.Producer || null;
          }
        } catch (err) {
          this.logger.warn('Failed to get PDF metadata:', err);
        }
      } catch (e) {
        this.logger.warn('Error accessing PDF.js metadata:', e);
      }
    }
    
    return metadata;
  }

  /**
   * Extract content from the PDF
   * @returns {Object} Extracted PDF content with additional information
   */
  async extractPdfContent() {
    // Track extraction result info
    let content = '';
    let pageCount = null;
    let isSearchable = false;

    // Try direct PDF parsing first
    try {
      const directResult = await this.extractWithDirectParsing();
      
      if (directResult.content && directResult.content.trim().length > 100) {  // Content seems meaningful
        return {
          content: directResult.content,
          pageCount: directResult.pageCount,
          isSearchable: directResult.isSearchable
        };
      } else {
        this.logger.info('Direct parsing returned insufficient content, trying alternative methods');
      }
    } catch (error) {
      this.logger.warn('Direct PDF parsing failed:', error.message);
      // Fall back to viewer-based extraction
    }
    
    // Try extraction based on current viewer
    try {
      if (this.isChromePdfViewer()) {
        this.logger.info('Detected Chrome PDF viewer, using appropriate extraction method');
        const chromeResult = await this.extractFromChromePdfViewer();
        content = chromeResult.content;
        pageCount = chromeResult.pageCount;
        isSearchable = chromeResult.isSearchable;
      } else if (this.isPdfJs()) {
        this.logger.info('Detected PDF.js viewer, using appropriate extraction method');
        const pdfJsResult = await this.extractFromPdfJs();
        content = pdfJsResult.content;
        pageCount = pdfJsResult.pageCount;
        isSearchable = pdfJsResult.isSearchable;
      } else {
        this.logger.info('Using generic PDF content extraction method');
        const genericResult = await this.extractGenericPdfContent();
        content = genericResult.content;
        pageCount = genericResult.pageCount;
        isSearchable = genericResult.isSearchable;
      }
    } catch (error) {
      this.logger.error('Viewer-based extraction failed:', error.message);
      content = `Error during content extraction: ${error.message}`;
      isSearchable = false;
    }
    
    // Check for meaningful content
    if (!content || content.trim().length < 100 || 
        content.includes("not successful") || 
        content.includes("Unable to extract")) {
      this.logger.warn('Extracted content appears to be low quality or missing');
      isSearchable = false;
    }
    
    return { 
      content, 
      pageCount, 
      isSearchable 
    };
  }

  /**
   * Extract PDF content using direct parsing with pdf.js
   * @returns {Object} Extraction result with content, page count, and searchability status
   */
  async extractWithDirectParsing() {
    const pdfUrl = window.location.href;
    
    try {
      this.logger.info('Starting direct PDF parsing');
      
      // Try to fetch the PDF directly
      const response = await fetch(pdfUrl, { 
        credentials: 'include',
        cache: 'no-store'
      });
      
      // Check if fetch was successful
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const pdfData = await response.arrayBuffer();
      
      // Use pdf.js library for direct parsing with enhanced options
      const loadingTask = pdfjsLib.getDocument({
        data: pdfData,
        cMapUrl: chrome.runtime.getURL('dist/cmaps/'),
        cMapPacked: true,
        disableFontFace: false
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';
      let textContentLength = 0;
      const pageCount = pdf.numPages;
      
      this.logger.info(`PDF loaded with ${pageCount} pages`);
      
      // Extract text from each page
      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false
          });
          
          // Check if text content is meaningful
          if (textContent.items && textContent.items.length > 0) {
            textContentLength += textContent.items.length;
            
            // Process text with better handling of positioning and layout
            let lastY;
            let text = '';
            
            for (const item of textContent.items) {
              // Add newlines when Y position changes significantly
              if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 5) {
                text += '\n';
              }
              
              text += item.str + ' ';
              lastY = item.transform[5];
            }
            
            fullText += `\n--- Page ${i} ---\n\n${text.trim()}\n\n`;
          } else {
            fullText += `\n--- Page ${i} ---\n\n[No text content found on this page]\n\n`;
          }
        } catch (pageError) {
          this.logger.warn(`Error extracting text from page ${i}:`, pageError);
          fullText += `\n--- Page ${i} ---\n\n[Error extracting text: ${pageError.message}]\n\n`;
        }
      }
      
      // Determine if PDF appears to be searchable based on text content
      const isSearchable = textContentLength > (pageCount * 5); // Heuristic: average > 5 text elements per page
      
      this.logger.info(`Direct parsing complete. Text elements: ${textContentLength}, Searchable: ${isSearchable}`);
      
      return {
        content: fullText.trim(),
        pageCount: pageCount,
        isSearchable: isSearchable
      };
    } catch (error) {
      this.logger.warn('Direct PDF parsing failed:', error);
      throw error;  // Rethrow for handling by caller
    }
  }

  /**
   * Check if we're in Chrome's built-in PDF viewer
   * @returns {boolean} True if in Chrome PDF viewer
   */
  isChromePdfViewer() {
    return !!document.querySelector('embed[type="application/pdf"]') || 
           !!document.querySelector('#toolbar #viewFind') ||
           document.body.classList.contains('chrome-pdf-viewer');
  }

  /**
   * Check if we're using PDF.js viewer
   * @returns {boolean} True if using PDF.js
   */
  isPdfJs() {
    return !!document.querySelector('.pdfViewer') || 
           !!window.PDFViewerApplication;
  }

  /**
   * Extract content from Chrome's built-in PDF viewer
   * @returns {Object} Extraction result with content, page count, and searchability status
   */
  async extractFromChromePdfViewer() {
    let content = '';
    let pageCount = 0;
    let isSearchable = false;
    let textLayersFound = 0;
    
    // First try Shadow DOM extraction which works best for Chrome's PDF viewer
    try {
      const shadowResult = this.extractFromShadowDOM(document.documentElement);
      if (shadowResult.content && shadowResult.content.trim().length > 100) {
        this.logger.info('Successfully extracted content from Shadow DOM');
        return {
          content: shadowResult.content,
          pageCount: shadowResult.pageCount,
          isSearchable: shadowResult.textLayersFound > 0
        };
      }
    } catch (error) {
      this.logger.warn('Shadow DOM extraction error:', error.message);
    }
    
    // Method 1: Try to access text layers directly
    const textLayers = document.querySelectorAll('.textLayer, .text-layer');
    if (textLayers && textLayers.length > 0) {
      textLayersFound = textLayers.length;
      pageCount = textLayers.length;
      isSearchable = true;
      
      let pageTexts = [];
      
      textLayers.forEach((layer, index) => {
        const pageNumber = index + 1;
        const pageText = layer.innerText || layer.textContent;
        
        if (pageText && pageText.trim().length > 0) {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n${pageText.trim()}`);
        } else {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n[No text content found]`);
        }
      });
      
      content = pageTexts.join('\n\n');
      
      if (content.trim()) {
        this.logger.info(`Extracted content from ${textLayersFound} text layers`);
        return { content, pageCount, isSearchable };
      }
    }
    
    // Method 2: Access page containers
    const pageContainers = document.querySelectorAll('.page');
    if (pageContainers && pageContainers.length > 0) {
      pageCount = pageContainers.length;
      let pageTexts = [];
      let textContent = false;
      
      pageContainers.forEach((page, index) => {
        const pageNumber = index + 1;
        const pageText = page.innerText || page.textContent;
        
        // Skip pages that only contain a page number
        if (pageText && !pageText.match(/^\s*\d+\s*$/)) {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n${pageText.trim()}`);
          textContent = true;
        } else {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n[No text content found]`);
        }
      });
      
      if (textContent) {
        content = pageTexts.join('\n\n');
        isSearchable = true;
      }
      
      if (content.trim()) {
        this.logger.info(`Extracted content from ${pageCount} page containers`);
        return { content, pageCount, isSearchable };
      }
    }
    
    // If extraction failed, provide diagnostic content
    return {
      content: "PDF content extraction from Chrome's built-in viewer was not successful. " +
               "The PDF may be image-based or have restricted permissions.",
      pageCount: pageCount || null,
      isSearchable: false
    };
  }

  /**
   * Extract content from PDF.js viewer
   * @returns {Object} Extraction result with content, page count, and searchability status
   */
  async extractFromPdfJs() {
    let content = '';
    let pageCount = 0;
    let isSearchable = false;
    
    // Try to use PDF.js API if available
    if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
      try {
        const pdfDocument = window.PDFViewerApplication.pdfDocument;
        pageCount = pdfDocument.numPages;
        this.logger.info('PDF.js document detected with', pageCount, 'pages');
        
        let pageTexts = [];
        let textContentFound = false;
        
        // Extract text from all pages
        for (let i = 1; i <= pageCount; i++) {
          try {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            
            if (textContent.items && textContent.items.length > 0) {
              textContentFound = true;
              
              // Process text content with better whitespace handling
              let lastY;
              let text = '';
              
              for (const item of textContent.items) {
                // Add newlines when Y position changes significantly
                if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 5) {
                  text += '\n';
                }
                
                text += item.str + ' ';
                lastY = item.transform[5];
              }
              
              pageTexts.push(`--- Page ${i} ---\n\n${text.trim()}`);
            } else {
              pageTexts.push(`--- Page ${i} ---\n\n[No text content found]`);
            }
          } catch (pageError) {
            this.logger.warn(`Error extracting text from page ${i}:`, pageError);
            pageTexts.push(`--- Page ${i} ---\n\n[Error extracting text: ${pageError.message}]`);
          }
        }
        
        content = pageTexts.join('\n\n');
        isSearchable = textContentFound;
        
        if (content.trim()) {
          this.logger.info('Successfully extracted content using PDF.js API');
          return { content, pageCount, isSearchable };
        }
      } catch (error) {
        this.logger.error('Error accessing PDF.js API:', error);
      }
    }
    
    // Fall back to DOM-based extraction if API approach failed
    
    // PDF.js puts text in divs with class 'textLayer'
    const textLayers = document.querySelectorAll('.textLayer');
    if (textLayers.length > 0) {
      pageCount = textLayers.length;
      let pageTexts = [];
      
      textLayers.forEach((layer, index) => {
        const pageNumber = index + 1;
        const pageText = layer.innerText || layer.textContent;
        
        if (pageText && pageText.trim().length > 0) {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n${pageText.trim()}`);
        } else {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n[No text content found]`);
        }
      });
      
      content = pageTexts.join('\n\n');
      isSearchable = true;
      
      if (content.trim()) {
        this.logger.info(`Extracted content from ${pageCount} text layers`);
        return { content, pageCount, isSearchable };
      }
    }
    
    // If no text layers found, look for text spans
    const textSpans = document.querySelectorAll('.textLayer span');
    if (textSpans.length > 0) {
      isSearchable = true;
      
      // Group spans by their closest page container
      const pageMap = new Map();
      
      textSpans.forEach(span => {
        const pageElement = span.closest('.page');
        if (pageElement) {
          const pageNumber = pageElement.getAttribute('data-page-number') || 
                            Array.from(document.querySelectorAll('.page')).indexOf(pageElement) + 1;
          
          if (!pageMap.has(pageNumber)) {
            pageMap.set(pageNumber, []);
          }
          
          pageMap.get(pageNumber).push(span.textContent);
        } else {
          // If no page container found, add to general content
          if (!pageMap.has('unknown')) {
            pageMap.set('unknown', []);
          }
          
          pageMap.get('unknown').push(span.textContent);
        }
      });
      
      // Convert page map to content
      const pageTexts = [];
      
      for (const [pageNumber, texts] of pageMap.entries()) {
        if (pageNumber === 'unknown') {
          content += texts.join(' ');
        } else {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n${texts.join(' ').trim()}`);
        }
      }
      
      if (pageTexts.length > 0) {
        pageCount = pageTexts.length;
        content = pageTexts.join('\n\n');
      }
      
      if (content.trim()) {
        this.logger.info(`Extracted content from ${textSpans.length} text spans across ${pageCount} pages`);
        return { content, pageCount, isSearchable };
      }
    }
    
    // If still no content, try page containers
    const pageContainers = document.querySelectorAll('.page');
    if (pageContainers.length > 0) {
      pageCount = pageContainers.length;
      let pageTexts = [];
      let textContent = false;
      
      pageContainers.forEach((page, index) => {
        const pageNumber = page.getAttribute('data-page-number') || (index + 1);
        const pageText = page.innerText || page.textContent;
        
        // Skip pages that only contain a page number
        if (pageText && !pageText.match(/^\s*\d+\s*$/)) {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n${pageText.trim()}`);
          textContent = true;
        } else {
          pageTexts.push(`--- Page ${pageNumber} ---\n\n[No text content found]`);
        }
      });
      
      if (textContent) {
        content = pageTexts.join('\n\n');
        isSearchable = true;
      }
      
      if (content.trim()) {
        this.logger.info(`Extracted content from ${pageCount} page containers`);
        return { content, pageCount, isSearchable };
      }
    }
    
    return {
      content: "PDF content extraction from PDF.js viewer was not successful. " +
               "The PDF may be image-based or have restricted permissions.",
      pageCount: pageCount || null,
      isSearchable: false
    };
  }

  /**
   * Extract content from Shadow DOM
   * @param {Node} rootNode - The root node to start traversal from
   * @returns {Object} Extraction result with content, page count, and number of text layers found
   */
  extractFromShadowDOM(rootNode) {
    let content = '';
    let pageCount = 0;
    let textLayersFound = 0;
    let pageTexts = new Map();
    
    // Process shadow roots recursively
    const processNode = (node) => {
      // Check if the node has a shadow root
      if (node.shadowRoot) {
        // Find text layers in the shadow root
        const textLayers = node.shadowRoot.querySelectorAll('.textLayer, .text-layer');
        
        if (textLayers.length > 0) {
          textLayersFound += textLayers.length;
          
          // Process each text layer
          textLayers.forEach((layer) => {
            // Try to find page number from closest container
            let pageNumber = null;
            let pageContainer = layer.closest('.page') || layer.parentElement;
            
            if (pageContainer) {
              // Try to get page number from data attribute
              pageNumber = pageContainer.getAttribute('data-page-number');
              
              // If no data attribute, use position in document
              if (!pageNumber && pageContainer.parentElement) {
                const siblings = Array.from(pageContainer.parentElement.children);
                pageNumber = siblings.indexOf(pageContainer) + 1;
              }
            }
            
            if (!pageNumber) {
              // If still no page number, generate one
              pageNumber = pageTexts.size + 1;
            }
            
            pageTexts.set(pageNumber, layer.innerText || layer.textContent);
          });
        }
        
        // Look for page containers inside shadow DOM
        const pageContainers = node.shadowRoot.querySelectorAll('.page');
        if (pageContainers.length > 0 && !textLayers.length) {
          pageContainers.forEach((page, index) => {
            const pageNumber = page.getAttribute('data-page-number') || (index + 1);
            const pageText = page.innerText || page.textContent;
            
            // Skip pages that only contain a page number
            if (pageText && !pageText.match(/^\s*\d+\s*$/)) {
              pageTexts.set(pageNumber, pageText);
            }
          });
        }
        
        // Process all elements in the shadow DOM
        node.shadowRoot.querySelectorAll('*').forEach(processNode);
      }
      
      // Process child elements that might have their own shadow roots
      if (node.children) {
        Array.from(node.children).forEach(processNode);
      }
    };
    
    processNode(rootNode);
    
    // Convert page texts to content string
    if (pageTexts.size > 0) {
      pageCount = pageTexts.size;
      
      // Sort by page number
      const sortedPages = Array.from(pageTexts.entries()).sort((a, b) => {
        // Convert to numbers for numerical sorting
        const aNum = parseInt(a[0], 10) || 0;
        const bNum = parseInt(b[0], 10) || 0;
        return aNum - bNum;
      });
      
      // Build content string
      const pageContents = sortedPages.map(([pageNumber, text]) => {
        return `--- Page ${pageNumber} ---\n\n${text.trim()}`;
      });
      
      content = pageContents.join('\n\n');
    }
    
    return { 
      content: content.trim(),
      pageCount,
      textLayersFound
    };
  }

  /**
   * Generic approach to extract PDF content
   * @returns {Object} Extraction result with content, page count, and searchability status
   */
  async extractGenericPdfContent() {
    let content = '';
    let pageCount = 0;
    let isSearchable = false;
    
    // Try various selectors that might contain PDF text
    const selectors = [
      '.textLayer', '.text-layer', '.pdf-text',
      '.pdf-content', '#viewerContainer', 
      'embed[type="application/pdf"]',
      'iframe[src*=".pdf"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        pageCount = elements.length;
        let elementContent = '';
        
        elements.forEach((el, index) => {
          const pageNumber = index + 1;
          const text = el.innerText || el.textContent || '';
          
          if (text.trim()) {
            elementContent += `--- Page ${pageNumber} ---\n\n${text.trim()}\n\n`;
          }
        });
        
        if (elementContent.trim()) {
          content = elementContent.trim();
          isSearchable = true;
          break;
        }
      }
    }
    
    // If still no content, try to find and extract all visible text nodes
    if (!content) {
      const textNodeResult = this.extractVisibleTextNodes();
      content = textNodeResult.content;
      isSearchable = textNodeResult.isSearchable;
    }
    
    // If all else fails, try to get all text from the document
    if (!content) {
      const bodyText = document.body.innerText;
      if (bodyText && bodyText.trim().length > 100) {
        // Try to clean up by removing common UI element text
        content = bodyText
          .replace(/Page \d+ of \d+/g, '')
          .replace(/\d+%/g, '')
          .replace(/Zoom In|Zoom Out|Fit Page|Fit Width/g, '')
          .trim();
        
        isSearchable = true;
      }
    }
    
    return {
      content: content || "Unable to extract PDF content. The PDF may be image-based, have restricted permissions, or is displayed in an unsupported viewer.",
      pageCount: pageCount || null,
      isSearchable: isSearchable
    };
  }
  
  /**
   * Extract visible text nodes that might contain PDF content
   * @returns {Object} Extraction result with content and searchability status
   */
  extractVisibleTextNodes() {
    const visibleTextNodes = [];
    
    // Recursively find text nodes
    function findTextNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text.length > 0) {
          visibleTextNodes.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip script, style, and hidden elements
        const style = window.getComputedStyle(node);
        const tagName = node.tagName.toLowerCase();
        
        if (tagName !== 'script' && 
            tagName !== 'style' && 
            style.display !== 'none' && 
            style.visibility !== 'hidden') {
          
          // Skip UI elements in common PDF viewers
          if (!['toolbar', 'searchbar', 'menu', 'button', 'navigation'].some(cls => 
                node.className && node.className.includes(cls))) {
            
            // Process child nodes
            for (let i = 0; i < node.childNodes.length; i++) {
              findTextNodes(node.childNodes[i]);
            }
          }
        }
      }
    }
    
    // Start from document body
    findTextNodes(document.body);
    
    // Combine text nodes into paragraphs
    if (visibleTextNodes.length > 0) {
      // Group consecutive short text nodes that might be sentences in a paragraph
      let result = '';
      let currentParagraph = '';
      
      for (let i = 0; i < visibleTextNodes.length; i++) {
        const text = visibleTextNodes[i];
        
        // If text ends with sentence-ending punctuation or is longer (likely a paragraph)
        if (text.match(/[.!?]$/) || text.length > 100) {
          currentParagraph += text + ' ';
          result += currentParagraph.trim() + '\n\n';
          currentParagraph = '';
        } else {
          currentParagraph += text + ' ';
        }
      }
      
      // Add any remaining text
      if (currentParagraph.trim()) {
        result += currentParagraph.trim();
      }
      
      return {
        content: result.trim(),
        isSearchable: visibleTextNodes.length > 20  // Heuristic for searchable content
      };
    }
    
    return {
      content: '',
      isSearchable: false
    };
  }
}

module.exports = PdfExtractorStrategy;