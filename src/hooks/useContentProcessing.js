// src/hooks/useContentProcessing.js

import { useState, useCallback, useEffect } from 'react';
import { INTERFACE_SOURCES, CONTENT_TYPES } from '../shared/constants';

/**
 * Hook for unified content extraction and processing
 * Works for both popup and sidebar interfaces
 * @param {string} source - Source interface (popup or sidebar)
 * @returns {Object} - Methods and state for content extraction and processing
 */
export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
  // Processing states
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [processedContent, setProcessedContent] = useState(null);
  const [streamId, setStreamId] = useState(null);

  // Common states
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(null);

  // Cleanup function when component unmounts
  useEffect(() => {
    return () => {
      console.log('Cleaning up listeners');
      if (streamId) {
        chrome.runtime.sendMessage({
          action: 'cancelStream',
          streamId
        }).catch(err => console.error('Error canceling stream:', err));
      }
    };
  }, [streamId]);

  // Get current tab information
  useEffect(() => {
    const getCurrentTab = async () => {
      try {
        console.log('Fetching current tab information');
        const queryOptions = { active: true, currentWindow: true };
        const [tab] = await chrome.tabs.query(queryOptions);
        if (tab) {
          setCurrentTab(tab);
          const type = tab.url ? determineContentType(tab.url) : CONTENT_TYPES.GENERAL;
          setContentType(type);
        }
      } catch (err) {
        console.error('Error getting current tab:', err);
      }
    };

    getCurrentTab();
  }, []);

  /**
   * Determines content type based on URL
   * @param {string} url - URL to analyze
   * @returns {string} - Content type
   */
  const determineContentType = useCallback((url) => {
    console.log('Determining content type for URL:', url);
    if (url.includes('youtube.com/watch')) return CONTENT_TYPES.YOUTUBE;
    if (url.includes('reddit.com')) return CONTENT_TYPES.REDDIT;
    if (url.endsWith('.pdf')) return CONTENT_TYPES.PDF;
    return CONTENT_TYPES.GENERAL;
  }, []);

  /**
   * Process content with extraction handled by background
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  const processContent = useCallback(async (options = {}) => {
    const {
      platformId,
      promptId,
      promptContent,
      hasSelection = false,
      commentAnalysisRequired = false,
      useApi = false,
      streaming = false,
      onStreamChunk = null,
      modelId = null
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

    console.log('Starting content processing with internal extraction');
    setProcessingStatus('loading');
    setError(null);
    setProcessedContent(null);

    try {
      // This now uses the consolidated background flow that handles extraction internally
      const request = {
        action: useApi ? 'summarizeContentViaApi' : 'summarizeContent',
        tabId: currentTab.id,
        url: currentTab.url,
        platformId,
        promptId,
        contentType,
        hasSelection,
        commentAnalysisRequired,
        source,
        useApi
      };

      if (modelId) {
        request.modelId = modelId;
      }

      if (promptContent) {
        request.promptContent = promptContent;
      }

      if (streaming && useApi) {
        request.streaming = true;
      }

      const response = await chrome.runtime.sendMessage(request);

      if (!response || !response.success) {
        const errorMsg = response?.error || 'Processing failed';
        throw new Error(errorMsg);
      }

      if (streaming && useApi && response.streamId && onStreamChunk) {
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
        return response.streamId;
      } else if (useApi) {
        setProcessedContent(response.response);
        setProcessingStatus('success');
        return response.response;
      } else {
        setProcessingStatus('success');
        return response;
      }
    } catch (error) {
      console.error('Processing error:', error);
      setError(error);
      setProcessingStatus('error');
      throw error;
    }
  }, [currentTab, contentType, source]);

  /**
   * Process content with streaming (optimized for sidebar chat)
   * @param {Object} options - Processing options
   * @returns {Promise<string>} - Stream ID
   */
  const processContentStreaming = useCallback(async (options = {}) => {
    const streamingOptions = {
      ...options,
      useApi: true,
      streaming: true
    };
    return processContent(streamingOptions);
  }, [processContent]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    console.log('Resetting state');
    setProcessingStatus('idle');
    setProcessedContent(null);
    setStreamId(null);
    setError(null);
  }, []);

  return {
    processContent,
    processContentStreaming,
    reset,
    processingStatus,
    processedContent,
    error,
    currentTab,
    contentType,
    streamId,
    isProcessing: processingStatus === 'loading',
    isStreaming: !!streamId,
    hasError: !!error,
    isComplete: processingStatus === 'success'
  };
}