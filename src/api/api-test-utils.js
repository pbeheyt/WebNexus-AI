/**
 * API testing utilities for bypassing content extraction
 * @module api-test-utils
 */

// Import API implementations
const ChatGptApiService = require('./implementations/chatgpt-api');
const ClaudeApiService = require('./implementations/claude-api');
const GeminiApiService = require('./implementations/gemini-api');
const MistralApiService = require('./implementations/mistral-api');
const DeepSeekApiService = require('./implementations/deepseek-api');
const GrokApiService = require('./implementations/grok-api');

/**
 * Test suite for API services with mock content data
 */
class ApiTestHarness {
  /**
   * Create a new API test harness
   */
  constructor() {
    this.logger = this._createLogger();
    this.mockDataFactory = {
      general: {
        contentType: 'general',
        pageTitle: 'API Test Page',
        pageUrl: 'https://lenvie-des-mets.fr/info',
        content: 'This is test content for API integration testing.',
        isSelection: false
      },
      youtube: {
        contentType: 'youtube',
        videoTitle: 'Test YouTube Video',
        channelName: 'Test Channel',
        videoId: 'test123abc',
        videoDescription: 'This is a test description',
        transcript: 'This is a test transcript',
        comments: [
          { author: 'User1', text: 'Great video!', likes: 10 },
          { author: 'User2', text: 'Very informative', likes: 5 }
        ]
      },
      reddit: {
        contentType: 'reddit',
        postTitle: 'Test Reddit Post',
        postContent: 'This is test content',
        postAuthor: 'TestUser',
        postUrl: 'https://reddit.com/r/test/123',
        subreddit: 'test',
        comments: [
          { author: 'Commenter1', content: 'Interesting post', popularity: 15, permalink: '/comment1' },
          { author: 'Commenter2', content: 'I agree', popularity: 7, permalink: '/comment2' }
        ]
      },
      // Add more mock data types as needed
    };
  }

  /**
   * Get an instance of the specified API service
   * @param {string} provider - API provider ID
   * @returns {BaseApiService} API service instance
   */
  getApiService(provider) {
    switch(provider) {
      case 'chatgpt': return new ChatGptApiService();
      case 'claude': return new ClaudeApiService();
      case 'gemini': return new GeminiApiService();
      case 'mistral': return new MistralApiService();
      case 'deepseek': return new DeepSeekApiService();
      case 'grok': return new GrokApiService();
      default:
        throw new Error(`Unknown API provider: ${provider}`);
    }
  }

  /**
   * Test an API service with mock content data
   * @param {BaseApiService|string} apiService - API service instance or provider ID
   * @param {Object} options - Test options
   * @param {string} [options.contentType='general'] - Type of mock content
   * @param {string} [options.prompt='Summarize this content briefly.'] - Test prompt
   * @param {Object} [options.credentials] - API credentials
   * @returns {Promise<Object>} API response
   */
  async testWithMockData(apiService, options = {}) {
    // Allow passing provider ID or service instance
    const service = typeof apiService === 'string' 
      ? this.getApiService(apiService) 
      : apiService;
    
    const {
      contentType = 'general',
      prompt = 'Summarize this content briefly.',
      credentials = { apiKey: 'test-api-key' }
    } = options;
    
    try {
      this.logger.info(`Testing ${service.platformId} API with mock ${contentType} content`);
      
      // Get mock data for the specified content type
      const mockContentData = this.mockDataFactory[contentType];
      if (!mockContentData) {
        throw new Error(`No mock data available for content type: ${contentType}`);
      }
      
      // Initialize the API service
      await service.initialize(credentials);
      
      // Process with mock data
      const result = await service.process(mockContentData, prompt);
      
      this.logger.info(`API test completed for ${service.platformId}`, { 
        success: result.success 
      });
      
      return result;
    } catch (error) {
      this.logger.error(`API test failed for ${service.platformId}`, error);
      throw error;
    }
  }
  
  /**
   * Run tests for all API providers
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results for all providers
   */
  async testAllProviders(options = {}) {
    const providers = ['chatgpt', 'claude', 'gemini', 'mistral', 'deepseek', 'grok'];
    const results = {};
    
    for (const provider of providers) {
      try {
        results[provider] = await this.testWithMockData(provider, options);
      } catch (error) {
        results[provider] = { 
          success: false, 
          error: error.message,
          platformId: provider,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return results;
  }
  
  /**
   * Create a logger instance
   * @returns {Object} Logger object
   */
  _createLogger() {
    return {
      info: (message, data = null) => console.log(`[api-test] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[api-test] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[api-test] ERROR: ${message}`, data || '')
    };
  }
}

module.exports = new ApiTestHarness();