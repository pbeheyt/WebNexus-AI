// src/services/TokenCalculationService.js

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
   * Calculate available completion tokens based on context window and prompt size
   * @param {string} prompt - The prompt text
   * @param {number} contextWindow - The model's context window size
   * @param {number} maxTokens - The user-defined max tokens
   * @param {number} safetyBuffer - Buffer tokens to account for estimation errors (default: 50)
   * @returns {number} - Available completion tokens
   */
  // calculateAvailableCompletionTokens(prompt, contextWindow, maxTokens, safetyBuffer = 50) {
  //   const estimatedPromptTokens = this.estimateTokens(prompt);
  //   const availableTokens = Math.max(0, contextWindow - estimatedPromptTokens - safetyBuffer);
    
  //   // Use the smaller of user-defined max or available tokens
  //   return Math.min(maxTokens, availableTokens);
  // }

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
   * @returns {Object} - Object with inputTokens, outputTokens, and totalCost
   */
  calculateConversationStats(messages, modelConfig) {
    if (!messages || !modelConfig) {
      return { inputTokens: 0, outputTokens: 0, totalCost: 0 };
    }
    
    // Sum up tokens from all messages
    const stats = messages.reduce(
      (acc, msg) => {
        acc.inputTokens += msg.inputTokens || 0;
        acc.outputTokens += msg.outputTokens || 0;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0 }
    );
    
    // Calculate total cost
    const totalCost = this.calculateCost(
      stats.inputTokens, 
      stats.outputTokens, 
      modelConfig
    );
    
    return {
      ...stats,
      totalCost
    };
  }
}

module.exports = new TokenCalculationService();