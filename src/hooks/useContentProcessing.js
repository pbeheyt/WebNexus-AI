// src/hooks/useContentProcessing.js

import { useState, useCallback, useEffect } from 'react';
import { INTERFACE_SOURCES, CONTENT_TYPES } from '../shared/constants';
import { determineContentType } from '../shared/content-utils';

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

  // Common states
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(null);

  // Cleanup function when component unmounts
  useEffect(() => {
    return () => {
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
   * Process content with web AI platform (non-API path)
   * Used by popup to extract content and send to web UI
   */
  const processContent = useCallback(async (options = {}) => {
    const {
      platformId,
      promptId,
      hasSelection = false,
      commentAnalysisRequired = false
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
      const response = await chrome.runtime.sendMessage({
        action: 'processContent',
        tabId: currentTab.id,
        url: currentTab.url,
        platformId,
        promptId,
        contentType,
        hasSelection,
        commentAnalysisRequired,
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
      hasSelection = false,
      modelId = null, // This is now just passed as a model override
      streaming = false,
      onStreamChunk = null,
      conversationHistory = []
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
        tabId: currentTab.id,
        url: currentTab.url,
        platformId,
        promptId,
        contentType,
        hasSelection,
        source,
        streaming
      };

      // Add optional parameters if provided
      if (modelId) request.modelId = modelId; // Just pass as model override
      if (promptContent) request.customPrompt = promptContent;
      if (conversationHistory?.length > 0) request.conversationHistory = conversationHistory;
      if (streaming && onStreamChunk) request.streaming = true;

      const response = await chrome.runtime.sendMessage(request);

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
    currentTab,
    contentType,
    streamId,
    
    // Helper states
    isProcessing: processingStatus === 'loading',
    isStreaming: !!streamId,
    hasError: !!error,
    isComplete: processingStatus === 'success'
  };
}