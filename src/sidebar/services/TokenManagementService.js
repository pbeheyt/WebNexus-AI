// src/sidebar/services/TokenManagementService.js

import { STORAGE_KEYS } from "../../shared/constants";

/**
 * Service for token estimation, cost calculation, storage, and context window monitoring
 * Central authority for all token-related operations
 */
class TokenManagementService {
  static TOKEN_STATS_KEY = STORAGE_KEYS.TAB_TOKEN_STATISTICS || 'tabTokenStatistics';
  
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
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
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
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
      // Update stats for this tab
      allTokenStats[tabId] = {
        ...stats,
        lastUpdated: Date.now()
      };
      
      // Save all token statistics
      await chrome.storage.local.set({ [this.TOKEN_STATS_KEY]: allTokenStats });
      return true;
    } catch (error) {
      console.error('TokenManagementService: Error updating token statistics:', error);
      return false;
    }
  }
  
  /**
   * Calculate token statistics from chat history
   * @param {Array} messages - Chat messages
   * @param {string} systemPrompt - System prompt text
   * @returns {Object} - Token statistics
   */
  static calculateTokenStatisticsFromMessages(messages, systemPrompt = '') {
    let inputTokens = 0;
    let outputTokens = 0;
    let promptTokens = 0;
    let historyTokens = 0;
    let systemTokens = 0;
    
    // Process system prompt if present
    if (systemPrompt) {
      const systemPromptTokens = this.estimateTokens(systemPrompt);
      inputTokens += systemPromptTokens;
      systemTokens += systemPromptTokens;
    }
    
    // Process each message
    messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        // Use stored token count or estimate
        const msgTokens = msg.inputTokens || this.estimateTokens(msg.content);
        inputTokens += msgTokens;
        
        // Determine if this is the most recent prompt or part of history
        if (index === messages.length - 2 && messages.length > 1) {
          // Most recent user message before assistant response
          promptTokens = msgTokens;
        } else {
          historyTokens += msgTokens;
        }
      } else if (msg.role === 'assistant') {
        // Use stored token count or estimate
        outputTokens += msg.outputTokens || this.estimateTokens(msg.content);
      } else if (msg.role === 'system') {
        // System messages contribute to input tokens
        const msgTokens = this.estimateTokens(msg.content);
        inputTokens += msgTokens;
        systemTokens += msgTokens;
      }
    });
    
    return {
      inputTokens,
      outputTokens,
      promptTokens,
      historyTokens,
      systemTokens,
      totalCost: 0  // Calculated separately with model info
    };
  }
  
  /**
   * Get system prompt tokens for a tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<number>} - Token count for system prompt
   */
  static async getSystemPromptTokens(tabId) {
    try {
      if (!tabId) return 0;
      
      // Get system prompt for this tab
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_SYSTEM_PROMPTS]);
      const allTabSystemPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] || {};
      
      // Get system prompt for this tab
      const systemPrompt = allTabSystemPrompts[tabId];
      
      if (!systemPrompt || !systemPrompt.systemPrompt) return 0;
      
      // Estimate tokens for system prompt
      return this.estimateTokens(systemPrompt.systemPrompt);
    } catch (error) {
      console.error('TokenManagementService: Error getting system prompt tokens:', error);
      return 0;
    }
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
   * Clear token statistics for a tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    if (!tabId) return false;
    
    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
      // Remove stats for this tab
      delete allTokenStats[tabId];
      
      // Save updated stats
      await chrome.storage.local.set({ [this.TOKEN_STATS_KEY]: allTokenStats });
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
      // Get system prompt tokens
      const systemPromptTokens = await this.getSystemPromptTokens(tabId);
      
      // Calculate token statistics from messages
      const stats = this.calculateTokenStatisticsFromMessages(messages, '');
      
      // Add system prompt tokens
      stats.inputTokens += systemPromptTokens;
      stats.systemTokens += systemPromptTokens;
      
      // Calculate cost if model config is provided
      if (modelConfig) {
        const costInfo = this.calculateCost(stats.inputTokens, stats.outputTokens, modelConfig);
        stats.totalCost = costInfo.totalCost;
      }
      
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
   * Estimate tokens for a JSON object (serializes then counts)
   * @param {Object} object - Object to estimate tokens for
   * @returns {number} - Estimated token count
   */
  static estimateObjectTokens(object) {
    if (!object) return 0;
    try {
      const serialized = JSON.stringify(object);
      return this.estimateTokens(serialized);
    } catch (error) {
      console.warn('Error estimating object tokens', error);
      return 0;
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
    
    // Convert from price per million tokens (standard industry pricing)
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
      inputTokenPrice: modelConfig.inputTokenPrice || 0,
      outputTokenPrice: modelConfig.outputTokenPrice || 0
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
    
    const totalTokens = tokenStats.inputTokens + tokenStats.outputTokens;
    const contextWindow = modelConfig.contextWindow;
    const tokensRemaining = Math.max(0, contextWindow - totalTokens);
    const percentage = (totalTokens / contextWindow) * 100;
    const exceeds = totalTokens > contextWindow;
    
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
      totalTokens
    };
  }
  
  /**
   * Format conversation history as token countable structure
   * @param {Array} history - Conversation history
   * @returns {Object} - Token countable structure
   */
  static tokenizeConversationHistory(history) {
    if (!history || !Array.isArray(history) || history.length === 0) {
      return { tokens: 0, structure: [] };
    }
    
    const structure = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    return {
      tokens: this.estimateObjectTokens(structure),
      structure
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
      promptTokens: 0,
      historyTokens: 0,
      systemTokens: 0,
      isCalculated: false
    };
  }
}

export default TokenManagementService;