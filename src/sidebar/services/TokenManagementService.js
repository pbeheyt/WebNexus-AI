// src/sidebar/services/TokenManagementService.js

/**
 * Service for token estimation, cost calculation, and context window monitoring
 * This replaces the functionality of ApiTokenTracker but solely for the sidebar
 */
class TokenManagementService {
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
}

export default TokenManagementService;