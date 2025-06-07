// src/background/services/youtube-service.js
import TranscriptAPI from 'youtube-transcript-api';

import { logger } from '../../shared/logger.js';

/**
 * Handles the request to fetch a YouTube transcript from the background script.
 * @param {object} message - The message object containing the videoId.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 */
export async function handleFetchYouTubeTranscriptRequest(
  message,
  sender,
  sendResponse
) {
  const { videoId } = message;
  if (!videoId) {
    logger.background.error(
      'handleFetchYouTubeTranscriptRequest: Missing videoId'
    );
    sendResponse({ success: false, error: 'Missing videoId' });
    return; // Exit early
  }

  try {
    logger.background.info(`Fetching YouTube transcript for videoId: ${videoId}`);
    const transcript = await TranscriptAPI.getTranscript(videoId);
    logger.background.info(
      `Successfully fetched transcript for videoId: ${videoId}`
    );
    sendResponse({ success: true, transcript });
  } catch (error) {
    logger.background.error(
      `Failed to fetch transcript for videoId ${videoId}:`,
      error
    );
    sendResponse({
      success: false,
      error: error.message || 'Unknown error fetching transcript',
    });
  }
}