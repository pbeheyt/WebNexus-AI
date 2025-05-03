// src/extractor/strategies/pdf-strategy.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

import BaseExtractor from '../base-extractor.js';

// Helper to convert Base64 to ArrayBuffer
function _base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Set worker source path - make sure webpack is configured to handle this
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  'dist/pdf.worker.bundle.js'
);

class PdfExtractorStrategy extends BaseExtractor {
  constructor() {
    super('pdf');
  }

  /**
   * Extract and save PDF content to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      const pdfData = await this.extractPdfContent();
      await this.saveToStorage(pdfData);
    } catch (error) {
      this.logger.error('PDF extraction error:', error);
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Extract content directly from PDF document
   * @returns {Object} Extracted PDF data
   */
  async extractPdfContent() {
    const pdfUrl = window.location.href;
    let pdfDataArrayBuffer;

    try {
      if (pdfUrl.startsWith('file://')) {
        // === Fetch via Background Script for file:// URLs ===
        this.logger.info(`Requesting PDF fetch from background for: ${pdfUrl}`);
        const response = await chrome.runtime.sendMessage({
          action: 'fetchPdfAsBase64',
          url: pdfUrl,
        });

        if (response && response.success) {
          this.logger.info('Received Base64 PDF data from background. Decoding...');
          pdfDataArrayBuffer = _base64ToArrayBuffer(response.base64Data);
          this.logger.info('Successfully decoded Base64 PDF data.');
        } else {
          throw new Error(response?.error || 'Failed to fetch PDF data from background script.');
        }
      } else {
        // === Direct Fetch for http/https URLs ===
        this.logger.info(`Fetching PDF directly (non-file URL): ${pdfUrl}`);
        const response = await fetch(pdfUrl, {
          credentials: 'omit', // Use omit for non-file URLs unless specifically needed
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        pdfDataArrayBuffer = await response.arrayBuffer();
        this.logger.info('Successfully fetched PDF data directly.');
      }

      // === Common PDF Parsing Logic ===
      this.logger.info('Loading PDF document with pdfjsLib...');
      const loadingTask = pdfjsLib.getDocument({ data: pdfDataArrayBuffer }); // Use the obtained ArrayBuffer

      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;

      // Extract basic metadata
      const metadata = await this.extractBasicMetadata(pdf);

      // Extract text content from each page
      let fullText = '';
      let isSearchable = false;

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        if (textContent.items && textContent.items.length > 0) {
          isSearchable = true;

          // Process text with simple layout preservation
          let lastY;
          let text = '';

          for (const item of textContent.items) {
            if (
              lastY !== undefined &&
              Math.abs(lastY - item.transform[5]) > 5
            ) {
              text += '\n';
            }

            text += item.str + ' ';
            lastY = item.transform[5];
          }

          fullText += `\n--- Page ${i} ---\n\n${text.trim()}\n\n`;
        } else {
          fullText += `\n--- Page ${i} ---\n\n[No text content found on this page]\n\n`;
        }
      }

      // Build and return the complete data object
      return {
        pdfTitle: this.extractPdfTitle() || metadata.title || 'Unknown PDF',
        pdfUrl: pdfUrl, // Use the original URL for reference
        content: fullText.trim(),
        metadata: metadata,
        pageCount: pageCount,
        extractedAt: new Date().toISOString(),
        ocrRequired: !isSearchable,
      };

    } catch (error) {
      this.logger.error('PDF content extraction error:', error);
      // Ensure the error object includes the original pdfUrl
      return {
         pdfTitle: this.extractPdfTitle() || 'Error Processing PDF',
         pdfUrl: pdfUrl, // Include URL in error object
         content: `Error extracting PDF content: ${error.message}`,
         error: true,
         message: error.message || 'Unknown error occurred during PDF processing',
         extractedAt: new Date().toISOString(),
       };
    }
  }

  /**
   * Extract basic PDF metadata
   * @param {Object} pdf - The loaded PDF document
   * @returns {Object} Basic metadata
   */
  async extractBasicMetadata(pdf) {
    const metadata = {
      author: null,
      creationDate: null,
      title: null,
      pageCount: pdf.numPages,
    };

    try {
      const info = await pdf.getMetadata();
      if (info && info.info) {
        metadata.author = info.info.Author || null;
        metadata.creationDate = info.info.CreationDate || null;
        metadata.title = info.info.Title || null;
      }
    } catch (error) {
      this.logger.warn('Failed to extract PDF metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract the PDF title from the document or URL
   * @returns {string} The PDF title
   */
  extractPdfTitle() {
    // Try to get from document title
    const documentTitle = document.title;
    if (documentTitle && !documentTitle.includes('PDF viewer')) {
      return documentTitle.replace('.pdf', '').trim();
    }

    // Try basic viewer elements
    const titleElement = document.querySelector(
      '#toolbar #file-name, .pdf-title, .document-title'
    );
    if (titleElement) {
      return titleElement.textContent.trim();
    }

    // Fall back to filename from URL
    const urlParts = window.location.pathname.split('/');
    const fileName = urlParts[urlParts.length - 1];
    if (fileName.endsWith('.pdf')) {
      return fileName.replace('.pdf', '');
    }

    return 'Unknown PDF Document';
  }
}

export default PdfExtractorStrategy;
