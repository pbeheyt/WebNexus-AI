// src/platforms/platform-factory.js
import { logger } from '../shared/logger.js';

import ChatGptPlatform from './implementations/chatgpt-platform.js';
import ClaudePlatform from './implementations/claude-platform.js';
import DeepSeekPlatform from './implementations/deepseek-platform.js';
import MistralPlatform from './implementations/mistral-platform.js';
import GeminiPlatform from './implementations/gemini-platform.js';
import GrokPlatform from './implementations/grok-platform.js';

/**
 * Factory to create the appropriate platform implementation
 */
class PlatformFactory {
  /**
   * Create the appropriate platform for the current page
   * @returns {BasePlatform|null} The platform instance or null if no platform matches
   */
  static createPlatform() {
    const platforms = [
      new ClaudePlatform(),
      new ChatGptPlatform(),
      new DeepSeekPlatform(),
      new MistralPlatform(),
      new GeminiPlatform(),
      new GrokPlatform(),
    ];

    // Find the first platform that matches the current URL
    return platforms.find((platform) => platform.isCurrentPlatform()) || null;
  }

  /**
   * Create a platform by ID regardless of current URL
   * @param {string} platformId - The platform ID to create
   * @returns {BasePlatform|null} The platform instance or null if platform ID not found
   */
  static createPlatformById(platformId) {
    switch (platformId.toLowerCase()) {
      case 'claude':
        return new ClaudePlatform();
      case 'chatgpt':
        return new ChatGptPlatform();
      case 'deepseek':
        return new DeepSeekPlatform();
      case 'mistral':
        return new MistralPlatform();
      case 'gemini':
        return new GeminiPlatform();
      case 'grok':
        return new GrokPlatform();
      default:
        logger.platform.error(`Unknown platform ID: ${platformId}`);
        return null;
    }
  }
}

export default PlatformFactory;
