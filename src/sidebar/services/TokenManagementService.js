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
   * @returns {Object} - Token statistics focused on the last API call.
   */
  static calculateTokenStatisticsFromMessages(messages, systemPrompt = '') {
    // let inputTokens = 0; // REMOVED cumulative input tracking
    let outputTokens = 0; // Cumulative output is still needed
    let promptTokensInLastApiCall = 0; // RENAMED from promptTokens
    // let historyTokensTotal = 0; // REMOVED cumulative history tracking
    let historyTokensSentInLastApiCall = 0; // Keep as is
    let systemTokensInLastApiCall = 0; // RENAMED from systemTokens

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
      // inputTokens += systemPromptTokensCount; // REMOVED cumulative input
      systemTokensInLastApiCall = systemPromptTokensCount; // Assign to the specific RENAMED field
      // historyTokensTotal += systemPromptTokensCount; // REMOVED cumulative history
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastApiCall here
    }

    // Process each message
    messages.forEach((msg, index) => {
      // --- Removed cumulative inputTokens calculation ---
      // const msgTokens = msg.inputTokens || msg.outputTokens || this.estimateTokens(msg.content);
      // inputTokens += msgTokens;
      // --- End of removal ---

      // --- Keep logic for specific counters, renaming where needed ---
      if (msg.role === 'user') {
        const msgInputTokens = msg.inputTokens || this.estimateTokens(msg.content);
        // (cumulative inputTokens removed)

        // Determine if this is the most recent prompt or part of history
        // Check if it's the last message OR the second-to-last if the last is assistant
        // const isLastMessage = index === messages.length - 1;
        // const isSecondLastBeforeAssistant = index === messages.length - 2 && messages[messages.length - 1]?.role === 'assistant';

        // Determine if this is the most recent user prompt
        const isLastUserPrompt = index === lastUserMsgIndex;

        if (isLastUserPrompt) {
          promptTokensInLastApiCall = msgInputTokens; // Use RENAMED variable
          // Add to total history but NOT to history sent in last call
          // historyTokensTotal += msgInputTokens; // REMOVED cumulative history
        } else {
          // This is a past user message, add its tokens to total history
          // historyTokensTotal += msgInputTokens; // REMOVED cumulative history
          // Also add to history sent in last call if it's a USER message and not excluded
          if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
            historyTokensSentInLastApiCall += msgInputTokens; // Keep this calculation
          }
        }
      } else if (msg.role === 'assistant') {
        const msgOutputTokens = msg.outputTokens || this.estimateTokens(msg.content);
        // Calculate cumulative outputTokens (only for assistant messages)
        outputTokens += msgOutputTokens; // Keep cumulative output
        // (cumulative inputTokens removed)
        // Add assistant tokens to total history
        // historyTokensTotal += msgOutputTokens; // REMOVED cumulative history
        // Add to history sent in last call if it's an ASSISTANT message and not excluded
        if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
          historyTokensSentInLastApiCall += msgOutputTokens; // Keep this calculation
        }
      } else if (msg.role === 'system') {
        // System messages (like errors)
        // Note: The initial system prompt is handled separately above
        const msgSystemTokens = this.estimateTokens(msg.content);
        // (cumulative inputTokens removed)
        // Add to specific system token count (excluding initial prompt)
        // systemTokens += msgSystemTokens; // System messages (like errors) don't contribute to systemTokensInLastApiCall which is only the initial prompt
        // Add to total history context
        // historyTokensTotal += msgSystemTokens; // REMOVED cumulative history
        // DO NOT add system message tokens (like errors) to historyTokensSentInLastApiCall
        // if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
        //    historyTokensSentInLastApiCall += msgSystemTokens; // This line is removed/commented out
        // }
      }
    });

    // Calculate the input tokens specifically for the last API call (using RENAMED variables)
    const inputTokensInLastApiCall = (systemTokensInLastApiCall || 0) + (historyTokensSentInLastApiCall || 0) + (promptTokensInLastApiCall || 0);

    // Calculate output tokens for the last assistant message (calculation remains the same)
    let outputTokensInLastApiCall = 0; // Renamed for consistency
    if (lastAssistantMsgIndex !== -1) {
      const lastAssistantMsg = messages[lastAssistantMsgIndex];
      outputTokensInLastApiCall = lastAssistantMsg.outputTokens || this.estimateTokens(lastAssistantMsg.content);
    }

    // Return object matching the new structure defined in _getEmptyStats
    return {
      // Cumulative stats
      outputTokens, // Cumulative output tokens (KEEP)
      // accumulatedCost is calculated later

      // Last API call stats
      promptTokensInLastApiCall, // RENAMED
      historyTokensSentInLastApiCall, // Keep as is
      systemTokensInLastApiCall, // RENAMED
      inputTokensInLastApiCall, // Keep as is (represents total input sent)
      outputTokensInLastApiCall, // Keep as is (calculated above)
      // lastApiCallCost is calculated later

      // isCalculated is set later
    };
  }

  // The trackMessage function is removed as token tracking is now centralized
  // within calculateAndUpdateStatistics, called after each API interaction.

  // The updateAccumulatedCost function is removed as cost accumulation is handled
  // centrally within calculateAndUpdateStatistics.

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
      // 1. Get existing accumulated cost BEFORE calculating new stats
      const currentStats = await this.getTokenStatistics(tabId);
      const existingAccumulatedCost = currentStats.accumulatedCost || 0;

      // 2. Get the actual system prompt string
      const systemPrompt = await ChatHistoryService.getSystemPrompt(tabId);

      // 3. Calculate base token statistics from messages (includes input/output tokens for last call)
      const baseStats = this.calculateTokenStatisticsFromMessages(messages, systemPrompt);

      // 4. Calculate Cost of the Last Call
      let currentCallCost = 0;
      if (modelConfig) {
        // Use the specific input/output tokens for the *last call*
        const costInfo = this.calculateCost(
          baseStats.inputTokensInLastApiCall,
          baseStats.outputTokensInLastApiCall, // Use the newly calculated field
          modelConfig
        );
        currentCallCost = costInfo.totalCost || 0;
      }

      // 5. Calculate New Accumulated Cost
      const newAccumulatedCost = existingAccumulatedCost + currentCallCost;

      console.log('TokenManagementService: New accumulated cost:', newAccumulatedCost);
      console.log('TokenManagementService: Existing accumulated cost:', existingAccumulatedCost);
      console.log('TokenManagementService: Current call cost:', currentCallCost);

      // 6. Prepare Final Stats Object to Save (Explicitly matching _getEmptyStats structure)
      const finalStatsObject = {
        // Cumulative stats (take latest calculated/updated values)
        outputTokens: baseStats.outputTokens || 0, // Cumulative output from base calculation
        accumulatedCost: newAccumulatedCost, // Newly calculated cumulative cost

        // Last API call stats (from base calculation)
        promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
        historyTokensSentInLastApiCall: baseStats.historyTokensSentInLastApiCall || 0,
        systemTokensInLastApiCall: baseStats.systemTokensInLastApiCall || 0,
        inputTokensInLastApiCall: baseStats.inputTokensInLastApiCall || 0,
        outputTokensInLastApiCall: baseStats.outputTokensInLastApiCall || 0,
        lastApiCallCost: currentCallCost, // Newly calculated cost for this call

        // Status
        isCalculated: true // Mark as calculated
      };
      // No need to delete totalCost as we construct the object explicitly

      console.log('TokenManagementService: Final stats object:', finalStatsObject);

      // 7. Save the complete, updated statistics
      await this.updateTokenStatistics(tabId, finalStatsObject);

      // 8. Return the final statistics object
      return finalStatsObject;
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

    // Context window usage should be based on the total input tokens sent in the *last* API call,
    // as this represents the context the *next* call will potentially build upon.
    // Use inputTokensInLastApiCall which already includes system, history sent, and the last prompt.
    const totalTokensInContext = tokenStats.inputTokensInLastApiCall || 0;
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
   * @returns {Object} - Empty token statistics, focusing on last call details.
   */
  static _getEmptyStats() {
    return {
      // Cumulative stats
      outputTokens: 0, // Cumulative output tokens (KEEP)
      accumulatedCost: 0, // Cumulative cost (KEEP)

      // Last API call stats
      promptTokensInLastApiCall: 0, // RENAMED from promptTokens
      historyTokensSentInLastApiCall: 0, // Keep as is
      systemTokensInLastApiCall: 0, // RENAMED from systemTokens
      inputTokensInLastApiCall: 0, // Keep as is (represents total input sent)
      outputTokensInLastApiCall: 0, // Keep as is
      lastApiCallCost: 0, // Keep as is

      // Status
      isCalculated: false // Keep as is

      // REMOVED: inputTokens (cumulative)
      // REMOVED: historyTokens (cumulative)
      // REMOVED: totalCost (redundant with lastApiCallCost/accumulatedCost)
    };
  }
}

export default TokenManagementService;
