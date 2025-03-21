// src/background/api/streaming-handler.js - Streaming response management

import { INTERFACE_SOURCES } from '../../shared/constants.js';
import { updateStreamContent, completeStreamResponse } from '../core/state-manager.js';
import logger from '../../utils/logger.js';

/**
 * Set up a streaming handler for API responses
 * @param {string} streamId - Stream identifier
 * @param {string} source - Interface source
 * @param {number} tabId - Tab ID for sidebar integration
 * @param {string} platformId - Platform identifier
 * @returns {Function} Chunk handler function
 */
export function setupStreamHandler(streamId, source, tabId, platformId) {
  let fullContent = '';
  let modelToUse = null;
  
  /**
   * Handle chunks from the streaming API
   * @param {Object} chunkData - Chunk data from API
   */
  return async function handleChunk(chunkData) {
    // Ensure chunkData is properly formatted
    if (!chunkData) return;
    
    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done; // Ensure boolean
    
    // Capture or update model information
    if (chunkData.model) {
      modelToUse = chunkData.model;
    }
    
    if (chunk) {
      fullContent += chunk;
      
      // Update storage with latest content
      await updateStreamContent(fullContent);
      
      // Send to content script for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk,
              done: false,
              model: chunkData.model || modelToUse
            }
          });
        } catch (err) {
          // Ignore if content script isn't available
          logger.background.warn('Error sending stream chunk:', err);
        }
      }
    }
    
    // CRITICAL: Always send a final message when done, even if there's no new content
    if (done) {
      await completeStreamResponse(fullContent, modelToUse, platformId);
      
      // Ensure the completion message is sent for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk: '',
              done: true, // Explicitly mark as done
              model: chunkData.model || modelToUse,
              fullContent
            }
          });
        } catch (err) {
          logger.background.warn('Error sending stream completion:', err);
        }
      }
    }
  };
}