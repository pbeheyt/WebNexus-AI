// src/utils/api-test-util.js

/**
 * Utility to test API integration
 */
class ApiTester {
  /**
   * Test API integration for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object>} Test result
   */
  static async testApiIntegration(platformId) {
    try {
      console.log(`Testing API integration for ${platformId}...`);
      
      // Import required modules
      const ApiFactory = require('../api/api-factory');
      const CredentialManager = require('../services/CredentialManager');
      
      // Get credentials
      const credentials = await CredentialManager.getCredentials(platformId);
      if (!credentials) {
        return {
          success: false,
          message: `No API credentials found for ${platformId}`
        };
      }
      
      // Create API service
      const apiService = ApiFactory.createApiService(platformId);
      if (!apiService) {
        return {
          success: false,
          message: `API service not available for ${platformId}`
        };
      }
      
      // Initialize API service
      await apiService.initialize(credentials);
      
      // Make test request
      const testContent = {
        contentType: 'general',
        pageTitle: 'API Test Page',
        pageUrl: 'https://lenvie-des-mets.fr/info',
        content: 'This is a test page content for API integration testing.'
      };
      
      const testPrompt = 'Summarize this content in 1-2 sentences.';
      
      console.log('Making test request...');
      const result = await apiService.process(testContent, testPrompt);
      
      console.log('API test result:', result);
      return {
        success: result.success,
        message: result.success ? 'API integration test successful' : `API test failed: ${result.error}`,
        result
      };
    } catch (error) {
      console.error('API test error:', error);
      return {
        success: false,
        message: `API test error: ${error.message}`
      };
    }
  }
}

module.exports = ApiTester;