// src/hooks/useContentProcessing.js

import { useState, useCallback, useEffect } from 'react';
import { INTERFACE_SOURCES } from '../shared/constants';
import { useContent } from '../contexts/ContentContext';
import { robustSendMessage } from '../shared/utils/message-utils';

/**
 * Hook for content extraction and processing
 * Supports both popup (web interface) and sidebar (API) paths
 * @param {string} source - Source interface (popup or sidebar)
 * @returns {Object} - Methods and state for content extraction and processing
 */
export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
  // Processing states
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [processedContent, setProcessedContent] = useState(null);
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
          streamId
        }).catch(err => console.error('Error canceling stream:', err));
      }
    };
  }, [streamId]);

  /**
   * Process content with web AI platform (non-API path)
   * Used by popup to extract content and send to web UI
   */
  const processContent = useCallback(async (options = {}) => {
    const {
      platformId,
      promptContent
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
        useApi: false
      });

      if (!response || !response.success) {
        const errorMsg = response?.error || 'Processing failed';
        throw new Error(errorMsg);
      }

      setProcessingStatus('success');
      return response;
    } catch (error) {
      console.error('Processing error:', error);
      setError(error);
      setProcessingStatus('error');
      throw error;
    }
  }, [currentTab, contentType, source]);

  /**
   * Process content directly with API (API path)
   * Used by sidebar for in-extension chat
   */
  const processContentViaApi = useCallback(async (options = {}) => {
    const {
      platformId,
      promptId,
      promptContent,
      modelId = null,
      streaming = false,
      onStreamChunk = null,
      conversationHistory = [],
      skipInitialExtraction = false
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
    setProcessedContent(null);

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
        streaming
      };

      // Add optional parameters if provided
      if (skipInitialExtraction !== undefined) request.skipInitialExtraction = skipInitialExtraction;
      if (modelId) request.modelId = modelId;
      if (promptContent) request.customPrompt = promptContent;
      if (conversationHistory?.length > 0) request.conversationHistory = conversationHistory;
      if (streaming && onStreamChunk) request.streaming = true;

      const response = await robustSendMessage(request);

      if (!response || !response.success) {
        const errorMsg = response?.error || 'API processing failed';
        throw new Error(errorMsg);
      }

      // Handle streaming response
      if (streaming && response.streamId && onStreamChunk) {
        setStreamId(response.streamId);

        const messageListener = (message) => {
          if (message.action === 'streamChunk' && message.streamId === response.streamId) {
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
      setProcessedContent(response.response);
      setProcessingStatus('success');
      return response;
    } catch (error) {
      console.error('API processing error:', error);
      setError(error);
      setProcessingStatus('error');
      throw error;
    }
  }, [currentTab, contentType, source]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setProcessingStatus('idle');
    setProcessedContent(null);
    setStreamId(null);
    setError(null);
  }, []);

  return {
    // Core processing methods
    processContent,  // For popup/web interface path
    processContentViaApi,  // For sidebar/API path

    // State management
    reset,
    processingStatus,
    processedContent,
    error,
    streamId,

    // Helper states
    isProcessing: processingStatus === 'loading',
    isStreaming: !!streamId,
    hasError: !!error,
    isComplete: processingStatus === 'success'
  };
}
