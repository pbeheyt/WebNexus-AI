// src/sidebar/services/TokenManagementService.js

import { get_encoding } from "tiktoken"; // Added tiktoken import
import { STORAGE_KEYS } from "../../shared/constants";
import ChatHistoryService from "./ChatHistoryService";

// Tiktoken encoder instance and loading state
let cl100k_base_encoding = null;
let isEncodingLoading = false;
let encodingPromise = null;

/**
 * Asynchronously gets the cl100k_base encoding instance.
 * Handles initialization and prevents multiple concurrent loads.
 * @private
 * @returns {Promise<object>} - A promise that resolves with the encoding instance.
 */
async function _getEncoder() {
  if (cl100k_base_encoding) {
    return cl100k_base_encoding;
  }
  if (isEncodingLoading) {
    return encodingPromise;
  }

  isEncodingLoading = true;
  encodingPromise = new Promise((resolve, reject) => {
    try {
      // Asynchronously initialize the encoder
      // Note: Depending on the tiktoken library's browser/WASM setup,
      // this might involve fetching WASM files.
      const encoding = get_encoding("cl100k_base");
      cl100k_base_encoding = encoding;
      isEncodingLoading = false;
      console.log("TokenManagementService: cl100k_base encoder loaded.");
      resolve(encoding);
    } catch (error) {
      console.error("TokenManagementService: Failed to load cl100k_base encoding:", error);
      isEncodingLoading = false;
      // Reject the promise so callers can handle the error
      reject(new Error("Failed to initialize tokenizer."));
    }
  });

  return encodingPromise;
}


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
   * @returns {Promise<Object>} - Token statistics focused on the last API call. (Now async)
   */
  static async calculateTokenStatisticsFromMessages(messages, systemPrompt = '') { // Made async

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
    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      // Use await as estimateTokens is now async
      const systemPromptTokensCount = await this.estimateTokens(systemPrompt);

      // Assign tokens *only* from the initial system prompt provided.
      systemTokensInLastApiCall = systemPromptTokensCount;
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastApiCall here
    }

    // Process each message - needs await inside, so can't use forEach directly with async/await
    // Use a standard for...of loop or Promise.all if parallelization is desired (not needed here)
    for (const [index, msg] of messages.entries()) {
      if (msg.role === 'user') {
        // Use await as estimateTokens is now async
        const msgInputTokens = msg.inputTokens || await this.estimateTokens(msg.content);

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
        // Use await as estimateTokens is now async
        const msgOutputTokens = typeof msg.outputTokens === 'number'
            ? msg.outputTokens
            : await this.estimateTokens(msg.content);
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
    const inputTokensInLastApiCall = (systemTokensInLastApiCall || 0) + (historyTokensSentInLastApiCall || 0) + (promptTokensInLastApiCall || 0);

    // Calculate output tokens for the last assistant message
    let outputTokensInLastApiCall = 0;
    if (lastAssistantMsgIndex !== -1) {
      const lastAssistantMsg = messages[lastAssistantMsgIndex];
      // Use await as estimateTokens is now async
      outputTokensInLastApiCall = lastAssistantMsg.outputTokens || await this.estimateTokens(lastAssistantMsg.content);
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
      // Use await as calculateTokenStatisticsFromMessages is now async
      const baseStats = await this.calculateTokenStatisticsFromMessages(messages, systemPrompt);

      // 4. Calculate Cost of the Last Call
      let currentCallCost = 0;
      if (modelConfig) {
        // Use the specific input/output tokens for the *last call*
        const costInfo = this.calculateCost(
          baseStats.inputTokensInLastApiCall,
          baseStats.outputTokensInLastApiCall,
          modelConfig
        );
        currentCallCost = costInfo.totalCost || 0;
      }

      // 5. Calculate New Accumulated Cost
      const newAccumulatedCost = existingAccumulatedCost + currentCallCost;

      // 6. Prepare Final Stats Object to Save (Explicitly matching _getEmptyStats structure)
      const finalStatsObject = {
        // Cumulative stats (take latest calculated/updated values)
        outputTokens: baseStats.outputTokens || 0,
        accumulatedCost: newAccumulatedCost,

        // Last API call stats (from base calculation)
        promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
        historyTokensSentInLastApiCall: baseStats.historyTokensSentInLastApiCall || 0,
        systemTokensInLastApiCall: baseStats.systemTokensInLastApiCall || 0,
        inputTokensInLastApiCall: baseStats.inputTokensInLastApiCall || 0,
        outputTokensInLastApiCall: baseStats.outputTokensInLastApiCall || 0,
        lastApiCallCost: currentCallCost,
        isCalculated: true
      };

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
   * Estimate tokens for a string using the tiktoken cl100k_base encoder.
   * @param {string} text - Input text
   * @returns {Promise<number>} - Estimated token count
   */
  static async estimateTokens(text) { // Made async
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return 0;
    }

    try {
      const encoder = await _getEncoder(); // Get the initialized encoder
      if (!encoder) {
        // Fallback if encoder failed to load
        console.warn("TokenManagementService: Encoder not available, falling back to char count.");
        return Math.ceil(text.length / 4);
      }
      const tokens = encoder.encode(text);
      // console.log(`Encoded "${text.substring(0, 30)}..." into ${tokens.length} tokens`);
      return tokens.length;
    } catch (error) {
      console.error("TokenManagementService: Error encoding text with tiktoken:", error);
      // Fallback on encoding error
      console.warn("TokenManagementService: Tiktoken encoding failed, falling back to char count.");
      return Math.ceil(text.length / 4);
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
      outputTokens: 0,
      accumulatedCost: 0,

      // Last API call stats
      promptTokensInLastApiCall: 0,
      historyTokensSentInLastApiCall: 0,
      systemTokensInLastApiCall: 0,
      inputTokensInLastApiCall: 0,
      outputTokensInLastApiCall: 0,
      lastApiCallCost: 0,
      isCalculated: false
    };
  }
}

export default TokenManagementService;
