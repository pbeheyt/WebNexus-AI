import { logger } from '../../shared/logger.js';

/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param {*} buffer - The ArrayBuffer to convert.
 * @returns {string} The Base64-encoded string.
 */
function _arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Fetches a PDF from a file URL and returns its content as Base64.
 * @param {string} url - The file:// URL of the PDF.
 * @returns {Promise<{success: boolean, base64Data?: string, error?: string}>}
 */
async function fetchPdfAsBase64(url) {
  logger.background.info(`Attempting to fetch PDF from file URL: ${url}`);
  if (!url || !url.startsWith('file://')) {
    return { success: false, error: 'Invalid or non-file URL provided.' };
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch PDF: ${response.status} ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = _arrayBufferToBase64(arrayBuffer);
    logger.background.info(
      `Successfully fetched and encoded PDF from ${url}. Size: ${base64Data.length} chars.`
    );
    return { success: true, base64Data };
  } catch (error) {
    logger.background.error(`Error fetching file URL ${url}:`, error);
    return { success: false, error: error.message || 'Unknown fetch error' };
  }
}

/**
 * Handles the request to fetch a PDF from a file URL via message passing.
 * @param {object} message - The message object containing the URL.
 * @param {function} sendResponse - The function to send the response.
 */
export async function handleFetchPdfRequest(message, _sender, sendResponse) {
  try {
    if (!message.url) {
      logger.background.error('handleFetchPdfRequest: Missing URL in message.');
      sendResponse({
        success: false,
        error: 'Missing URL in fetchPdfAsBase64 request',
      });
      return; // Exit early
    }

    const response = await fetchPdfAsBase64(message.url);
    sendResponse(response);
  } catch (error) {
    logger.background.error('Critical error in handleFetchPdfRequest:', error);
    sendResponse({
      success: false,
      error: 'An unexpected error occurred while fetching the PDF.',
    });
  }
}
