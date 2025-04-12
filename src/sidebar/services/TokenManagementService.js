// src/sidebar/services/TokenManagementService.js

import { STORAGE_KEYS } from "../../shared/constants";
import ChatHistoryService from "./ChatHistoryService"; // Added import

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
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Return stats for this tab or empty object
      return allTokenStats[tabId] || this._getEmptyStats();
    } catch (error) {
      console.error('TokenManagementService: Error getting token statistics:', error);
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
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Update stats for this tab
      allTokenStats[tabId] = {
        ...stats,
        lastUpdated: Date.now()
      };

      // Save all token statistics
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats });
      return true;
    } catch (error) {
      console.error('TokenManagementService: Error updating token statistics:', error);
      return false;
    }
  }

  /**
   * Calculate token statistics from chat history
   * @param {Array} messages - Chat messages
   * @param {string} systemPrompt - System prompt text (optional)
   * @returns {Object} - Token statistics
   */
  static calculateTokenStatisticsFromMessages(messages, systemPrompt = '') {
    let inputTokens = 0;
    let outputTokens = 0;
    let promptTokens = 0;
    let historyTokens = 0;
    let systemTokens = 0; // Initialize systemTokens

    // Process system prompt if present
    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      const systemPromptTokens = this.estimateTokens(systemPrompt);
      inputTokens += systemPromptTokens; // System prompt contributes to input
      systemTokens = systemPromptTokens; // Assign to the specific systemTokens field
      historyTokens += systemPromptTokens; // System prompt is part of the history context
    }

    // Process each message
    messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        // Use stored token count or estimate
        const msgTokens = msg.inputTokens || this.estimateTokens(msg.content);
        inputTokens += msgTokens; // Add to total session input

        // Determine if this is the most recent prompt or part of history
        // Check if it's the last message OR the second-to-last if the last is assistant
        const isLastMessage = index === messages.length - 1;
        const isSecondLastBeforeAssistant = index === messages.length - 2 && messages[messages.length - 1]?.role === 'assistant';

        if (isLastMessage || isSecondLastBeforeAssistant) {
          // Most recent user message (potentially waiting for response, or the one before the last response)
          promptTokens = msgTokens;
          // Do NOT add the current prompt tokens to historyTokens
        } else {
          // This is a past user message, add its tokens to history
          historyTokens += msgTokens;
        }
      } else if (msg.role === 'assistant') {
        // Use stored token count or estimate
        const assistantTokens = msg.outputTokens || this.estimateTokens(msg.content);
        outputTokens += assistantTokens; // Add to total session output
        // *** CORRECTED LOGIC: Add assistant tokens to historyTokens ***
        historyTokens += assistantTokens;
      } else if (msg.role === 'system') {
        // System messages (like errors) contribute to input tokens and history
        // Note: The initial system prompt is handled above
        const msgTokens = this.estimateTokens(msg.content);
        inputTokens += msgTokens; // Add to total session input
        systemTokens += msgTokens; // Add to specific system token count
        historyTokens += msgTokens; // Add to history context
      }
    });

    return {
      inputTokens,
      outputTokens,
      promptTokens,
      historyTokens,
      systemTokens,
      totalCost: 0,  // Calculated separately with model info
      accumulatedCost: 0  // Will be set from stored value
    };
  }

  /**
   * Track tokens for a message
   * @param {number} tabId - Tab identifier
   * @param {Object} message - Message to track
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<boolean>} - Success status
   */
  static async trackMessage(tabId, message, modelConfig) {
    if (!tabId || !message) return false;

    try {
      // Get current token statistics
      const stats = await this.getTokenStatistics(tabId);

      // Update token counts based on message role
      if (message.role === 'user') {
        const inputTokens = message.inputTokens || this.estimateTokens(message.content);
        stats.inputTokens += inputTokens;
        stats.promptTokens = inputTokens;  // Latest prompt
      } else if (message.role === 'assistant') {
        const outputTokens = message.outputTokens || this.estimateTokens(message.content);
        stats.outputTokens += outputTokens;
      } else if (message.role === 'system') {
        const systemTokens = this.estimateTokens(message.content);
        stats.inputTokens += systemTokens;
        stats.systemTokens += systemTokens;
      }

      // Calculate cost if model config is provided
      if (modelConfig) {
        const costInfo = this.calculateCost(stats.inputTokens, stats.outputTokens, modelConfig);
        stats.totalCost = costInfo.totalCost;
      }

      // Save updated stats
      return this.updateTokenStatistics(tabId, stats);
    } catch (error) {
      console.error('TokenManagementService: Error tracking message:', error);
      return false;
    }
  }

  /**
   * Update accumulated cost by adding a new cost value
   * @param {number} tabId - Tab identifier
   * @param {number} additionalCost - Cost to add to accumulated total
   * @returns {Promise<boolean>} - Success status
   */
  static async updateAccumulatedCost(tabId) {
    if (!tabId) return false;

    try {
      // Get current token statistics
      const stats = await this.getTokenStatistics(tabId);
      const totalCost = stats.totalCost || 0;
      stats.accumulatedCost = (stats.accumulatedCost || 0) + totalCost;
      // Save updated stats
      return this.updateTokenStatistics(tabId, stats);
    } catch (error) {
      console.error('TokenManagementService: Error updating accumulated cost:', error);
      return false;
    }
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
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Remove stats for this tab
      delete allTokenStats[tabId];

      // Save updated stats
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats });
      return true;
    } catch (error) {
      console.error('TokenManagementService: Error clearing token statistics:', error);
      return false;
    }
  }

  /**
   * Calculate token statistics for a specific chat history
   * @param {number} tabId - Tab identifier
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Token statistics
   */
  static async calculateAndUpdateStatistics(tabId, messages, modelConfig = null) {
    if (!tabId) return this._getEmptyStats();

    try {
      // Get the actual system prompt string
      const systemPrompt = await ChatHistoryService.getSystemPrompt(tabId); // Use ChatHistoryService

      // Calculate token statistics from messages, passing the system prompt
      const stats = this.calculateTokenStatisticsFromMessages(messages, systemPrompt); // Pass systemPrompt

      // Calculate cost if model config is provided
      if (modelConfig) {
        const costInfo = this.calculateCost(stats.inputTokens, stats.outputTokens, modelConfig);
        stats.totalCost = costInfo.totalCost;
      }

      // Retrieve existing accumulated cost to preserve it
      const currentStats = await this.getTokenStatistics(tabId);
      stats.accumulatedCost = currentStats.accumulatedCost || 0;

      // Save updated stats
      await this.updateTokenStatistics(tabId, stats);

      return stats;
    } catch (error) {
      console.error('TokenManagementService: Error calculating token statistics:', error);
      return this._getEmptyStats();
    }
  }

  /**
   * Estimate tokens for a string using character-based approximation
   * @param {string} text - Input text
   * @returns {number} - Estimated token count
   */
  static estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Approx 4 chars per token
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
      outputTokenPrice: outputPrice
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
      outputTokenPrice: modelConfig.outputTokenPrice
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
        exceeds: false
      };
    }

    // Context window usage should be based on history + system + current prompt
    // The totalTokens calculation should reflect what's sent to the API
    // historyTokens now correctly includes past user AND assistant messages + initial system prompt
    // promptTokens is the current user prompt
    const totalTokensInContext = tokenStats.historyTokens + tokenStats.promptTokens;
    const contextWindow = modelConfig.contextWindow;
    const tokensRemaining = Math.max(0, contextWindow - totalTokensInContext);
    const percentage = contextWindow > 0 ? (totalTokensInContext / contextWindow) * 100 : 0;
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
      totalTokens: totalTokensInContext // Return the context usage total
    };
  }

  /**
   * Create empty token statistics object
   * @private
   * @returns {Object} - Empty token statistics
   */
  static _getEmptyStats() {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      accumulatedCost: 0,
      promptTokens: 0,
      historyTokens: 0,
      systemTokens: 0,
      isCalculated: false
    };
  }
}

export default TokenManagementService;