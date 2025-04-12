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
      const tabStats = allTokenStats[tabId] || {};

      // Return merged stats, ensuring all default fields are present
      return { ...this._getEmptyStats(), ...tabStats };
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
    let historyTokensTotal = 0; // Renamed for clarity
    let historyTokensSentInLastCall = 0; // Initialize counter for history EXCLUDING system prompt
    let systemTokens = 0; // Initialize systemTokens

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
    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      const systemPromptTokensCount = this.estimateTokens(systemPrompt);
      inputTokens += systemPromptTokensCount; // System prompt contributes to input
      systemTokens = systemPromptTokensCount; // Assign to the specific systemTokens field
      historyTokensTotal += systemPromptTokensCount; // System prompt is part of the total history context
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastCall here
    }

    // Process each message
    messages.forEach((msg, index) => {
      // --- Refactored inputTokens calculation ---
      // Calculate tokens for the current message, regardless of role
      const msgTokens = msg.inputTokens || msg.outputTokens || this.estimateTokens(msg.content);
      // Add these tokens to the main inputTokens accumulator
      inputTokens += msgTokens;
      // --- End of refactored inputTokens calculation ---

      // --- Keep original logic for other specific counters ---
      if (msg.role === 'user') {
        const msgInputTokens = msg.inputTokens || this.estimateTokens(msg.content);
        // (inputTokens already handled above)

        // Determine if this is the most recent prompt or part of history
        // Check if it's the last message OR the second-to-last if the last is assistant
        const isLastMessage = index === messages.length - 1;
        const isSecondLastBeforeAssistant = index === messages.length - 2 && messages[messages.length - 1]?.role === 'assistant';

        // Determine if this is the most recent user prompt
        const isLastUserPrompt = index === lastUserMsgIndex;

        if (isLastUserPrompt) {
          promptTokens = msgInputTokens;
          // Add to total history but NOT to history sent in last call
          historyTokensTotal += msgInputTokens;
        } else {
          // This is a past user message, add its tokens to total history
          historyTokensTotal += msgInputTokens;
          // Also add to history sent in last call if it's a USER message and not excluded
          if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
            historyTokensSentInLastCall += msgInputTokens;
          }
        }
      } else if (msg.role === 'assistant') {
        const msgOutputTokens = msg.outputTokens || this.estimateTokens(msg.content);
        // Calculate outputTokens (only for assistant messages)
        outputTokens += msgOutputTokens;
        // (inputTokens already handled above)
        // Add assistant tokens to total history
        historyTokensTotal += msgOutputTokens;
        // Add to history sent in last call if it's an ASSISTANT message and not excluded
        if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
          historyTokensSentInLastCall += msgOutputTokens;
        }
      } else if (msg.role === 'system') {
        // System messages (like errors)
        // Note: The initial system prompt is handled separately above
        const msgSystemTokens = this.estimateTokens(msg.content);
        // (inputTokens already handled above)
        // Add to specific system token count (excluding initial prompt)
        systemTokens += msgSystemTokens;
        // Add to total history context
        historyTokensTotal += msgSystemTokens;
        // DO NOT add system message tokens (like errors) to historyTokensSentInLastCall
        // if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
        //    historyTokensSentInLastCall += msgSystemTokens; // This line is removed/commented out
        // }
      }
    });

    // Calculate the input tokens specifically for the last API call
    const inputTokensInLastCall = (systemTokens || 0) + (historyTokensSentInLastCall || 0) + (promptTokens || 0);

    return {
      inputTokens, // Cumulative input for cost calculation
      outputTokens,
      promptTokens,
      historyTokens: historyTokensTotal, // Keep original name for external consistency (total history)
      historyTokensSentInLastCall,
      inputTokensInLastCall, // Add the new field for last call input
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
      historyTokensSentInLastCall: 0,
      inputTokensInLastCall: 0, // Added field for input tokens in the last call
      isCalculated: false
    };
  }
}

export default TokenManagementService;
