// src/sidebar/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';
import TokenManagementService from '../services/TokenManagementService';

/**
 * Hook for tracking token usage and providing token statistics in React components
 * Thin wrapper around TokenManagementService for React state management
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
    historyTokensSentInLastCall: 0,
    inputTokensInLastCall: 0, // Added field
    systemTokens: 0,
    isCalculated: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load token data for the tab on mount and when tab changes
  useEffect(() => {
    const loadData = async () => {
      if (!tabId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Load token stats using service
        const stats = await TokenManagementService.getTokenStatistics(tabId);
        setTokenStats(stats);
      } catch (error) {
        console.error('Error loading token data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    // Set up a listener for storage changes to keep state in sync
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !tabId) return;
      
      // Check if token statistics were updated directly
      if (changes[TokenManagementService.TOKEN_STATS_KEY] && 
          changes[TokenManagementService.TOKEN_STATS_KEY].newValue) {
        const tabStats = changes[TokenManagementService.TOKEN_STATS_KEY].newValue[tabId];
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
    
    // Use direct service call with current token stats
    return TokenManagementService.calculateContextStatus(tokenStats, modelConfig);
  }, [tabId, tokenStats]);

  /**
   * Track token consumption for a message
   * @param {Object} messageData - Message data to track
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  const trackTokens = useCallback(async (messageData, modelConfig = null) => {
    if (!tabId) return false;
    
    try {
      // Use the service to track the message
      const success = await TokenManagementService.trackMessage(tabId, {
        messageId: messageData.messageId,
        role: messageData.role || 'user',
        content: messageData.content || '',
        inputTokens: messageData.input || 0,
        outputTokens: messageData.output || 0
      }, modelConfig);
      
      if (success) {
        // Refresh state with latest stats
        const updatedStats = await TokenManagementService.getTokenStatistics(tabId);
        setTokenStats(updatedStats);
      }
      
      return success;
    } catch (error) {
      console.error('Error tracking tokens:', error);
      return false;
    }
  }, [tabId]);

  /**
   * Clear all token data for the current tab
   * @returns {Promise<boolean>} - Success indicator
   */
  const clearTokenData = useCallback(async () => {
    if (!tabId) return false;
    
    try {
      const success = await TokenManagementService.clearTokenStatistics(tabId);
      
      if (success) {
        // Reset state to empty stats
        setTokenStats({
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          promptTokens: 0,
          historyTokens: 0,
          historyTokensSentInLastCall: 0,
          inputTokensInLastCall: 0, // Added field
          systemTokens: 0,
          isCalculated: true
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error clearing token data:', error);
      return false;
    }
  }, [tabId]);

  /**
   * Calculate and update token statistics for the current tab
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Updated token statistics
   */
  const calculateStats = useCallback(async (messages, modelConfig = null) => {
    if (!tabId) return tokenStats;
    
    try {
      const stats = await TokenManagementService.calculateAndUpdateStatistics(
        tabId,
        messages,
        modelConfig
      );
      
      setTokenStats(stats);
      return stats;
    } catch (error) {
      console.error('Error calculating token statistics:', error);
      return tokenStats;
    }
  }, [tabId, tokenStats]);

  return {
      tokenStats,
      setTokenStats,
      isLoading,
      calculateContextStatus,
      trackTokens,
      clearTokenData,
      calculateStats,
      estimateTokens: TokenManagementService.estimateTokens,
      getPricingInfo: TokenManagementService.getPricingInfo,
      calculateCost: TokenManagementService.calculateCost
  };
}
