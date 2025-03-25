// src/sidebar/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';
import ApiTokenTracker from '../../services/ApiTokenTracker';

/**
 * Hook for tracking token usage and providing token statistics in React components
 * 
 * @param {number} tabId - Tab ID
 * @returns {Object} - Token tracking capabilities and statistics
 */
export function useTokenTracking(tabId) {
  const [prompts, setPrompts] = useState([]);
  const [tokenStats, setTokenStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    isCalculated: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load token data for the tab
  useEffect(() => {
    const loadData = async () => {
      if (!tabId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Load prompts
        const storedPrompts = await ApiTokenTracker.getPrompts(tabId);
        setPrompts(storedPrompts);
        
        // Load token stats
        const stats = await ApiTokenTracker.getTokenStatistics(tabId);
        setTokenStats(stats);
      } catch (error) {
        console.error('Error loading token data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    // Set up a listener for storage changes to keep data fresh
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !tabId) return;
      
      // Check if token metadata was updated
      if (changes.tab_token_metadata && changes.tab_token_metadata.newValue) {
        const newMetadata = changes.tab_token_metadata.newValue[tabId];
        if (newMetadata) {
          // Update token stats from changed storage
          ApiTokenTracker.getTokenStatistics(tabId)
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
    
    return ApiTokenTracker.calculateContextStatus(tabId, modelConfig);
  }, [tabId]);

  /**
   * Track token consumption
   * @param {Object} tokenData - Token data to track
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  const trackTokens = useCallback(async (tokenData, modelConfig = null) => {
    if (!tabId) return false;
    
    const pricing = modelConfig ? ApiTokenTracker.getPricingInfo(modelConfig) : null;
    
    return ApiTokenTracker.trackMessageTokens(
      tabId,
      tokenData.messageId || `msg_${Date.now()}`,
      { 
        input: tokenData.input || 0, 
        output: tokenData.output || 0 
      },
      {
        platformId: tokenData.platformId,
        modelId: tokenData.modelId,
        pricing
      }
    );
  }, [tabId]);

  /**
   * Store a prompt with associated token data
   * @param {string} promptText - The prompt text
   * @param {Object} metadata - Additional metadata 
   * @returns {Promise<boolean>} - Success indicator
   */
  const storePrompt = useCallback(async (promptText, metadata = {}) => {
    if (!tabId || !promptText) return false;
    
    return ApiTokenTracker.storePrompt(tabId, promptText, metadata);
  }, [tabId]);

  /**
   * Clear all token data for the current tab
   * @returns {Promise<boolean>} - Success indicator
   */
  const clearTokenData = useCallback(async () => {
    if (!tabId) return false;
    
    return ApiTokenTracker.clearTabData(tabId);
  }, [tabId]);

  return {
    prompts,
    tokenStats,
    isLoading,
    calculateContextStatus,
    trackTokens,
    storePrompt,
    clearTokenData
  };
}