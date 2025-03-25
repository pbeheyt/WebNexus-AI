/**
 * Service for managing token calculations, limits, and cost estimation
 */
class TokenCalculationService {
  /**
   * Estimate token count for a given text string
   * @param {string} text - The text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // Simple approximation: 1 token ≈ 4 characters for English text
    const characterCount = text.length;
    return Math.ceil(characterCount / 4);
  }

  /**
   * Calculate cost for specific token counts based on model pricing
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {Object} modelConfig - Model configuration with pricing info
   * @returns {number} - Calculated cost in USD
   */
  calculateCost(inputTokens, outputTokens, modelConfig) {
    if (!modelConfig) return 0;
    
    // Extract pricing from model config
    const inputPrice = modelConfig.inputTokenPrice || 0;
    const outputPrice = modelConfig.outputTokenPrice || 0;
    
    // Calculate cost - prices are per million tokens
    const inputCost = (inputTokens * inputPrice) / 1_000_000;
    const outputCost = (outputTokens * outputPrice) / 1_000_000;
    
    return inputCost + outputCost;
  }

  /**
   * Calculate total tokens and cost for a conversation
   * @param {Array} messages - Array of messages with inputTokens and outputTokens properties
   * @param {Object} modelConfig - Model configuration with pricing info
   * @param {number} extractedContentTokens - Additional tokens from extracted content
   * @returns {Object} - Object with inputTokens, outputTokens, totalTokens, and totalCost
   */
  calculateConversationStats(messages, modelConfig, extractedContentTokens = 0) {
    if (!messages || !modelConfig) {
      return { 
        inputTokens: extractedContentTokens, 
        outputTokens: 0, 
        totalTokens: extractedContentTokens,
        totalCost: 0 
      };
    }
    
    // Sum up tokens from all messages
    const stats = messages.reduce(
      (acc, msg) => {
        acc.inputTokens += msg.inputTokens || 0;
        acc.outputTokens += msg.outputTokens || 0;
        return acc;
      },
      { inputTokens: extractedContentTokens, outputTokens: 0 }
    );
    
    // Calculate total tokens
    stats.totalTokens = stats.inputTokens + stats.outputTokens;
    
    // Calculate total cost
    stats.totalCost = this.calculateCost(
      stats.inputTokens, 
      stats.outputTokens, 
      modelConfig
    );
    
    return stats;
  }

  /**
   * Evaluate context window usage and determine warning level
   * @param {number} totalTokens - Total tokens in conversation
   * @param {number} contextWindow - Model's context window size
   * @returns {Object} - Context status with usage information and warning level
   */
  evaluateContextUsage(totalTokens, contextWindow) {
    if (!contextWindow || contextWindow <= 0) {
      return {
        percentage: 0,
        exceeds: false,
        warningLevel: 'none',
        tokensRemaining: 0,
        totalTokens,
        contextWindow
      };
    }

    const percentage = (totalTokens / contextWindow) * 100;
    const tokensRemaining = Math.max(0, contextWindow - totalTokens);
    
    // Strict boundary check
    const exceeds = totalTokens >= contextWindow;
    
    // Progressive warning levels for UI feedback
    let warningLevel = 'none';
    if (exceeds) {
      warningLevel = 'critical';
    } else if (percentage >= 90) {
      warningLevel = 'warning';
    } else if (percentage >= 75) {
      warningLevel = 'notice';
    }
    
    return {
      percentage,
      exceeds,
      warningLevel,
      tokensRemaining,
      totalTokens,
      contextWindow
    };
  }
}

module.exports = new TokenCalculationService();