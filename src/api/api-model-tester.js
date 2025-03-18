// src/api/api-model-tester.js

/**
 * Utility for testing API models in a browser environment
 * Add this script to your API test page
 */

const ApiTestHarness = require('./api-test-utils');
const ModelManager = require('../services/ModelManager');
const CredentialManager = require('../services/CredentialManager');

class ApiModelTester {
  constructor() {
    this.testHarness = ApiTestHarness;
    this.modelManager = ModelManager;
    this.credentialManager = CredentialManager;
    this.providers = ['chatgpt', 'claude', 'gemini', 'mistral', 'deepseek', 'grok'];
    this.currentProvider = null;
    this.currentModel = null;
    this.testStatus = 'idle';
    this.testResults = null;
  }

  /**
   * Initialize the tester UI
   */
  async init() {
    console.log('Initializing API Model Tester...');
    this.renderUI();
    await this.populateProviders();
  }

  /**
   * Render the tester UI
   */
  renderUI() {
    const container = document.createElement('div');
    container.id = 'api-model-tester';
    container.innerHTML = `
      <h2>API Model Tester</h2>
      
      <div class="control-panel">
        <div class="form-group">
          <label for="provider-select">Provider:</label>
          <select id="provider-select">
            <option value="">-- Select Provider --</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="model-select">Model:</label>
          <select id="model-select" disabled>
            <option value="">-- Select Model --</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="content-type-select">Content Type:</label>
          <select id="content-type-select">
            <option value="general">General Web</option>
            <option value="youtube">YouTube</option>
            <option value="reddit">Reddit</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="test-prompt">Test Prompt:</label>
          <textarea id="test-prompt">Summarize this content briefly.</textarea>
        </div>
        
        <div class="button-group">
          <button id="test-model-btn" disabled>Test Selected Model</button>
          <button id="test-all-models-btn" disabled>Test All Models</button>
        </div>
      </div>
      
      <div class="results-panel">
        <h3>Test Results</h3>
        <div id="test-status">Status: Idle</div>
        <pre id="test-results"></pre>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Set up event listeners
    document.getElementById('provider-select').addEventListener('change', (e) => this.handleProviderChange(e.target.value));
    document.getElementById('model-select').addEventListener('change', (e) => this.handleModelChange(e.target.value));
    document.getElementById('test-model-btn').addEventListener('click', () => this.testSelectedModel());
    document.getElementById('test-all-models-btn').addEventListener('click', () => this.testAllModels());
  }

  /**
   * Populate provider dropdown
   */
  async populateProviders() {
    const select = document.getElementById('provider-select');
    
    // Clear existing options except the placeholder
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Add provider options
    for (const provider of this.providers) {
      const hasCredentials = await this.credentialManager.hasCredentials(provider);
      
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = `${provider}${hasCredentials ? '' : ' (no credentials)'}`;
      option.disabled = !hasCredentials;
      
      select.appendChild(option);
    }
  }

  /**
   * Handle provider selection change
   * @param {string} providerId - Selected provider ID
   */
  async handleProviderChange(providerId) {
    this.currentProvider = providerId;
    this.currentModel = null;
    
    const modelSelect = document.getElementById('model-select');
    const testModelBtn = document.getElementById('test-model-btn');
    const testAllModelsBtn = document.getElementById('test-all-models-btn');
    
    // Reset model dropdown
    modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
    modelSelect.disabled = !providerId;
    
    // Reset test buttons
    testModelBtn.disabled = true;
    testAllModelsBtn.disabled = !providerId;
    
    if (!providerId) {
      return;
    }
    
    try {
      // Update status
      this.updateStatus('loading', `Loading models for ${providerId}...`);
      
      // Get available models
      const models = await this.modelManager.getAvailableModels(providerId);
      const defaultModel = await this.modelManager.getDefaultModel(providerId);
      
      if (!models || models.length === 0) {
        this.updateStatus('error', `No models available for ${providerId}`);
        return;
      }
      
      // Populate model dropdown
      for (const model of models) {
        const option = document.createElement('option');
        // Handle both object models and string models for backward compatibility
        const modelId = typeof model === 'object' ? model.id : model;
        option.value = modelId;
        option.textContent = modelId + (modelId === defaultModel ? ' (default)' : '');
        option.selected = modelId === defaultModel;
        
        modelSelect.appendChild(option);
      }
      
      // Enable test all models button
      testAllModelsBtn.disabled = false;
      
      // Set current model to default if available
      if (defaultModel) {
        this.currentModel = defaultModel;
        testModelBtn.disabled = false;
      }
      
      this.updateStatus('idle', `${models.length} models available for ${providerId}`);
    } catch (error) {
      console.error('Error loading models:', error);
      this.updateStatus('error', `Error: ${error.message}`);
    }
  }

  /**
   * Handle model selection change
   * @param {string} modelId - Selected model ID
   */
  handleModelChange(modelId) {
    this.currentModel = modelId;
    document.getElementById('test-model-btn').disabled = !modelId;
  }

  /**
   * Test the selected model
   */
  async testSelectedModel() {
    if (!this.currentProvider || !this.currentModel) {
      this.updateStatus('error', 'No provider or model selected');
      return;
    }
    
    try {
      const contentType = document.getElementById('content-type-select').value;
      const prompt = document.getElementById('test-prompt').value;
      
      this.updateStatus('testing', `Testing ${this.currentModel} on ${this.currentProvider}...`);
      
      // Get API credentials
      const credentials = await this.credentialManager.getCredentials(this.currentProvider);
      if (!credentials) {
        throw new Error(`No credentials available for ${this.currentProvider}`);
      }
      
      // Update credentials with selected model
      const testCredentials = {
        ...credentials,
        model: this.currentModel
      };
      
      // Run the test
      const result = await this.testHarness.testWithMockData(this.currentProvider, {
        contentType,
        prompt,
        credentials: testCredentials
      });
      
      // Display results
      this.testResults = result;
      this.displayResults(result);
      
      this.updateStatus('complete', `Test completed successfully`);
    } catch (error) {
      console.error('Test error:', error);
      this.updateStatus('error', `Test error: ${error.message}`);
      
      this.testResults = {
        success: false,
        error: error.message,
        platformId: this.currentProvider,
        model: this.currentModel,
        timestamp: new Date().toISOString()
      };
      
      this.displayResults(this.testResults);
    }
  }

  /**
   * Test all models for the selected provider
   */
  async testAllModels() {
    if (!this.currentProvider) {
      this.updateStatus('error', 'No provider selected');
      return;
    }
    
    try {
      const contentType = document.getElementById('content-type-select').value;
      const prompt = document.getElementById('test-prompt').value;
      
      this.updateStatus('testing', `Testing all models on ${this.currentProvider}...`);
      
      // Run tests for all models
      const result = await this.testHarness.testProviderAllModels(this.currentProvider, {
        contentType,
        prompt
      });
      
      // Display results
      this.testResults = result;
      this.displayResults(result);
      
      this.updateStatus('complete', `Tested ${Object.keys(result.results).length} models`);
    } catch (error) {
      console.error('Test error:', error);
      this.updateStatus('error', `Test error: ${error.message}`);
      
      this.testResults = {
        success: false,
        error: error.message,
        platformId: this.currentProvider,
        timestamp: new Date().toISOString()
      };
      
      this.displayResults(this.testResults);
    }
  }

  /**
   * Update test status
   * @param {string} status - Status code
   * @param {string} message - Status message
   */
  updateStatus(status, message) {
    this.testStatus = status;
    const statusEl = document.getElementById('test-status');
    statusEl.textContent = `Status: ${message}`;
    statusEl.className = `status-${status}`;
  }

  /**
   * Display test results
   * @param {Object} results - Test results
   */
  displayResults(results) {
    const resultsEl = document.getElementById('test-results');
    resultsEl.textContent = JSON.stringify(results, null, 2);
  }
}

// Export the tester
window.ApiModelTester = new ApiModelTester();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ApiModelTester.init();
});