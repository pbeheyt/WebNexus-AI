import { useState, useCallback } from 'react';
import { useSidebarPlatform } from '../contexts/SidebarPlatformContext';
import { useSidebarContent } from '../contexts/SidebarContentContext';
import { INTERFACE_SOURCES } from '../../shared/constants';

export function useApiProcess() {
  const { selectedPlatformId, selectedModel, hasCredentials } = useSidebarPlatform();
  const { currentTab, contentType } = useSidebarContent();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const processContent = useCallback(async (prompt, extractedContent) => {
    if (!selectedPlatformId || !selectedModel) {
      setError('Missing platform or model selection');
      return null;
    }
    
    if (!hasCredentials) {
      setError(`No API credentials found for ${selectedPlatformId}. Please add them in settings.`);
      return null;
    }
    
    if (!extractedContent) {
      setError('No content extracted to analyze');
      return null;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Enhanced request to background script with source information
      const response = await chrome.runtime.sendMessage({
        action: 'sidebarApiProcess',
        platformId: selectedPlatformId,
        model: selectedModel,
        prompt,
        extractedContent,
        url: extractedContent.pageUrl || (currentTab ? currentTab.url : window.location.href),
        tabId: currentTab ? currentTab.id : null,
        source: INTERFACE_SOURCES.SIDEBAR,
        contentType: contentType
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Processing failed');
      }
      
      return response.response;
    } catch (error) {
      console.error('API processing error:', error);
      setError(error.message || 'Unknown error during API processing');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlatformId, selectedModel, hasCredentials, currentTab, contentType]);
  
  return {
    processContent,
    isProcessing,
    error,
    hasCredentials
  };
}