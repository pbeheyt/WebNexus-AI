// src/sidebar/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';

import logger from '../../shared/logger';
import TokenManagementService from '../services/TokenManagementService';
import { STORAGE_KEYS } from '../../shared/constants';

/**
 * Hook for tracking token usage and providing token statistics in React components
 * Thin wrapper around TokenManagementService for React state management
 *
 * @param {number} tabId - Tab ID
 * @returns {Object} - Token tracking capabilities and statistics
 */
export function useTokenTracking(tabId) {
  // Initialize state using the updated structure from TokenManagementService
  const [tokenStats, setTokenStats] = useState(
    TokenManagementService._getEmptyStats()
  );
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
        logger.sidebar.error('Error loading token data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up a listener for storage changes to keep state in sync
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !tabId) return;

      // Check if token statistics were updated directly in storage
      if (
        changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS] &&
        changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue
      ) {
        const allTokenStats =
          changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue;
        const tabStats = allTokenStats[tabId];
        if (tabStats) {
          // Ensure all fields, including new ones, are updated
          setTokenStats((prevStats) => ({
            ...TokenManagementService._getEmptyStats(), // Start with default empty stats
            ...tabStats, // Overwrite with values from storage
            isCalculated: true, // Mark as calculated
          }));
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
  const calculateContextStatus = useCallback(
    async (modelConfig) => {
      if (!tabId || !modelConfig) {
        return {
          warningLevel: 'none',
          percentage: 0,
          tokensRemaining: 0,
          exceeds: false,
        };
      }

      // Use direct service call with current token stats
      return TokenManagementService.calculateContextStatus(
        tokenStats,
        modelConfig
      );
    },
    [tabId, tokenStats]
  );

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
        setTokenStats(TokenManagementService._getEmptyStats());
      }

      return success;
    } catch (error) {
      logger.sidebar.error('Error clearing token data:', error);
      return false;
    }
  }, [tabId]);

  /**
   * Calculate and update token statistics for the current tab
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Updated token statistics
   */
  const calculateStats = useCallback(
    async (messages, modelConfig = null) => {
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
        logger.sidebar.error('Error calculating token statistics:', error);
        return tokenStats;
      }
    },
    [tabId, tokenStats]
  );

  return {
    tokenStats,
    setTokenStats,
    isLoading,
    calculateContextStatus,
    clearTokenData,
    calculateStats,
    estimateTokens: TokenManagementService.estimateTokens,
    getPricingInfo: TokenManagementService.getPricingInfo,
    calculateCost: TokenManagementService.calculateCost,
  };
}
