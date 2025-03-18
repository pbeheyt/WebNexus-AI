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
const ModelManager = require('../services/ModelManager');

/**
 * Test suite for API services with mock content data
 */
class ApiTestHarness {
  /**
   * Create a new API test harness
   */
  constructor() {
    this.logger = this._createLogger();
    this.modelManager = ModelManager;
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
        success: result.success,
        model: credentials.model || 'default'
      });
      
      return result;
    } catch (error) {
      this.logger.error(`API test failed for ${service.platformId}`, error);
      throw error;
    }
  }
  
  /**
   * Test an API service with a specific model
   * @param {string|BaseApiService} apiService - API service or provider ID
   * @param {Object} options - Test options
   * @param {string} [options.model] - Specific model to test
   * @returns {Promise<Object>} Test result
   */
  async testWithModel(apiService, options = {}) {
    // Get service instance
    const service = typeof apiService === 'string' 
      ? this.getApiService(apiService) 
      : apiService;
    
    const platformId = service.platformId;
    
    try {
      // Get available models for this platform
      const availableModels = await this.modelManager.getAvailableModels(platformId);
      
      if (!availableModels || availableModels.length === 0) {
        throw new Error(`No models available for platform: ${platformId}`);
      }
      
      // Determine which model to test
      let modelToTest;
      
      if (options.model) {
        // Specific model requested
        modelToTest = options.model;
        
        // Check if model exists in available models
        if (!availableModels.includes(modelToTest)) {
          this.logger.warn(`Requested model ${modelToTest} not found in available models for ${platformId}. Available models: ${availableModels.join(', ')}`);
        }
      } else {
        // Use default model
        modelToTest = await this.modelManager.getDefaultModel(platformId);
        
        if (!modelToTest) {
          // If no default specified, use first available
          modelToTest = availableModels[0];
          this.logger.info(`No default model configured for ${platformId}, using first available: ${modelToTest}`);
        }
      }
      
      this.logger.info(`Testing with model: ${modelToTest} for platform: ${platformId}`);
      
      // Prepare credentials with model
      const credentials = {
        apiKey: options.apiKey || 'test-api-key',
        model: modelToTest
      };
      
      // Run test with these credentials
      const result = await this.testWithMockData(service, {
        ...options,
        credentials
      });
      
      return {
        ...result,
        testedModel: modelToTest
      };
    } catch (error) {
      this.logger.error(`Model testing error:`, error);
      throw error;
    }
  }
  
  /**
   * Test all available models for a platform
   * @param {string} platformId - Platform ID
   * @param {Object} [options] - Test options
   * @returns {Promise<Object>} Results for each model
   */
  async testAllModels(platformId, options = {}) {
    try {
      // Get available models
      const availableModels = await this.modelManager.getAvailableModels(platformId);
      
      if (!availableModels || availableModels.length === 0) {
        throw new Error(`No models available for platform: ${platformId}`);
      }
      
      this.logger.info(`Testing all ${availableModels.length} models for platform: ${platformId}`);
      
      // Test each model
      const results = {};
      for (const model of availableModels) {
        try {
          this.logger.info(`Testing model: ${model}`);
          
          results[model] = await this.testWithModel(platformId, {
            ...options,
            model
          });
        } catch (error) {
          this.logger.error(`Error testing model ${model}:`, error);
          
          results[model] = {
            success: false,
            error: error.message,
            model,
            platformId,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      return {
        platformId,
        timestamp: new Date().toISOString(),
        modelCount: availableModels.length,
        results
      };
    } catch (error) {
      this.logger.error(`Error testing all models:`, error);
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
        if (options.useModels) {
          // Test with preferred/default model
          results[provider] = await this.testWithModel(provider, options);
        } else {
          // Legacy test mode
          results[provider] = await this.testWithMockData(provider, options);
        }
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
   * Test a specific provider with all its models
   * @param {string} provider - Provider ID
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testProviderAllModels(provider, options = {}) {
    try {
      return await this.testAllModels(provider, options);
    } catch (error) {
      this.logger.error(`Error testing all models for ${provider}:`, error);
      return {
        success: false,
        error: error.message,
        platformId: provider,
        timestamp: new Date().toISOString()
      };
    }
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