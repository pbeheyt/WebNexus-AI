import { useState, useCallback } from 'react';
import { useSidebarContent } from '../contexts/SidebarContentContext';
import { INTERFACE_SOURCES } from '../../shared/constants';

export function useExtraction() {
  const { currentTab, contentType, isTextSelected } = useSidebarContent();
  const [extractionStatus, setExtractionStatus] = useState('idle');
  const [extractedContent, setExtractedContent] = useState(null);
  
  const extractContent = useCallback(async () => {
    // If already extracted, return cached content
    if (extractedContent) {
      return extractedContent;
    }
    
    // Set status to loading
    setExtractionStatus('loading');
    
    try {
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }
      
      // Request content extraction via background script
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeContentViaApi',
        tabId: currentTab.id,
        url: currentTab.url,
        hasSelection: isTextSelected,
        useApi: true,
        source: INTERFACE_SOURCES.SIDEBAR,
        contentType: contentType
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Content extraction failed');
      }
      
      // Get extracted content from local storage
      const { extractedContent } = await chrome.storage.local.get('extractedContent');
      
      if (!extractedContent) {
        throw new Error('No content was extracted');
      }
      
      // Cache the extracted content
      setExtractedContent(extractedContent);
      setExtractionStatus('success');
      return extractedContent;
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionStatus('error');
      throw error;
    }
  }, [currentTab, contentType, isTextSelected, extractedContent]);
  
  // Reset extraction state (e.g., when URL changes)
  const resetExtraction = useCallback(() => {
    setExtractedContent(null);
    setExtractionStatus('idle');
  }, []);
  
  return {
    extractContent,
    resetExtraction,
    extractionStatus,
    hasExtractedContent: !!extractedContent
  };
}