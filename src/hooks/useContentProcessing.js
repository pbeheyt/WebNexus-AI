// src/hooks/useContentProcessing.js

import { useState, useCallback, useEffect } from 'react';

import { INTERFACE_SOURCES } from '../shared/constants';
import { logger } from '../shared/logger';
import { useContent } from '../contexts/ContentContext';
import { robustSendMessage } from '../shared/utils/message-utils';

/**
 * Hook for content extraction and processing
 * Supports both popup (web interface) and sidepanel (API) paths
 * @param {string} source - Source interface (popup or sidepanel)
 * @returns {Object} - Methods and state for content extraction and processing
 */
export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
  // Processing states
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [streamId, setStreamId] = useState(null);
  const [error, setError] = useState(null);

  // Get content context
  const { currentTab, contentType } = useContent();

  // Cleanup function when component unmounts
  useEffect(() => {
    return () => {
      if (streamId) {
        robustSendMessage({
          action: 'cancelStream',
          streamId,
        }).catch((err) => logger.popup.error('Error canceling stream:', err));
      }
    };
  }, [streamId]);

  /**
   * Process content with web AI platform (non-API path)
   * Used by popup to extract content and send to web UI
   */
  const processContent = useCallback(
    async (options = {}) => {
      const {
        platformId,
        promptContent,
        includeContext = true, // Default to true if not provided
      } = options;

      if (!currentTab?.id) {
        const error = new Error('No active tab available');
        setError(error);
        setProcessingStatus('error');
        throw error;
      }

      if (!platformId) {
        const error = new Error('No AI platform selected');
        setError(error);
        setProcessingStatus('error');
        throw error;
      }

      if (!promptContent) {
        const error = new Error('No prompt content provided');
        setError(error);
        setProcessingStatus('error');
        throw error;
      }

      setProcessingStatus('loading');
      setError(null);

      try {
        const response = await robustSendMessage({
          action: 'processContent',
          tabId: currentTab?.id,
          url: currentTab?.url,
          platformId,
          promptContent,
          contentType,
          source,
          useApi: false,
          includeContext: includeContext,
        });

        // The background script now consistently returns { success: boolean, ... }
        // We don't need to check for !response here as robustSendMessage handles basic comms errors.
        // Let the caller handle the success/error based on the response content.
        if (response && response.success) {
          setProcessingStatus('success');
        } else {
          // Set error state based on the response from background
          const errorMsg = response?.error || 'Processing failed in background';
          setError(new Error(errorMsg)); // Store the error message
          setProcessingStatus('error');
        }

        // Return the actual response object received from the background script
        return response;
      } catch (error) {
        // Catch errors from robustSendMessage itself (e.g., port closed)
        if (error.isPortClosed) {
          // Handle port closed specifically for the popup flow
          logger.popup.warn(
            'processContent: Port closed during background processing (likely popup closed).'
          );
          // Don't set global error state, return specific status
          setProcessingStatus('idle'); // Reset status as the operation was interrupted, not failed
          return {
            success: false,
            error: 'PORT_CLOSED',
            message: 'Popup closed before background task could respond.',
          };
        } else {
          // Handle other communication or unexpected errors
          logger.popup.error('Error sending message to background:', error);
          setError(error); // Store the communication error
          setProcessingStatus('error');
          throw error; // Re-throw for potential higher-level handling if needed
        }
      }
    },
    [currentTab, contentType, source]
  );

  /**
   * Process content directly with API (API path)
   * Used by sidepanel for in-extension chat
   */
  const processContentViaApi = useCallback(
    async (options = {}) => {
      const {
        platformId,
        promptId,
        promptContent,
        modelId = null,
        streaming = false,
        onStreamChunk = null,
        conversationHistory = [],
        isContentExtractionEnabled,
        isThinkingModeEnabled,
      } = options;

      if (!currentTab?.id) {
        const error = new Error('No active tab available');
        setError(error);
        setProcessingStatus('error');
        throw error;
      }

      if (!platformId) {
        const error = new Error('No AI platform selected');
        setError(error);
        setProcessingStatus('error');
        throw error;
      }

      setProcessingStatus('loading');
      setError(null);

      try {
        // Prepare unified request configuration
        const request = {
          action: 'processContentViaApi',
          tabId: currentTab?.id,
          url: currentTab?.url,
          platformId,
          promptId,
          contentType,
          source,
          streaming,
          isContentExtractionEnabled,
          isThinkingModeEnabled: isThinkingModeEnabled ?? false,
        };

        // Add optional parameters if provided
        if (modelId) request.modelId = modelId;
        if (promptContent) request.customPrompt = promptContent;
        if (conversationHistory?.length > 0)
          request.conversationHistory = conversationHistory;
        if (streaming && onStreamChunk) request.streaming = true;

        // Add pre-truncation stats if provided (for reruns/edits)
        if (options.options?.preTruncationCost !== undefined) {
          // Check within nested options object
          request.preTruncationCost = options.options.preTruncationCost;
        }
        if (options.options?.preTruncationOutput !== undefined) {
          // Check within nested options object
          request.preTruncationOutput = options.options.preTruncationOutput;
        }

        const response = await robustSendMessage(request);

        if (!response || !response.success) {
          const errorMsg = response?.error || 'API processing failed';
          throw new Error(errorMsg);
        }

        // Handle streaming response
        if (streaming && response.streamId && onStreamChunk) {
          setStreamId(response.streamId);

          const messageListener = (message) => {
            if (
              message.action === 'streamChunk' &&
              message.streamId === response.streamId
            ) {
              onStreamChunk(message.chunkData);
              if (message.chunkData.done) {
                chrome.runtime.onMessage.removeListener(messageListener);
                setProcessingStatus('success');
                setStreamId(null);
              }
            }
          };

          chrome.runtime.onMessage.addListener(messageListener);
          return response;
        }

        // Handle non-streaming response
        setProcessingStatus('success');
        return response;
      } catch (error) {
        logger.popup.error('API processing error:', error);
        setError(error);
        setProcessingStatus('error');
        throw error;
      }
    },
    [currentTab, contentType, source]
  );

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setProcessingStatus('idle');
    setStreamId(null);
    setError(null);
  }, []);

  return {
    // Core processing methods
    processContent, // For popup/web interface path
    processContentViaApi, // For sidepanel/API path

    // State management
    reset,
    processingStatus,
    error,
    streamId,

    // Helper states
    isProcessing: processingStatus === 'loading',
    isStreaming: !!streamId,
    hasError: !!error,
    isComplete: processingStatus === 'success',
  };
}
