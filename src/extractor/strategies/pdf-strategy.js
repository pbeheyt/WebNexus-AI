// src/extractor/strategies/pdf-strategy.js
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

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

// Set worker source path
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('dist/pdf.worker.mjs');

// PDF.js initialization config
const options = {
  cMapUrl: chrome.runtime.getURL('dist/cmaps/'),
  cMapPacked: true,
};

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
        contentType: this.contentType, // Ensure contentType is passed
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
    let rawTitle = this.extractPdfTitle(); // Get raw title early

    try {
      if (pdfUrl.startsWith('file://')) {
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
        this.logger.info(`Fetching PDF directly (non-file URL): ${pdfUrl}`);
        const response = await fetch(pdfUrl, {
          credentials: 'omit',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        pdfDataArrayBuffer = await response.arrayBuffer();
        this.logger.info('Successfully fetched PDF data directly.');
      }

      this.logger.info('Loading PDF document with pdfjsLib...');
      const loadingTask = getDocument({
        data: pdfDataArrayBuffer,
        cMapUrl: options.cMapUrl,
        cMapPacked: options.cMapPacked
      });

      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;
      const metadata = await this.extractBasicMetadata(pdf); // metadata values will be normalized later

      let fullText = '';
      let isSearchable = false;

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        if (textContent.items && textContent.items.length > 0) {
          isSearchable = true;
          let lastY;
          let pageText = '';
          for (const item of textContent.items) {
            if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 5) {
              pageText += '\n'; // Intentional single newline for layout
            }
            pageText += item.str + (item.str.endsWith(' ') ? '' : ' '); // Add space if not already there
            lastY = item.transform[5];
          }
          fullText += `\n--- Page ${i} ---\n\n${pageText.trim()}\n\n`; // Keep page separators
        } else {
          fullText += `\n--- Page ${i} ---\n\n[No text content found on this page]\n\n`;
        }
      }
      
      const finalTitle = normalizeText(metadata.title || rawTitle || 'Unknown PDF');
      const finalContent = normalizeText(fullText); // Normalize the assembled text

      return {
        pdfTitle: finalTitle,
        pdfUrl: pdfUrl,
        content: finalContent,
        metadata: {
          author: normalizeText(metadata.author),
          creationDate: metadata.creationDate, // Dates are not typically text normalized
          title: normalizeText(metadata.title), // Normalize metadata title as well
          pageCount: pageCount,
        },
        pageCount: pageCount,
        extractedAt: new Date().toISOString(),
        ocrRequired: !isSearchable,
        contentType: this.contentType,
      };

    } catch (error) {
      this.logger.error('PDF content extraction error:', error);
      return {
         pdfTitle: normalizeText(rawTitle || 'Error Processing PDF'),
         pdfUrl: pdfUrl,
         content: `Error extracting PDF content: ${error.message}`, // Error message, not typical content
         error: true,
         message: error.message || 'Unknown error occurred during PDF processing',
         extractedAt: new Date().toISOString(),
         contentType: this.contentType,
       };
    }
  }

  /**
   * Extract basic PDF metadata
   * @param {Object} pdf - The loaded PDF document
   * @returns {Object} Basic metadata (raw strings)
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
    // Return raw strings; normalization happens in extractPdfContent
    return metadata;
  }

  /**
   * Extract the PDF title from the document or URL (raw)
   * @returns {string} The raw PDF title
   */
  extractPdfTitle() {
    // Raw extraction, normalization happens in extractPdfContent
    const documentTitle = document.title;
    if (documentTitle && !documentTitle.includes('PDF viewer')) {
      return documentTitle.replace('.pdf', ''); // Basic cleaning, full trim by normalizeText
    }

    const titleElement = document.querySelector(
      '#toolbar #file-name, .pdf-title, .document-title'
    );
    if (titleElement) {
      return titleElement.textContent;
    }

    const urlParts = window.location.pathname.split('/');
    const fileName = urlParts[urlParts.length - 1];
    if (fileName.endsWith('.pdf')) {
      return fileName.replace('.pdf', '');
    }

    return 'Unknown PDF Document'; // Default if no other title found
  }
}

export default PdfExtractorStrategy;