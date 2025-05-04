// src/api/api-factory.js

import ChatGptApiService from './implementations/chatgpt-api.js';
import ClaudeApiService from './implementations/claude-api.js';
import GeminiApiService from './implementations/gemini-api.js';
import MistralApiService from './implementations/mistral-api.js';
import DeepSeekApiService from './implementations/deepseek-api.js';
import GrokApiService from './implementations/grok-api.js';

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

export default ApiFactory;
