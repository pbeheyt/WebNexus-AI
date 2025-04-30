// src/sidebar/services/TokenManagementService.js

import { encode } from 'gpt-tokenizer';

import { logger } from '../../shared/logger';
import { STORAGE_KEYS, MESSAGE_ROLES } from '../../shared/constants';

import ChatHistoryService from './ChatHistoryService';

/**
 * Service for token estimation, cost calculation, storage, and context window monitoring
 * Central authority for all token-related operations
 */
class TokenManagementService {
  /**
   * Get token statistics for a specific tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async getTokenStatistics(tabId) {
    if (!tabId) {
      return this._getEmptyStats();
    }

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};
      const tabStats = allTokenStats[tabId] || {};

      // Return merged stats, ensuring all default fields are present
      return { ...this._getEmptyStats(), ...tabStats };
    } catch (error) {
      logger.sidebar.error(
        'TokenManagementService: Error getting token statistics:',
        error
      );
      return this._getEmptyStats();
    }
  }

  /**
   * Update token statistics for a specific tab
   * @param {number} tabId - Tab identifier
   * @param {Object} stats - Token statistics to store
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(tabId, stats) {
    if (!tabId) return false;

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Update stats for this tab
      allTokenStats[tabId] = {
        ...stats,
        lastUpdated: Date.now(),
      };

      // Save all token statistics
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats,
      });
      return true;
    } catch (error) {
      logger.sidebar.error(
        'TokenManagementService: Error updating token statistics:',
        error
      );
      return false;
    }
  }

  /**
   * Calculate token statistics from chat history
   * @param {Array} messages - Chat messages
   * @param {string} systemPrompt - System prompt text (optional)
   * @returns {Object} - Token statistics focused on the last API call. (Made synchronous again)
   */
  static calculateTokenStatisticsFromMessages(messages, systemPrompt = '') {
    let outputTokens = 0;
    let promptTokensInLastApiCall = 0;

    let historyTokensSentInLastApiCall = 0;
    let systemTokensInLastApiCall = 0;

    // Find indices of the last user and assistant messages
    let lastUserMsgIndex = -1;
    let lastAssistantMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && lastUserMsgIndex === -1) {
        lastUserMsgIndex = i;
      }
      if (messages[i].role === 'assistant' && lastAssistantMsgIndex === -1) {
        lastAssistantMsgIndex = i;
      }
      // Optimization: Stop if both are found
      if (lastUserMsgIndex !== -1 && lastAssistantMsgIndex !== -1) {
        break;
      }
    }

    // Process system prompt if present
    if (
      systemPrompt &&
      typeof systemPrompt === 'string' &&
      systemPrompt.trim().length > 0
    ) {
      const systemPromptTokensCount = this.estimateTokens(systemPrompt);

      // Assign tokens *only* from the initial system prompt provided.
      systemTokensInLastApiCall = systemPromptTokensCount;
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastApiCall here
    }

    // Process each message - needs await inside, so can't use forEach directly with async/await
    // Use a standard for...of loop or Promise.all if parallelization is desired (not needed here)
    for (const [index, msg] of messages.entries()) {
      if (msg.role === 'user') {
        // Sync estimateTokens
        const msgInputTokens =
          msg.inputTokens || this.estimateTokens(msg.content);

        // Determine if this is the most recent user prompt
        const isLastUserPrompt = index === lastUserMsgIndex;

        if (isLastUserPrompt) {
          // Assign tokens only for the message identified as the last user prompt.
          promptTokensInLastApiCall = msgInputTokens;
        } else {
          // Also add to history sent in last call if it's a USER message and not excluded
          if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
            // Add tokens from past user messages to history sent in the last call.
            historyTokensSentInLastApiCall += msgInputTokens;
          }
        }
      } else if (msg.role === 'assistant') {
        const msgOutputTokens =
          typeof msg.outputTokens === 'number'
            ? msg.outputTokens
            : this.estimateTokens(msg.content);
        // Calculate cumulative output tokens by summing output from all assistant messages.
        outputTokens += msgOutputTokens;

        // Add to history sent in last call if it's an ASSISTANT message and not excluded
        if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
          // Add tokens from past assistant messages to history sent in the last call.
          historyTokensSentInLastApiCall += msgOutputTokens;
        }
        // System messages (like errors) are not counted towards API call tokens.
        // Note: The initial system prompt is handled separately above.
      }
    } // End of for loop replacing forEach

    // Calculate total input tokens for the last API call by summing system, history sent, and last prompt tokens.
    const inputTokensInLastApiCall =
      (systemTokensInLastApiCall || 0) +
      (historyTokensSentInLastApiCall || 0) +
      (promptTokensInLastApiCall || 0);

    // Calculate output tokens for the last assistant message
    let outputTokensInLastApiCall = 0;
    if (lastAssistantMsgIndex !== -1) {
      const lastAssistantMsg = messages[lastAssistantMsgIndex];
      // Sync estimateTokens
      outputTokensInLastApiCall =
        lastAssistantMsg.outputTokens ||
        this.estimateTokens(lastAssistantMsg.content);
    }

    return {
      outputTokens,
      promptTokensInLastApiCall,
      historyTokensSentInLastApiCall,
      systemTokensInLastApiCall,
      inputTokensInLastApiCall,
      outputTokensInLastApiCall,
    };
  }

  /**
   * Clear token statistics for a tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    if (!tabId) return false;

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Remove stats for this tab
      delete allTokenStats[tabId];

      // Save updated stats
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats,
      });
      return true;
    } catch (error) {
      logger.sidebar.error(
        'TokenManagementService: Error clearing token statistics:',
        error
      );
      return false;
    }
  }

  /**
   * Calculate token statistics for a specific chat history
   * @param {number} tabId - Tab identifier
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
   * @param {number} [options.initialAccumulatedCost=0] - Starting cost for calculation (used in reruns).
   * @param {number} [options.initialOutputTokens=0] - Starting output tokens for calculation (used in reruns).
   * @returns {Promise<Object>} - Token statistics
   */
  static async calculateAndUpdateStatistics(
    tabId,
    messages,
    modelConfig = null,
    options = {}
  ) {
    logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: Called with:', { tabId, messages_length: messages?.length, modelConfig, options });
    if (!tabId) return this._getEmptyStats();

    let initialAccumulatedCost;
    let initialOutputTokens;

    // Determine initial values: use options if valid, otherwise fetch current stats
    if (
      typeof options.initialAccumulatedCost === 'number' &&
      options.initialAccumulatedCost >= 0 &&
      typeof options.initialOutputTokens === 'number' &&
      options.initialOutputTokens >= 0
    ) {
      initialAccumulatedCost = options.initialAccumulatedCost;
      initialOutputTokens = options.initialOutputTokens;
    } else {
      // Fetch currently stored statistics if options are not valid
      const currentStats = await this.getTokenStatistics(tabId);
      initialAccumulatedCost = currentStats.accumulatedCost || 0;
      initialOutputTokens = currentStats.outputTokens || 0;
    }
    logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: Initial stats:', { initialAccumulatedCost, initialOutputTokens });

    try {
      // 1. Get the actual system prompt string
      const systemPrompt = await ChatHistoryService.getSystemPrompt(tabId);

      // 3. Calculate base token statistics from messages (includes input/output tokens for last call)
      const baseStats = this.calculateTokenStatisticsFromMessages(
        messages,
        systemPrompt
      );
      logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: baseStats from messages:', baseStats);

      // 4. Calculate Cost of the Last Call
      let currentCallCost = 0;
      // Check if the last message indicates an error
      const lastMessage = messages[messages.length - 1];
      const isLastError =
        lastMessage && lastMessage.role === MESSAGE_ROLES.SYSTEM;

      if (modelConfig && !isLastError) {
        // Only calculate cost if modelConfig exists AND the last message wasn't an error
        // Use the specific input/output tokens for the *last call*
        const costInfo = this.calculateCost(
          baseStats.inputTokensInLastApiCall,
          baseStats.outputTokensInLastApiCall,
          modelConfig
        );
        currentCallCost = costInfo.totalCost || 0;
        logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: Calculated currentCallCost:', currentCallCost);
      }
      // If isLastError is true, currentCallCost remains 0 (its initial value)

      // 5. Calculate New Accumulated Cost using the initial value + cost of this specific call
      const newAccumulatedCost = initialAccumulatedCost + currentCallCost;

      // 6. Prepare Final Stats Object to Save (Explicitly matching _getEmptyStats structure)
      const finalStatsObject = {
        // Cumulative stats (use initial output tokens + tokens from this specific call)
        outputTokens:
          initialOutputTokens + (baseStats.outputTokensInLastApiCall || 0),
        accumulatedCost: newAccumulatedCost,

        // Last API call stats (from base calculation - these reflect ONLY the last call)
        promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
        historyTokensSentInLastApiCall:
          baseStats.historyTokensSentInLastApiCall || 0,
        systemTokensInLastApiCall: baseStats.systemTokensInLastApiCall || 0,
        inputTokensInLastApiCall: baseStats.inputTokensInLastApiCall || 0,
        outputTokensInLastApiCall: baseStats.outputTokensInLastApiCall || 0,
        lastApiCallCost: currentCallCost,
        isCalculated: true,
      };

      logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: finalStatsObject before saving:', finalStatsObject);
      // 7. Save the complete, updated statistics
      await this.updateTokenStatistics(tabId, finalStatsObject);

      logger.service.debug('[TokenDebug] TokenManagementService.calculateAndUpdateStatistics: Returning final stats:', finalStatsObject);
      // 8. Return the final statistics object
      return finalStatsObject;
    } catch (error) {
      logger.sidebar.error(
        'TokenManagementService: Error calculating token statistics:',
        error
      );
      return this._getEmptyStats();
    }
  }

  /**
   * Estimate tokens for a string using the gpt-tokenizer library.
   * @param {string} text - Input text
   * @returns {number} - Estimated token count (synchronous)
   */
  static estimateTokens(text) {
    // Made synchronous again
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return 0;
    }

    try {
      // Directly use the imported encode function
      const tokens = encode(text);
      return tokens.length;
    } catch (error) {
      logger.sidebar.error(
        'TokenManagementService: Error encoding text with gpt-tokenizer:',
        error
      );
      // Fallback on encoding error
      logger.sidebar.warn(
        'TokenManagementService: gpt-tokenizer encoding failed, falling back to char count.'
      );
      return Math.ceil(text.length / 4); // Fallback method: 1 token per 4 chars
    }
  }

  /**
   * Calculate pricing for token usage
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Object} - Pricing information
   */
  static calculateCost(inputTokens, outputTokens, modelConfig) {
    if (!modelConfig) return { totalCost: 0 };

    const inputPrice = modelConfig.inputTokenPrice || 0;
    const outputPrice = modelConfig.outputTokenPrice || 0;

    // Convert from price per million tokens
    const inputCost = (inputTokens / 1000000) * inputPrice;
    const outputCost = (outputTokens / 1000000) * outputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      inputTokenPrice: inputPrice,
      outputTokenPrice: outputPrice,
    };
  }

  /**
   * Extract pricing information from model configuration
   * @param {Object} modelConfig - Model configuration
   * @returns {Object|null} - Pricing information object or null
   */
  static getPricingInfo(modelConfig) {
    if (!modelConfig) return null;

    return {
      inputTokenPrice: modelConfig.inputTokenPrice,
      outputTokenPrice: modelConfig.outputTokenPrice,
    };
  }

  /**
   * Calculate context window usage status
   * @param {Object} tokenStats - Token usage statistics
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Object} - Context window status
   */
  static calculateContextStatus(tokenStats, modelConfig) {
    if (!tokenStats || !modelConfig || !modelConfig.contextWindow) {
      return {
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false,
      };
    }

    // Context window usage should be based on the total input tokens sent in the *last* API call,
    // as this represents the context the *next* call will potentially build upon.
    // Use inputTokensInLastApiCall which already includes system, history sent, and the last prompt.
    const totalTokensInContext = tokenStats.inputTokensInLastApiCall || 0;
    const contextWindow = modelConfig.contextWindow;
    const tokensRemaining = Math.max(0, contextWindow - totalTokensInContext);
    const percentage =
      contextWindow > 0 ? (totalTokensInContext / contextWindow) * 100 : 0;
    const exceeds = totalTokensInContext > contextWindow;

    // Determine warning level
    let warningLevel = 'none';
    if (percentage > 90) {
      warningLevel = 'critical';
    } else if (percentage > 75) {
      warningLevel = 'warning';
    } else if (percentage > 50) {
      warningLevel = 'notice';
    }

    return {
      warningLevel,
      percentage,
      tokensRemaining,
      exceeds,
      totalTokens: totalTokensInContext, // Return the context usage total
    };
  }

  /**
   * Create empty token statistics object
   * @private
   * @returns {Object} - Empty token statistics, focusing on last call details.
   */
  static _getEmptyStats() {
    return {
      // Cumulative stats
      outputTokens: 0,
      accumulatedCost: 0,

      // Last API call stats
      promptTokensInLastApiCall: 0,
      historyTokensSentInLastApiCall: 0,
      systemTokensInLastApiCall: 0,
      inputTokensInLastApiCall: 0,
      outputTokensInLastApiCall: 0,
      lastApiCallCost: 0,
      isCalculated: false,
    };
  }
}

export default TokenManagementService;
