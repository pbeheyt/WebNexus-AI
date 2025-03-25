// src/services/TokenCalculationService.js

/**
 * Service for token calculation logic
 */
class TokenCalculationService {
  /**
   * Estimate tokens for a string
   * Uses a simple character-based approximation
   * @param {string} text - Input text
   * @returns {number} - Estimated token count
   */
  static estimateTokens(text) {
    if (!text) return 0;

    // Simple estimation based on characters
    // Most tokenizers average ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate pricing information for token counts
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Object} - Pricing information
   */
  static calculatePricing(inputTokens, outputTokens, modelConfig) {
    if (!modelConfig) {
      return { totalCost: 0 };
    }

    const inputPrice = modelConfig.inputTokenPrice || 0;
    const outputPrice = modelConfig.outputTokenPrice || 0;

    // Convert from price per 1000 tokens
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
   * Generate pricing information object for model config
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Object} - Pricing information for token metadata
   */
  static getPricingFromModelConfig(modelConfig) {
    if (!modelConfig) {
      return null;
    }

    return {
      inputTokenPrice: modelConfig.inputTokenPrice || 0,
      outputTokenPrice: modelConfig.outputTokenPrice || 0
    };
  }
}

module.exports = TokenCalculationService;