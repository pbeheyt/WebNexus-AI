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
  getModelConfig(platformConfig, modelId) {
    if (!platformConfig?.api?.models) return null;
    
    // Check if models is an array of objects or just an array of strings
    if (Array.isArray(platformConfig.api.models)) {
      // Handle array of objects (new format)
      if (typeof platformConfig.api.models[0] === 'object') {
        return platformConfig.api.models.find(model => model.id === modelId) || null;
      }
      
      // // Handle array of strings (old format)
      // if (platformConfig.api.models.includes(modelId)) {
      //   // Return default parameters for backward compatibility
      //   return {
      //     id: modelId,
      //     maxTokens: 4000,
      //     temperature: 0.7,
      //     topP: 1.0,
      //     parameterStyle: "standard",
      //     contextWindow: 8192
      //   };
      // }
    }
    
    return null;
  }
}

module.exports = new TokenCalculationService();