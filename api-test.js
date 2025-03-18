document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
          const tabId = tab.dataset.tab;
          
          // Update active tab
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Show active content
          document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
          });
          document.getElementById(tabId).classList.add('active');
      });
  });

  // Get DOM elements
  const platformSelect = document.getElementById('platform-select');
  const testPlatformSelect = document.getElementById('test-platform-select');
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const testPromptInput = document.getElementById('test-prompt');
  const resultContainer = document.getElementById('result-container');

  // Initialize models for selected platform
  updateModelOptions(platformSelect.value);
  platformSelect.addEventListener('change', () => {
      updateModelOptions(platformSelect.value);
  });
  
  testPlatformSelect.addEventListener('change', () => {
      // Load any stored credentials for the selected platform
      sendMessage({
          action: 'credentialOperation',
          operation: 'get',
          platformId: testPlatformSelect.value
      }).then(response => {
          if (response.success && response.credentials) {
              logInfo(`Loaded credentials for ${testPlatformSelect.value}`);
          }
      });
  });

  // Button event listeners - Credentials Tab
  document.getElementById('store-btn').addEventListener('click', storeCredentials);
  document.getElementById('get-btn').addEventListener('click', getStoredCredentials);
  document.getElementById('remove-btn').addEventListener('click', removeCredentials);
  document.getElementById('validate-btn').addEventListener('click', validateCredentials);

  // Button event listeners - API Test Tab
  document.getElementById('run-test-btn').addEventListener('click', runApiTest);
  document.getElementById('check-available-btn').addEventListener('click', checkApiAvailability);
  document.getElementById('get-models-btn').addEventListener('click', getAvailableModels);

  // Button event listeners - Batch Test Tab
  document.getElementById('test-all-btn').addEventListener('click', testAllPlatforms);
  document.getElementById('get-all-credentials-btn').addEventListener('click', getAllCredentials);
  document.getElementById('check-config-btn').addEventListener('click', checkPlatformConfig);

  // Clear results button
  document.getElementById('clear-results-btn').addEventListener('click', () => {
      resultContainer.innerHTML = '';
  });

  // Helper function to update model options based on selected platform
  function updateModelOptions(platformId) {
      // Clear current options
      modelSelect.innerHTML = '';
      
      // Load models from platform-config.json
      fetch(chrome.runtime.getURL('platform-config.json'))
          .then(response => response.json())
          .then(config => {
              const platform = config.aiPlatforms[platformId];
              if (platform && platform.api && platform.api.models) {
                  // Add model options
                  platform.api.models.forEach(model => {
                      const option = document.createElement('option');
                      option.value = model;
                      option.textContent = model;
                      modelSelect.appendChild(option);
                  });
                  
                  // Select default model if defined
                  if (platform.api.defaultModel) {
                      modelSelect.value = platform.api.defaultModel;
                  }
                  
                  logInfo(`Loaded ${platform.api.models.length} models for ${platformId}`);
              } else {
                  logError(`No models found for ${platformId}`);
              }
          })
          .catch(error => {
              logError(`Error loading models: ${error.message}`);
          });
  }

  // Function to store credentials
  function storeCredentials() {
      const platformId = platformSelect.value;
      const apiKey = apiKeyInput.value.trim();
      const model = modelSelect.value;
      
      if (!apiKey) {
          logError('API key cannot be empty');
          return;
      }
      
      logInfo(`Storing credentials for ${platformId}...`);
      
      sendMessage({
          action: 'credentialOperation',
          operation: 'store',
          platformId,
          credentials: {
              apiKey,
              model
          }
      }).then(response => {
          if (response.success) {
              logSuccess(`Credentials stored successfully for ${platformId}`);
          } else {
              logError(`Failed to store credentials: ${response.error}`);
          }
      });
  }

  // Function to get stored credentials
  function getStoredCredentials() {
      const platformId = platformSelect.value;
      
      logInfo(`Getting credentials for ${platformId}...`);
      
      sendMessage({
          action: 'credentialOperation',
          operation: 'get',
          platformId
      }).then(response => {
          if (response.success && response.credentials) {
              logSuccess(`Retrieved credentials for ${platformId}`);
              logInfo(`API Key: ${maskApiKey(response.credentials.apiKey)}`);
              logInfo(`Model: ${response.credentials.model}`);
              
              // Update the UI with the retrieved credentials
              apiKeyInput.value = response.credentials.apiKey;
              if (response.credentials.model) {
                  // Check if the model exists in the dropdown
                  const modelExists = Array.from(modelSelect.options)
                      .some(option => option.value === response.credentials.model);
                  
                  if (modelExists) {
                      modelSelect.value = response.credentials.model;
                  } else {
                      // Add the model if it doesn't exist
                      const option = document.createElement('option');
                      option.value = response.credentials.model;
                      option.textContent = response.credentials.model;
                      modelSelect.appendChild(option);
                      modelSelect.value = response.credentials.model;
                  }
              }
          } else {
              logInfo(`No credentials found for ${platformId}`);
          }
      });
  }

  // Function to remove credentials
  function removeCredentials() {
      const platformId = platformSelect.value;
      
      logInfo(`Removing credentials for ${platformId}...`);
      
      sendMessage({
          action: 'credentialOperation',
          operation: 'remove',
          platformId
      }).then(response => {
          if (response.success) {
              logSuccess(`Credentials removed for ${platformId}`);
              apiKeyInput.value = '';
          } else {
              logError(`Failed to remove credentials: ${response.error}`);
          }
      });
  }

  // Function to validate credentials
  function validateCredentials() {
      const platformId = platformSelect.value;
      const apiKey = apiKeyInput.value.trim();
      const model = modelSelect.value;
      
      if (!apiKey) {
          logError('API key cannot be empty');
          return;
      }
      
      logInfo(`Validating credentials for ${platformId}...`);
      
      sendMessage({
          action: 'credentialOperation',
          operation: 'validate',
          platformId,
          credentials: {
              apiKey,
              model
          }
      }).then(response => {
          if (response.success) {
              if (response.validationResult.isValid) {
                  logSuccess(`Credentials are valid for ${platformId}`);
              } else {
                  logError(`Invalid credentials: ${response.validationResult.message}`);
              }
          } else {
              logError(`Validation error: ${response.error}`);
          }
      });
  }

  // Function to run API test
  function runApiTest() {
      const platformId = testPlatformSelect.value;
      const testPrompt = testPromptInput.value.trim() || 'Summarize this content in 1-2 sentences.';
      
      logInfo(`Running API test for ${platformId}...`);
      
      // Create a test params object similar to what summarizeContentViaApi expects
      const testParams = {
          platformId,
          useApi: true,
          tabId: 999, // Dummy tab ID
          url: 'https://example.com/test',
          hasSelection: false,
          testPrompt
      };
      
      sendMessage({
          action: 'summarizeContent',
          ...testParams
      }).then(response => {
          if (response.success) {
              logSuccess(`API test successful for ${platformId}`);
              
              if (response.response && response.response.content) {
                  const contentDiv = document.createElement('div');
                  contentDiv.innerHTML = `<strong>API Response:</strong><br>${response.response.content}`;
                  resultContainer.appendChild(contentDiv);
              }
          } else {
              logError(`API test failed: ${response.error || 'Unknown error'}`);
          }
      });
  }

  // Function to check API availability
  function checkApiAvailability() {
      const platformId = testPlatformSelect.value;
      
      logInfo(`Checking API availability for ${platformId}...`);
      
      sendMessage({
          action: 'checkApiModeAvailable',
          platformId
      }).then(response => {
          if (response.success) {
              logInfo(`API mode available: ${response.isAvailable}`);
              if (response.isAvailable) {
                  logSuccess(`API mode is available for ${platformId}`);
              } else {
                  logInfo(`API mode is not available for ${platformId}. Check credentials.`);
              }
          } else {
              logError(`Error checking API availability: ${response.error}`);
          }
      });
  }

  // Function to get available models
  function getAvailableModels() {
      const platformId = testPlatformSelect.value;
      
      logInfo(`Getting available models for ${platformId}...`);
      
      sendMessage({
          action: 'getApiModels',
          platformId
      }).then(response => {
          if (response.success && response.models) {
              logSuccess(`Retrieved ${response.models.length} models for ${platformId}`);
              
              response.models.forEach(model => {
                  logInfo(`Model: ${model}`);
              });
          } else {
              logError(`Failed to get models: ${response.error || 'Unknown error'}`);
          }
      });
  }

  // Function to test all platforms
  async function testAllPlatforms() {
      const platforms = ['claude', 'chatgpt', 'deepseek', 'mistral', 'gemini', 'grok'];
      
      logInfo('Testing all platforms with stored credentials...');
      
      for (const platformId of platforms) {
          // Check if credentials exist
          const response = await sendMessage({
              action: 'credentialOperation',
              operation: 'get',
              platformId
          });
          
          if (response.success && response.credentials) {
              logInfo(`Testing ${platformId}...`);
              
              // Run test
              const testResult = await sendMessage({
                  action: 'summarizeContent',
                  platformId,
                  useApi: true,
                  tabId: 999, // Dummy tab ID
                  url: 'https://example.com/test',
                  hasSelection: false
              });
              
              if (testResult.success) {
                  logSuccess(`✅ ${platformId} test SUCCESS`);
              } else {
                  logError(`❌ ${platformId} test FAILED: ${testResult.error || 'Unknown error'}`);
              }
          } else {
              logInfo(`Skipping ${platformId} - no credentials stored`);
          }
      }
      
      logInfo('All platform tests completed');
  }

  // Function to get all credentials
  async function getAllCredentials() {
      logInfo('Checking all stored credentials...');
      
      // Get api_credentials from storage
      const result = await chrome.storage.sync.get('api_credentials');
      const credentials = result.api_credentials || {};
      
      logInfo(`Found credentials for ${Object.keys(credentials).length} platforms`);
      
      for (const [platformId, creds] of Object.entries(credentials)) {
          logInfo(`${platformId}: API Key: ${maskApiKey(creds.apiKey)}, Model: ${creds.model || 'N/A'}`);
      }
  }

  // Function to check platform config
  async function checkPlatformConfig() {
      logInfo('Checking platform configuration...');
      
      try {
          const response = await fetch(chrome.runtime.getURL('platform-config.json'));
          const config = await response.json();
          
          logInfo(`Default platform: ${config.defaultAiPlatform}`);
          
          for (const [platformId, platform] of Object.entries(config.aiPlatforms)) {
              if (platform.api) {
                  logInfo(`${platformId}: Endpoint: ${platform.api.endpoint}`);
                  logInfo(`${platformId}: Auth type: ${platform.api.authType}`);
                  logInfo(`${platformId}: Models: ${platform.api.models.join(', ')}`);
              } else {
                  logError(`${platformId}: No API configuration found`);
              }
          }
          
          logSuccess('Platform configuration loaded successfully');
      } catch (error) {
          logError(`Error loading platform config: ${error.message}`);
      }
  }

  // Helper function to send messages to background script
  function sendMessage(message) {
      return new Promise((resolve) => {
          chrome.runtime.sendMessage(message, (response) => {
              resolve(response || {success: false, error: 'No response'});
          });
      });
  }

  // Helper functions for logging
  function logInfo(message) {
      const entry = document.createElement('div');
      entry.className = 'log-entry log-info';
      entry.textContent = message;
      resultContainer.appendChild(entry);
      resultContainer.scrollTop = resultContainer.scrollHeight;
  }

  function logSuccess(message) {
      const entry = document.createElement('div');
      entry.className = 'log-entry log-success';
      entry.textContent = '✅ ' + message;
      resultContainer.appendChild(entry);
      resultContainer.scrollTop = resultContainer.scrollHeight;
  }

  function logError(message) {
      const entry = document.createElement('div');
      entry.className = 'log-entry log-error';
      entry.textContent = '❌ ' + message;
      resultContainer.appendChild(entry);
      resultContainer.scrollTop = resultContainer.scrollHeight;
  }

  // Helper function to mask API key for display
  function maskApiKey(apiKey) {
      if (!apiKey) return 'None';
      if (apiKey.length <= 8) return '********';
      return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  }

  // Load initial data
  getStoredCredentials();
});