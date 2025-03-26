// src/sidebar/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';

/**
 * Hook for tracking token usage and providing token statistics in React components
 * 
 * @param {number} tabId - Tab ID
 * @returns {Object} - Token tracking capabilities and statistics
 */
export function useTokenTracking(tabId) {
  const [tokenStats, setTokenStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    promptTokens: 0,
    historyTokens: 0,
    systemTokens: 0,
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
        // Load token stats from chat history
        const stats = await ChatHistoryService.calculateTokenStatistics(tabId);
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
      
      // Check if chat histories were updated
      if (changes[ChatHistoryService.STORAGE_KEY] && 
          changes[ChatHistoryService.STORAGE_KEY].newValue) {
        const tabHistory = changes[ChatHistoryService.STORAGE_KEY].newValue[tabId];
        if (tabHistory) {
          // Recalculate token stats when chat history changes
          ChatHistoryService.calculateTokenStatistics(tabId)
            .then(stats => setTokenStats(stats))
            .catch(err => console.error('Error updating token stats from history change:', err));
        }
      }
      
      // Check if token statistics were updated directly
      if (changes[ChatHistoryService.TOKEN_STATS_KEY] && 
          changes[ChatHistoryService.TOKEN_STATS_KEY].newValue) {
        const tabStats = changes[ChatHistoryService.TOKEN_STATS_KEY].newValue[tabId];
        if (tabStats) {
          setTokenStats({
            ...tabStats,
            isCalculated: true
          });
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
    
    return ChatHistoryService.calculateContextStatus(tabId, modelConfig);
  }, [tabId]);

  /**
   * Track token consumption for a message
   * @param {Object} tokenData - Token data to track
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  const trackTokens = useCallback(async (tokenData, modelConfig = null) => {
    if (!tabId) return false;
    
    const messageId = tokenData.messageId || `msg_${Date.now()}`;
    
    // Update the message with token information
    return ChatHistoryService.updateMessageTokens(
      tabId,
      messageId,
      { 
        input: tokenData.input || 0, 
        output: tokenData.output || 0 
      },
      {
        platformId: tokenData.platformId,
        modelId: tokenData.modelId
      }
    );
  }, [tabId]);

  /**
   * Clear all token data for the current tab
   * @returns {Promise<boolean>} - Success indicator
   */
  const clearTokenData = useCallback(async () => {
    if (!tabId) return false;
    
    return ChatHistoryService.clearTokenStatistics(tabId);
  }, [tabId]);

  /**
   * Estimate tokens for text
   * @param {string} text - Text to estimate
   * @returns {number} - Estimated token count
   */
  const estimateTokens = useCallback((text) => {
    return TokenManagementService.estimateTokens(text);
  }, []);

  /**
   * Get pricing information for a model
   * @param {Object} modelConfig - Model configuration
   * @returns {Object|null} - Pricing information or null
   */
  const getPricingInfo = useCallback((modelConfig) => {
    return TokenManagementService.getPricingInfo(modelConfig);
  }, []);

  /**
   * Calculate cost for token usage
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @param {Object} modelConfig - Model configuration
   * @returns {Object} - Cost information
   */
  const calculateCost = useCallback((inputTokens, outputTokens, modelConfig) => {
    return TokenManagementService.calculateCost(inputTokens, outputTokens, modelConfig);
  }, []);

  return {
    tokenStats,
    isLoading,
    calculateContextStatus,
    trackTokens,
    clearTokenData,
    estimateTokens,
    getPricingInfo,
    calculateCost
  };
}