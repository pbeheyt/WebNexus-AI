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
        const err = new Error('No active tab available');
        setError(err);
        setProcessingStatus('error');
        throw err;
      }

      if (!platformId) {
        const err = new Error('No AI platform selected');
        setError(err);
        setProcessingStatus('error');
        throw err;
      }

      if (!promptContent) {
        const err = new Error('No prompt content provided');
        setError(err);
        setProcessingStatus('error');
        throw err;
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

        if (response && response.success) {
          setProcessingStatus('success');
        } else {
          const errorMsg = response?.error || 'Processing failed in background';
          setError(new Error(errorMsg));
          setProcessingStatus('error');
        }
        return response;
      } catch (commError) {
        if (commError.isPortClosed) {
          logger.popup.warn(
            'processContent: Port closed during background processing (likely popup closed).'
          );
          setProcessingStatus('idle');
          return {
            success: false,
            error: 'PORT_CLOSED',
            message: 'Popup closed before background task could respond.',
          };
        } else {
          logger.popup.error('Error sending message to background:', commError);
          setError(commError);
          setProcessingStatus('error');
          throw commError;
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
        const err = new Error('No active tab available');
        setError(err);
        setProcessingStatus('error');
        throw err;
      }

      if (!platformId) {
        const err = new Error('No AI platform selected');
        setError(err);
        setProcessingStatus('error');
        throw err;
      }

      setProcessingStatus('loading');
      setError(null);

      try {
        const request = {
          action: 'processContentViaApi',
          tabId: currentTab?.id,
          url: currentTab?.url,
          platformId,
          promptId,
          contentType,
          source,
          streaming,
          isContentExtractionEnabled, // Pass this to background
          isThinkingModeEnabled: isThinkingModeEnabled ?? false,
        };

        if (modelId) request.modelId = modelId;
        if (promptContent) request.customPrompt = promptContent;
        if (conversationHistory?.length > 0)
          request.conversationHistory = conversationHistory;
        if (streaming && onStreamChunk) request.streaming = true;

        if (options.options?.preTruncationCost !== undefined) {
          request.preTruncationCost = options.options.preTruncationCost;
        }
        if (options.options?.preTruncationOutput !== undefined) {
          request.preTruncationOutput = options.options.preTruncationOutput;
        }

        const response = await robustSendMessage(request);

        if (!response || !response.success) {
          const errorMsg = response?.error || 'API processing failed';
          throw new Error(errorMsg);
        }

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
          // Return the full response, including the new contentSuccessfullyIncluded flag
          return response;
        }

        setProcessingStatus('success');
        // Return the full response for non-streaming too
        return response;
      } catch (apiError) {
        logger.popup.error('API processing error:', apiError);
        setError(apiError);
        setProcessingStatus('error');
        throw apiError;
      }
    },
    [currentTab, contentType, source]
  );

  const reset = useCallback(() => {
    setProcessingStatus('idle');
    setStreamId(null);
    setError(null);
  }, []);

  return {
    processContent,
    processContentViaApi,
    reset,
    processingStatus,
    error,
    streamId,
    isProcessing: processingStatus === 'loading',
    isStreaming: !!streamId,
    hasError: !!error,
    isComplete: processingStatus === 'success',
  };
}