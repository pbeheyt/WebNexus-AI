import { useState, useCallback } from 'react';
import { useSidebarPlatform } from '../contexts/SidebarPlatformContext';

export function useApiProcess() {
  const { selectedPlatformId, selectedModel } = useSidebarPlatform();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const processContent = useCallback(async (prompt, extractedContent) => {
    if (!selectedPlatformId || !selectedModel || !extractedContent) {
      setError('Missing required data for processing');
      return null;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Request API processing via background script
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeContentViaApi',
        platformId: selectedPlatformId,
        model: selectedModel,
        prompt,
        tabId: null, // Not needed for direct API calls
        url: extractedContent.pageUrl || window.location.href,
        testContent: extractedContent,
        useApi: true,
        source: 'sidebar'
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
  }, [selectedPlatformId, selectedModel]);
  
  return {
    processContent,
    isProcessing,
    error
  };
}