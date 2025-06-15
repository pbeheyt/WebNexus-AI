// src/sidepanel/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';

import { logger } from '../../shared/logger';
import TokenManagementService from '../services/TokenManagementService';
import { STORAGE_KEYS } from '../../shared/constants';

/**
 * Hook for tracking token usage and providing token statistics in React components
 * Thin wrapper around TokenManagementService for React state management
 *
 * @param {string} chatSessionId - Chat Session ID
 * @returns {Object} - Token tracking capabilities and statistics
 */
export function useTokenTracking(chatSessionId) {
  // Initialize state using the updated structure from TokenManagementService
  const [tokenStats, setTokenStats] = useState(
    TokenManagementService._getEmptyStats()
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load token data for the session on mount and when session changes
  useEffect(() => {
    const loadData = async () => {
      if (!chatSessionId) {
        setTokenStats(TokenManagementService._getEmptyStats()); // Reset stats if no session ID
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Load token stats using service
        const stats =
          await TokenManagementService.getTokenStatistics(chatSessionId);
        setTokenStats(stats);
      } catch (error) {
        logger.sidepanel.error(
          'Error loading token data for session:',
          chatSessionId,
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up a listener for storage changes to keep state in sync
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !chatSessionId) return;

      // Check if global chat token statistics were updated
      // Assuming TokenManagementService now stores stats under a global key, keyed by chatSessionId
      if (
        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] &&
        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue
      ) {
        const allChatTokenStats =
          changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue;
        const sessionStats = allChatTokenStats[chatSessionId];
        if (sessionStats) {
          setTokenStats((_prevStats) => ({
            ...TokenManagementService._getEmptyStats(),
            ...sessionStats,
            isCalculated: true,
          }));
        } else {
          // If the current session's stats are not in the new value (e.g., cleared), reset them
          setTokenStats(TokenManagementService._getEmptyStats());
        }
      }
    };

    // Add storage change listener
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Clean up listener
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [chatSessionId]);

  /**
   * Calculate context window status based on current token stats
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status object
   */
  const calculateContextStatus = useCallback(
    async (modelConfig) => {
      // Now relies on tokenStats which are for the current chatSessionId
      if (
        !modelConfig ||
        !modelConfig.tokens ||
        !modelConfig.tokens.contextWindow
      ) {
        return {
          warningLevel: 'none',
          percentage: 0,
          tokensRemaining: 0,
          exceeds: false,
          totalTokens: 0,
        };
      }

      try {
        // Use direct service call with current token stats (already for the correct chatSessionId)
        const status = await TokenManagementService.calculateContextStatus(
          tokenStats,
          modelConfig
        );

        // Ensure we always return a valid status object
        return (
          status || {
            warningLevel: 'none',
            percentage: 0,
            tokensRemaining: 0,
            exceeds: false,
            totalTokens: 0,
          }
        );
      } catch (error) {
        logger.sidepanel.error(
          `[DIAG_LOG: useTokenTracking:calculateContextStatus] Caught error for chatSessionId: ${chatSessionId}`,
          error
        );
        return {
          warningLevel: 'none',
          percentage: 0,
          tokensRemaining: 0,
          exceeds: false,
          totalTokens: 0,
        };
      }
    },
    [chatSessionId, tokenStats] // chatSessionId for logging, tokenStats for calculation
  );

  /**
   * Clear all token data for the current chat session
   * @param {string} sessionIdToClear - Optional: if provided, clears for this specific session. Defaults to current chatSessionId.
   * @returns {Promise<boolean>} - Success indicator
   */
  const clearTokenData = useCallback(
    async (sessionIdToClear) => {
      const targetSessionId = sessionIdToClear || chatSessionId;
      if (!targetSessionId) return false;

      try {
        const success =
          await TokenManagementService.clearTokenStatistics(targetSessionId);

        if (success && targetSessionId === chatSessionId) {
          // Reset state to empty stats only if the cleared session is the current one
          setTokenStats(TokenManagementService._getEmptyStats());
        }

        return success;
      } catch (error) {
        logger.sidepanel.error(
          'Error clearing token data for session:',
          targetSessionId,
          error
        );
        return false;
      }
    },
    [chatSessionId]
  );

  /**
   * Calculate and update token statistics for the current chat session
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Updated token statistics
   */
  const calculateStats = useCallback(
    async (messages, modelConfig = null) => {
      if (!chatSessionId) return tokenStats; // Return current (likely empty) stats if no session

      try {
        const stats = await TokenManagementService.calculateAndUpdateStatistics(
          chatSessionId,
          messages,
          modelConfig
        );

        setTokenStats(stats);
        return stats;
      } catch (error) {
        logger.sidepanel.error(
          'Error calculating token statistics for session:',
          chatSessionId,
          error
        );
        return tokenStats; // Return existing stats on error
      }
    },
    [chatSessionId, tokenStats] // Depend on chatSessionId and tokenStats
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
