// src/services/TokenCalculationService.js

/**
 * Service for managing token calculations and limits
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
    // This is a rough estimate; for production, consider using a tokenizer library
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
  calculateAvailableCompletionTokens(prompt, contextWindow, maxTokens, safetyBuffer = 50) {
    const estimatedPromptTokens = this.estimateTokens(prompt);
    const availableTokens = Math.max(0, contextWindow - estimatedPromptTokens - safetyBuffer);
    
    // Use the smaller of user-defined max or available tokens
    return Math.min(maxTokens, availableTokens);
  }

  /**
   * Get model configuration from platform config
   * @param {Object} platformConfig - Platform configuration object
   * @param {string} modelId - Model ID to lookup
   * @returns {Object|null} - Model configuration or null if not found
   */
  getModelConfig(platformConfig, modelIdOrObject) {
    if (!platformConfig?.api?.models) return null;
    
    // Extract ID if an object was passed
    const modelId = typeof modelIdOrObject === 'object' && modelIdOrObject !== null
      ? modelIdOrObject.id || modelIdOrObject.model || String(modelIdOrObject)
      : modelIdOrObject;
    
    // Find model in array of objects
    return platformConfig.api.models.find(model => model.id === modelId) || null;
  }
}

module.exports = new TokenCalculationService();