import logger from '../logger';

/**
 * Extracts a user-friendly error message from an API response object.
 * Attempts to parse the JSON body and find specific error details.
 * Falls back to a default message based on status code and text.
 *
 * @param {Response} response - The Fetch API Response object.
 * @returns {Promise<string>} A promise that resolves to the formatted error message string.
 */
export async function extractApiErrorMessage(response) {
  let errorData = null;
  let detailString = null;
  const defaultMessage = `API error (${response.status}): ${response.statusText || 'Unknown error'}`;

  try {
    // Clone the response before reading the body, as it can only be read once
    const clonedResponse = response.clone();
    errorData = await clonedResponse.json();
  } catch (jsonError) {
    // Ignore JSON parsing errors, we'll use the default message
    logger.service.warn(
      'Failed to parse API error response as JSON:',
      jsonError
    );
    return defaultMessage;
  }

  // Check for array structure first (e.g., some Gemini errors)
  if (Array.isArray(errorData) && errorData.length > 0) {
    const firstError = errorData[0];
    if (
      firstError?.error?.message &&
      typeof firstError.error.message === 'string'
    ) {
      detailString = firstError.error.message;
    }
  }

  // If not found in array or errorData is not an array, check object structure
  if (!detailString && errorData && typeof errorData === 'object') {
    // 1. Check errorData.message
    if (typeof errorData.message === 'string') {
      detailString = errorData.message;
    } else if (
      typeof errorData.message === 'object' &&
      errorData.message !== null
    ) {
      // Handle nested message objects (e.g., Mistral's { message: { detail: '...' } })
      if (typeof errorData.message.detail === 'string') {
        detailString = errorData.message.detail;
      } else if (typeof errorData.message.error === 'string') {
        detailString = errorData.message.error;
      } else {
        // Fallback for unexpected object structure in message
        detailString = JSON.stringify(errorData.message);
      }
    }

    // 2. Check errorData.error.message (if message wasn't useful)
    if (
      !detailString &&
      errorData.error &&
      typeof errorData.error === 'object' &&
      typeof errorData.error.message === 'string'
    ) {
      detailString = errorData.error.message;
    }
    // Check if errorData.error is the string itself
    else if (
      !detailString &&
      errorData.error &&
      typeof errorData.error === 'string'
    ) {
      detailString = errorData.error;
    }

    // 3. Check errorData.detail (string)
    if (!detailString && typeof errorData.detail === 'string') {
      detailString = errorData.detail;
    }
  }

  // If we found a specific detail, clean it and format the message
  if (detailString) {
    // Clean up common prefixes like '* '
    if (detailString) {
      detailString = detailString.replace(/^\*\s*/, '');
    }
    return `API error (${response.status}): ${detailString}`;
  } else {
    // If we couldn't extract a specific string, log for debugging
    // but return the default message to avoid large objects in UI.
    const dataType = Array.isArray(errorData) ? 'array' : typeof errorData;
    logger.service.warn(
      `API error data received (type: ${dataType}), but no specific message field found:`,
      errorData
    );
    return defaultMessage;
  }
}
