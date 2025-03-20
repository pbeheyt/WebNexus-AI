import { useState } from 'react';
import { MESSAGE_TYPES } from '../constants';

export function useExtraction() {
  const [extractionStatus, setExtractionStatus] = useState('idle');
  
  const extractContent = async () => {
    // Set status to loading
    setExtractionStatus('loading');
    
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }
      
      // Request content extraction via background script
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeContent',
        tabId: currentTab.id,
        url: currentTab.url,
        hasSelection: false,
        useApi: true
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Content extraction failed');
      }
      
      // Get extracted content from local storage
      const { extractedContent } = await chrome.storage.local.get('extractedContent');
      
      if (!extractedContent) {
        throw new Error('No content was extracted');
      }
      
      setExtractionStatus('success');
      return extractedContent;
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionStatus('error');
      throw error;
    }
  };
  
  return {
    extractContent,
    extractionStatus
  };
}