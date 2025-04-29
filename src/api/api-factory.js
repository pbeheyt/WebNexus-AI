// src/api/api-factory.js

const BaseApiService = require('./api-base');
const ChatGptApiService = require('./implementations/chatgpt-api');
const ClaudeApiService = require('./implementations/claude-api');
const GeminiApiService = require('./implementations/gemini-api');
const MistralApiService = require('./implementations/mistral-api');
const DeepSeekApiService = require('./implementations/deepseek-api');
const GrokApiService = require('./implementations/grok-api');

/**
 * Factory class for creating API service instances
 */
class ApiFactory {
  /**
   * Create an API service instance for the specified platform
   * @param {string} platformId - Platform identifier (e.g., 'chatgpt', 'claude')
   * @returns {BaseApiService} API service instance
   * @throws {Error} If platform is not supported
   */
  static createApiService(platformId) {
    switch (platformId.toLowerCase()) {
      case 'chatgpt':
        return new ChatGptApiService();
      case 'claude':
        return new ClaudeApiService();
      case 'gemini':
        return new GeminiApiService();
      case 'mistral':
        return new MistralApiService();
      case 'deepseek':
        return new DeepSeekApiService();
      case 'grok':
        return new GrokApiService();
      default:
        throw new Error(`Unsupported API platform: ${platformId}`);
    }
  }
}

module.exports = ApiFactory;
