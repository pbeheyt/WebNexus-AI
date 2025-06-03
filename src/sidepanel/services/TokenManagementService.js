// src/sidepanel/services/TokenManagementService.js

import { encode } from 'gpt-tokenizer';

import { logger } from '../../shared/logger';
import { STORAGE_KEYS, MESSAGE_ROLES } from '../../shared/constants';
import { createStructuredPromptString } from '../../shared/utils/prompt-formatting-utils.js';



/**
 * Service for token estimation, cost calculation, storage, and context window monitoring
 * Central authority for all token-related operations
 */
class TokenManagementService {
  /**
   * Get token statistics for a specific chat session
   * @param {string} chatSessionId - Chat session identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async getTokenStatistics(chatSessionId) {
    if (!chatSessionId) {
      logger.sidepanel.warn(
        'TokenManagementService: No chatSessionId provided for getTokenStatistics'
      );
      return this._getEmptyStats();
    }

    try {
      // Get all global chat token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};
      const sessionStats = allTokenStats[chatSessionId] || {};

      // Return merged stats, ensuring all default fields are present
      const mergedStats = { ...this._getEmptyStats(), ...sessionStats };
      return mergedStats;
    } catch (error) {
      logger.sidepanel.error(
        `TokenManagementService: Error getting token statistics for chat session ${chatSessionId}:`,
        error
      );
      return this._getEmptyStats();
    }
  }

  /**
   * Update token statistics for a specific chat session
   * @param {string} chatSessionId - Chat session identifier
   * @param {Object} stats - Token statistics to store
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(chatSessionId, stats) {
    if (!chatSessionId) return false;

    try {
      // Get all global chat token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};

      // Update stats for this session
      allTokenStats[chatSessionId] = {
        ...stats,
        lastUpdated: Date.now(),
      };

      // Save all token statistics
      await chrome.storage.local.set({
        [STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS]: allTokenStats,
      });
      return true;
    } catch (error) {
      logger.sidepanel.error(
        `TokenManagementService: Error updating token statistics for chat session ${chatSessionId}:`,
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
  static calculateTokenStatisticsFromMessages(messages, systemPromptText = '') {
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
      systemPromptText &&
      typeof systemPromptText === 'string' &&
      systemPromptText.trim().length > 0
    ) {
      const systemPromptTokensCount = this.estimateTokens(systemPromptText);

      // Assign tokens *only* from the initial system prompt provided.
      systemTokensInLastApiCall = systemPromptTokensCount;
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastApiCall here
    }

    // Process each message - needs await inside, so can't use forEach directly with async/await
    // Use a standard for...of loop or Promise.all if parallelization is desired (not needed here)
    for (const [index, msg] of messages.entries()) {
      if (msg.role === 'user') {
        // Sync estimateTokens
            let contentToEstimateForTokens;
            if (typeof msg.pageContextUsed === 'string' && msg.pageContextUsed.trim().length > 0) {
              // If pageContextUsed is present, use the shared utility to combine it with the main content for token estimation.
              contentToEstimateForTokens = createStructuredPromptString(msg.content, msg.pageContextUsed);
            } else {
              // Otherwise, just use the main content.
              contentToEstimateForTokens = msg.content;
            }
            // Estimate tokens based on the potentially combined content.
            // The original `msg.inputTokens` is not used here as we are re-calculating based on history structure.
            const msgInputTokens = this.estimateTokens(contentToEstimateForTokens);

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
        let msgTotalOutputTokens = 0;
        // Check if pre-calculated tokens exist and are valid
        if (typeof msg.outputTokens === 'number' && msg.outputTokens >= 0) {
          msgTotalOutputTokens = msg.outputTokens;
        } else {
          // Estimate if pre-calculated tokens are missing or invalid
          const contentTokens = this.estimateTokens(msg.content || '');
          const thinkingTokens = this.estimateTokens(msg.thinkingContent || ''); // Estimate thinking tokens
          msgTotalOutputTokens = contentTokens + thinkingTokens; // Sum both
        }

        // Calculate cumulative output tokens by summing output from all assistant messages.
        outputTokens += msgTotalOutputTokens;

        // Add to history sent in last call if it's an ASSISTANT message and not excluded
        if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
          // Add tokens from past assistant messages to history sent in the last call.
          historyTokensSentInLastApiCall += msgTotalOutputTokens;
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
      // Explicitly check if outputTokens is a number (even if 0)
      if (typeof lastAssistantMsg.outputTokens === 'number') {
        outputTokensInLastApiCall = lastAssistantMsg.outputTokens;
      } else {
        // Fallback to estimating both content and thinking content
        const contentTokens = this.estimateTokens(
          lastAssistantMsg.content || ''
        );
        const thinkingTokens = this.estimateTokens(
          lastAssistantMsg.thinkingContent || ''
        );
        outputTokensInLastApiCall = contentTokens + thinkingTokens;
      }
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
   * Clear token statistics for a chat session
   * @param {string} chatSessionId - Chat session identifier
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(chatSessionId) {
    if (!chatSessionId) return false;

    try {
      // Get all global chat token statistics
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
      ]);
      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};

      // Remove stats for this session
      delete allTokenStats[chatSessionId];

      // Save updated stats
      await chrome.storage.local.set({
        [STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS]: allTokenStats,
      });
      return true;
    } catch (error) {
      logger.sidepanel.error(
        `TokenManagementService: Error clearing token statistics for chat session ${chatSessionId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Calculate token statistics for a specific chat history
   * @param {string} chatSessionId - Chat session identifier
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
   * @param {number} [options.initialAccumulatedCost=0] - Starting cost for calculation (used in reruns).
   * @param {number} [options.initialOutputTokens=0] - Starting output tokens for calculation (used in reruns).
   * @param {boolean} [isThinkingModeEnabled=false] - Whether thinking mode is active
   * @returns {Promise<Object>} - Token statistics
   */
  static async calculateAndUpdateStatistics(
    chatSessionId,
    messages,
    // eslint-disable-next-line no-unused-vars
    modelConfig = null,
    options = {},
    // eslint-disable-next-line no-unused-vars
    isThinkingModeEnabled = false,
    systemPromptForThisTurn = null
  ) {
    if (!chatSessionId) return this._getEmptyStats();

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
      const currentStats = await this.getTokenStatistics(chatSessionId);
      initialAccumulatedCost = currentStats.accumulatedCost || 0;
      initialOutputTokens = currentStats.outputTokens || 0;
    }

    try {
      // 3. Calculate base token statistics from messages (includes input/output tokens for last call)
      const baseStats = this.calculateTokenStatisticsFromMessages(
        messages,
        systemPromptForThisTurn
      );

      // 4. Determine Last API Call Cost and New Accumulated Cost from message apiCost properties
      let newAccumulatedCost = initialAccumulatedCost; // Start with initial value for reruns/edits
      let lastApiCallCostValue = 0;

      // If not a rerun/edit (options are empty), reset initialAccumulatedCost to 0 before summing.
      // This ensures we sum costs from the *current* message list only for a fresh calculation.
      // For reruns, initialAccumulatedCost already reflects the state *before* the rerun.
      if (Object.keys(options).length === 0) {
          newAccumulatedCost = 0;
      }
      
      let cumulativeOutputTokens = initialOutputTokens;
      if (Object.keys(options).length === 0) {
          cumulativeOutputTokens = 0;
      }

      messages.forEach(msg => {
        if (msg.role === MESSAGE_ROLES.ASSISTANT && typeof msg.apiCost === 'number' && msg.apiCost >= 0) {
          // Only add if it's not part of the initialAccumulatedCost already accounted for by a rerun
          // This logic assumes 'messages' contains the full history for a fresh calculation,
          // or a truncated history for a rerun where initialAccumulatedCost covers prior messages.
          // For simplicity, if options are present (rerun), we assume initialAccumulatedCost is correct.
          // If no options, we sum all.
          if (Object.keys(options).length === 0) {
            newAccumulatedCost += msg.apiCost;
          }
          // Update lastApiCallCostValue if this is the most recent assistant message with a cost
          lastApiCallCostValue = msg.apiCost; 
        }
        if (msg.role === MESSAGE_ROLES.ASSISTANT && typeof msg.outputTokens === 'number' && msg.outputTokens >= 0) {
          if (Object.keys(options).length === 0) {
              cumulativeOutputTokens += msg.outputTokens;
          }
        }
      });

      // If it was a rerun, the newAccumulatedCost should be the initial cost + the cost of the *newly generated* message.
      // The newly generated message's cost is in lastApiCallCostValue if it's the last one.
      if (Object.keys(options).length > 0 && messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === MESSAGE_ROLES.ASSISTANT && typeof lastMessage.apiCost === 'number') {
              newAccumulatedCost = initialAccumulatedCost + lastMessage.apiCost;
              // For output tokens in reruns, it's initial + new message's output
              cumulativeOutputTokens = initialOutputTokens + (lastMessage.outputTokens || 0);
          } else {
              // If the last message wasn't an assistant message with a cost (e.g. error placeholder),
              // then accumulated cost doesn't change from initial for this "turn".
              // lastApiCallCostValue would be from the previous valid assistant message or 0.
          }
      }


      // 5. Prepare Final Stats Object to Save
      const finalStatsObject = {
        outputTokens: cumulativeOutputTokens, // This is the total output tokens for the session
        accumulatedCost: newAccumulatedCost,

        promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
        historyTokensSentInLastApiCall: baseStats.historyTokensSentInLastApiCall || 0,
        systemTokensInLastApiCall: baseStats.systemTokensInLastApiCall || 0,
        inputTokensInLastApiCall: baseStats.inputTokensInLastApiCall || 0,
        outputTokensInLastApiCall: baseStats.outputTokensInLastApiCall || 0, // Output for the very last assistant response
        lastApiCallCost: lastApiCallCostValue, // Cost of the very last assistant response
        isCalculated: true,
      };

      // 7. Save the complete, updated statistics
      await this.updateTokenStatistics(chatSessionId, finalStatsObject);

      // 8. Return the final statistics object
      return finalStatsObject;
    } catch (error) {
      logger.sidepanel.error(
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
      logger.sidepanel.error(
        // Corrected logger
        'TokenManagementService: Error encoding text with gpt-tokenizer:',
        error
      );
      // Fallback on encoding error
      logger.sidepanel.warn(
        // Corrected logger
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
   * @param {boolean} [isThinkingModeEnabled=false] - Whether thinking mode is active
   * @returns {Object} - Pricing information
   */
  static calculateCost(
    inputTokens,
    outputTokens,
    modelConfig,
    isThinkingModeEnabled = false
  ) {
    if (!modelConfig) return { totalCost: 0 };

    // Initialize with base prices
    let effectiveInputPrice = modelConfig?.pricing?.inputTokenPrice ?? 0;
    let effectiveOutputPrice = modelConfig?.pricing?.outputTokenPrice ?? 0;

    // Check for thinking mode overrides if applicable
    if (
      modelConfig?.thinking?.toggleable === true &&
      isThinkingModeEnabled === true
    ) {
      // Apply input price override if valid
      const overrideInputPrice = modelConfig.thinking.pricing?.inputTokenPrice;
      if (typeof overrideInputPrice === 'number' && overrideInputPrice >= 0) {
        effectiveInputPrice = overrideInputPrice;
      }

      // Apply output price override if valid
      const overrideOutputPrice =
        modelConfig.thinking.pricing?.outputTokenPrice;
      if (typeof overrideOutputPrice === 'number' && overrideOutputPrice >= 0) {
        effectiveOutputPrice = overrideOutputPrice;
      }
    }

    // Convert from price per million tokens
    const inputCost = (inputTokens / 1000000) * effectiveInputPrice;
    const outputCost = (outputTokens / 1000000) * effectiveOutputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      inputTokenPrice: effectiveInputPrice,
      outputTokenPrice: effectiveOutputPrice,
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
    if (!tokenStats || !modelConfig || !modelConfig.tokens.contextWindow) {
      return {
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false,
        totalTokens: 0,
        maxContextWindow: 0,
      };
    }

    const totalTokensInContext = tokenStats.inputTokensInLastApiCall || 0;
    const contextWindow = modelConfig.tokens.contextWindow;
    const tokensRemaining = Math.max(0, contextWindow - totalTokensInContext);
    const percentage =
      contextWindow > 0 ? (totalTokensInContext / contextWindow) * 100 : 0;
    const exceeds = totalTokensInContext > contextWindow;

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
      totalTokens: totalTokensInContext,
      maxContextWindow: contextWindow,
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
