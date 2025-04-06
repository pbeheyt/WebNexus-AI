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
    console.warn('Failed to parse API error response as JSON:', jsonError);
    return defaultMessage;
  }

  if (errorData && typeof errorData === 'object') {
    // 1. Check errorData.message
    if (typeof errorData.message === 'string') {
      detailString = errorData.message;
    } else if (typeof errorData.message === 'object' && errorData.message !== null) {
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
    if (!detailString && errorData.error && typeof errorData.error === 'object' && typeof errorData.error.message === 'string') {
      detailString = errorData.error.message;
    }

    // 3. Check errorData.detail (string)
    if (!detailString && typeof errorData.detail === 'string') {
      detailString = errorData.detail;
    }

    // If we found a specific detail, format the message
    if (detailString) {
      return `API error (${response.status}): ${detailString}`;
    } else {
      // If it's an object but we couldn't extract a specific string, log for debugging
      // but return the default message to avoid large objects in UI.
      console.warn('API error object received, but no specific message field found:', errorData);
      return defaultMessage;
    }
  }

  // If errorData is not an object or parsing failed earlier
  return defaultMessage;
}
