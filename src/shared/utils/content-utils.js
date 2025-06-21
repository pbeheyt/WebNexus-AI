// src/shared/utils/content-utils.js
import { CONTENT_TYPES } from '../constants.js';
import { logger } from '../logger';

/**
 * Determine content type based on URL and selection state
 * This is the single source of truth for content type detection
 *
 * @param {string} url - The URL to check
 * @param {boolean} [hasSelection=false] - Whether there is active text selection
 * @returns {string} - The detected content type
 */
export function determineContentType(url, hasSelection = false) {
  // Prioritize selected text over any other content type
  if (hasSelection) {
    return CONTENT_TYPES.SELECTED_TEXT;
  }

  // PDF detection criteria evaluation
  const isPdf = url.endsWith('.pdf');
  const containsPdfPath = url.includes('/pdf/');
  const containsPdfViewer = url.includes('pdfviewer');
  const isChromeExtensionPdf =
    url.includes('chrome-extension://') && url.includes('pdfviewer');

  try {
    // Parse the URL to reliably check the hostname
    const parsedUrl = new URL(url);

    // PDF detection logic
    if (isPdf || containsPdfPath || containsPdfViewer || isChromeExtensionPdf) {
      return CONTENT_TYPES.PDF;
    } else if (
      parsedUrl.hostname === 'www.youtube.com' &&
      parsedUrl.pathname === '/watch'
    ) {
      // More precise check for standard YouTube watch pages
      return CONTENT_TYPES.YOUTUBE;
    } else if (
      parsedUrl.hostname === 'www.reddit.com' &&
      parsedUrl.pathname.includes('/comments/')
    ) {
      // Standard Reddit comment pages
      return CONTENT_TYPES.REDDIT;
    } else {
      // Default to general for all other cases
      return CONTENT_TYPES.GENERAL;
    }
  } catch (e) {
    // Handle potential URL parsing errors (e.g., invalid URL format)
    logger.service.warn(
      `Could not parse URL for content type detection: ${url}`,
      e
    );
    // Fallback to basic checks if URL parsing fails
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
}

export function isInjectablePage(url) {
  if (!url) return false;

  const forbiddenSchemes = [
    'chrome:',
    'about:',
    'edge:',
    'moz-extension:',
    'chrome-extension:',
  ];

  const forbiddenHostnames = [
    'chromewebstore.google.com',
    'chrome.google.com',
    'addons.mozilla.org',
    'microsoftedge.microsoft.com',
  ];

  try {
    const parsedUrl = new URL(url);

    // 1. Check for forbidden schemes
    if (forbiddenSchemes.includes(parsedUrl.protocol)) {
      return false;
    }

    // 2. Check for forbidden hostnames
    if (forbiddenHostnames.includes(parsedUrl.hostname)) {
      return false;
    }

    // 3. Check for allowed schemes
    const allowedSchemes = ['http:', 'https:', 'file:'];
    if (!allowedSchemes.includes(parsedUrl.protocol)) {
      return false;
    }

    // 4. Apply special rule for file:// URLs (only PDFs are allowed)
    if (
      parsedUrl.protocol === 'file:' &&
      !parsedUrl.pathname.toLowerCase().endsWith('.pdf')
    ) {
      return false;
    }

    // If all checks pass, the page is injectable
    return true;
  } catch (e) {
    logger.service.warn(
      `URL parsing failed or non-standard scheme for injection check: ${url}`,
      e.message
    );
    return false;
  }
}

/**
 * Check if a URL is allowed to have the side panel activated
 * @param {string} url - The URL to check
 * @returns {boolean} - True if side panel is allowed, false otherwise
 */
export function isSidePanelAllowedPage(url) {
  if (!url) return false;
  try {
    // Explicitly allow Chrome New Tab Page
    if (url === 'chrome://newtab/') {
      return true;
    }
    // Block side panel on Chrome internal pages (except newtab), extension pages, and other special schemes
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('moz-extension://')
    ) {
      return false;
    }
    // Allow http, https, and file protocols
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('file://')
    ) {
      return true;
    }
    // Fallback using URL object for less common but valid schemes
    const parsedUrl = new URL(url);
    if (['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
      return true;
    }
    return false; // Block other schemes
  } catch (e) {
    logger.service.warn(
      `URL parsing failed for side panel check: ${url}`,
      e.message
    );
    return false; // Disallow side panel if URL parsing fails
  }
}
