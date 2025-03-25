// src/hooks/useStructuredPrompt.js

import { useState, useEffect, useCallback } from 'react';
import StructuredPromptService from '../services/StructuredPromptService';

/**
 * Hook for accessing structured prompts and token accounting data
 * @param {number} tabId - Tab ID
 * @returns {Object} - Structured prompt data and token statistics
 */
export function useStructuredPrompt(tabId) {
  const [prompts, setPrompts] = useState([]);
  const [tokenStats, setTokenStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    isCalculated: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load structured prompts and token stats for the tab
  useEffect(() => {
    const loadData = async () => {
      if (!tabId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Load prompts
        const structuredPrompts = await StructuredPromptService.getStructuredPrompts(tabId);
        setPrompts(structuredPrompts);
        
        // Load token stats
        const stats = await StructuredPromptService.getTokenStatistics(tabId);
        setTokenStats(stats);
      } catch (error) {
        console.error('Error loading structured prompts and token data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    // Set up a listener for storage changes to keep the data fresh
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !tabId) return;
      
      // Check if token metadata was updated
      if (changes.tab_token_metadata && changes.tab_token_metadata.newValue) {
        const newMetadata = changes.tab_token_metadata.newValue[tabId];
        if (newMetadata) {
          // Update token stats from changed storage
          StructuredPromptService.getTokenStatistics(tabId)
            .then(stats => setTokenStats(stats))
            .catch(err => console.error('Error updating token stats from storage change:', err));
        }
      }
      
      // Check if structured prompts were updated
      if (changes.tab_structured_prompts && changes.tab_structured_prompts.newValue) {
        const newPrompts = changes.tab_structured_prompts.newValue[tabId];
        if (newPrompts) {
          setPrompts(newPrompts);
        }
      }
    };
    
    // Add storage change listener
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // Clean up listener
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [tabId]);

  /**
   * Get token statistics (synchronous - returns cached value)
   * @returns {Object} - Token stats object
   */
  const getTokenStats = useCallback(() => tokenStats, [tokenStats]);

  /**
   * Calculate context window status based on current token stats
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status object
   */
  const calculateContextStatus = useCallback(async (modelConfig) => {
    if (!tabId || !modelConfig) {
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
    
    return StructuredPromptService.calculateContextStatus(tabId, modelConfig);
  }, [tabId]);

  /**
   * Add new token counts to the tab's token metadata - 
   * This is now just a compatibility layer, actual counting is done in the API
   * @param {Object} newTokens - Token counts to add
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  const addTokenCounts = useCallback(async (newTokens, modelConfig = null) => {
    // This function is kept for compatibility but doesn't add tokens directly
    // All token counting is now centralized in the API layer
    return true;
  }, [tabId]);

  return {
    prompts,
    tokenStats,
    isLoading,
    getTokenStats,
    calculateContextStatus,
    addTokenCounts
  };
}