// Helper to convert ArrayBuffer to Base64
function _arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

import { logger } from '../../shared/logger.js';

/**
 * Fetches a PDF from a file URL and returns its content as Base64.
 * @param {string} url - The file:// URL of the PDF.
 * @returns {Promise<{success: boolean, base64Data?: string, error?: string}>}
 */
export async function fetchPdfAsBase64(url) {
  logger.background.info(`Attempting to fetch PDF from file URL: ${url}`);
  if (!url || !url.startsWith('file://')) {
    return { success: false, error: 'Invalid or non-file URL provided.' };
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = _arrayBufferToBase64(arrayBuffer);
    logger.background.info(`Successfully fetched and encoded PDF from ${url}. Size: ${base64Data.length} chars.`);
    return { success: true, base64Data };
  } catch (error) {
    logger.background.error(`Error fetching file URL ${url}:`, error);
    return { success: false, error: error.message || 'Unknown fetch error' };
  }
}
