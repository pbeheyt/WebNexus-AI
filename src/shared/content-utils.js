// src/shared/content-utils.js
import { CONTENT_TYPES } from './constants.js';

/**
 * Determine content type based on URL and selection state
 * This is the single source of truth for content type detection
 * 
 * @param {string} url - The URL to check
 * @returns {string} - The detected content type
 */
export function determineContentType(url) {
  // PDF detection criteria evaluation
  const isPdf = url.endsWith('.pdf');
  const containsPdfPath = url.includes('/pdf/');
  const containsPdfViewer = url.includes('pdfviewer');
  const isChromeExtensionPdf = url.includes('chrome-extension://') && url.includes('pdfviewer');

  // PDF detection logic
  if (isPdf || containsPdfPath || containsPdfViewer || isChromeExtensionPdf) {
    return CONTENT_TYPES.PDF;
  } else if (url.includes('youtube.com/watch')) {
    return CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return CONTENT_TYPES.REDDIT;
  } else {
    return CONTENT_TYPES.GENERAL;
  }
}

/**
 * Get the appropriate content script file for a content type
 * @param {string} contentType - The content type
 * @returns {string} - Path to the content script file
 */
export function getContentScriptFile(contentType) {
  // Select appropriate content script based on content type
  if (contentType === CONTENT_TYPES.PDF) {
    return 'dist/pdf-content.bundle.js';
  } else if (contentType === CONTENT_TYPES.YOUTUBE) {
    return 'dist/youtube-content.bundle.js';
  } else if (contentType === CONTENT_TYPES.REDDIT) {
    return 'dist/reddit-content.bundle.js';
  } else {
    return 'dist/general-content.bundle.js';
  }
}
