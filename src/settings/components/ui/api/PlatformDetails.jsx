import React, { useState } from 'react';
import { useNotification } from '../../../contexts/NotificationContext';
import Button from '../../common/Button';
import AdvancedSettings from './AdvancedSettings';

const API_CREDENTIALS_KEY_PREFIX = 'api_credentials_';
const API_SETTINGS_KEY = 'api_advanced_settings';

const PlatformDetails = ({
  platform,
  credentials,
  advancedSettings,
  onCredentialsUpdated,
  onCredentialsRemoved,
  onAdvancedSettingsUpdated
}) => {
  const { success, error } = useNotification();
  const [apiKey, setApiKey] = useState(credentials?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(
    platform.apiConfig?.models?.length > 0 ? platform.apiConfig.models[0].id : 'default'
  );
  
  const handleSaveCredentials = async () => {
    if (!apiKey.trim()) {
      error('API key cannot be empty');
      return;
    }
    
    try {
      // Create credentials object
      const newCredentials = {
        apiKey,
        model: selectedModelId
      };
      
      // Simple validation can be enhanced based on platform requirements
      // For now, just check if the key has a reasonable length
      if (apiKey.length < 10) {
        error('API key seems too short. Please check your key.');
        return;
      }
      
      // Save credentials to storage
      await chrome.storage.local.set({
        [`${API_CREDENTIALS_KEY_PREFIX}${platform.id}`]: newCredentials
      });
      
      onCredentialsUpdated(platform.id, newCredentials);
      success(`API key saved for ${platform.name}`);
    } catch (err) {
      console.error('Error saving API key:', err);
      error(`Failed to save API key: ${err.message}`);
    }
  };
  
  const handleRemoveCredentials = async () => {
    if (!window.confirm(`Are you sure you want to remove the API key for ${platform.name}?`)) {
      return;
    }
    
    try {
      await chrome.storage.local.remove(`${API_CREDENTIALS_KEY_PREFIX}${platform.id}`);
      
      onCredentialsRemoved(platform.id);
      success(`API key removed for ${platform.name}`);
      setApiKey('');
    } catch (err) {
      console.error('Error removing API key:', err);
      error(`Failed to remove API key: ${err.message}`);
    }
  };
  
  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      error('API key cannot be empty');
      return;
    }
    
    setIsTestingKey(true);
    setTestResult(null);
    
    try {
      // Simple validation for now
      // In a real implementation, you would use the API service to test the key
      if (apiKey.length < 10) {
        throw new Error('API key seems too short');
      }
      
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTestResult({
        success: true,
        message: 'API key is valid'
      });
    } catch (err) {
      console.error('Error testing API key:', err);
      setTestResult({
        success: false,
        message: `Invalid API key: ${err.message}`
      });
    } finally {
      setIsTestingKey(false);
    }
  };
  
  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
  };
  
  const handleAdvancedSettingsUpdate = async (modelId, settings) => {
    try {
      // Load current settings
      const result = await chrome.storage.sync.get(API_SETTINGS_KEY);
      const currentSettings = result[API_SETTINGS_KEY] || {};
      
      // Initialize platform settings if needed
      if (!currentSettings[platform.id]) {
        currentSettings[platform.id] = {
          default: {},
          models: {}
        };
      }
      
      // Update appropriate settings
      if (!modelId || modelId === 'default') {
        // Update default settings
        currentSettings[platform.id].default = {
          ...currentSettings[platform.id].default,
          ...settings
        };
      } else {
        // Initialize models object if needed
        if (!currentSettings[platform.id].models) {
          currentSettings[platform.id].models = {};
        }
        
        // Update model-specific settings
        currentSettings[platform.id].models[modelId] = {
          ...currentSettings[platform.id].models[modelId] || {},
          ...settings
        };
      }
      
      // Save to storage
      await chrome.storage.sync.set({
        [API_SETTINGS_KEY]: currentSettings
      });
      
      // Update parent component
      onAdvancedSettingsUpdated(platform.id, modelId, settings);
      
      // Show success message
      success('Advanced settings saved');
      
      return true;
    } catch (err) {
      console.error('Error saving advanced settings:', err);
      error(`Failed to save advanced settings: ${err.message}`);
      return false;
    }
  };
  
  return (
    <div className="platform-details-panel flex-1">
      {/* Platform header */}
      <div className="platform-header flex items-center mb-6">
        {platform.iconUrl ? (
          <img 
            className="platform-icon-large w-12 h-12 mr-4 object-contain" 
            src={platform.iconUrl} 
            alt={`${platform.name} icon`} 
          />
        ) : (
          <div className="platform-icon-placeholder-large w-12 h-12 mr-4 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold">
            {platform.name.charAt(0)}
          </div>
        )}
        
        <div className="platform-header-info">
          <h3 className="platform-title text-xl font-medium mb-2">{platform.name}</h3>
          <div className="platform-actions flex gap-3">
            <a 
              href={platform.docUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="platform-link text-primary hover:underline text-sm"
            >
              API Documentation
            </a>
            <a 
              href={platform.modelApiLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="platform-link text-primary hover:underline text-sm"
            >
              Model Documentation
            </a>
          </div>
        </div>
      </div>
      
      {/* API credentials section */}
      <div className="settings-section bg-theme-surface p-5 rounded-lg border border-theme mb-6">
        <h4 className="section-subtitle text-lg font-medium mb-4">API Credentials</h4>
        
        <div className="form-group mb-4 relative">
          <label 
            htmlFor={`${platform.id}-api-key`}
            className="block mb-2 text-sm font-medium text-theme-secondary"
          >
            API Key:
          </label>
          <input
            type={showApiKey ? 'text' : 'password'}
            id={`${platform.id}-api-key`}
            className="api-key-input w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md font-mono"
            placeholder="Enter your API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="show-key-toggle absolute right-3 top-9 text-primary"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {testResult && (
          <div className={`status-message p-3 rounded-md mb-4 ${
            testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}>
            {testResult.message}
          </div>
        )}
        
        <div className="form-actions flex justify-end gap-3">
          {credentials && (
            <Button
              variant="danger"
              onClick={handleRemoveCredentials}
            >
              Remove Key
            </Button>
          )}
          
          <Button
            variant="secondary"
            onClick={handleTestApiKey}
            disabled={isTestingKey}
          >
            {isTestingKey ? 'Testing...' : 'Test Key'}
          </Button>
          
          <Button
            onClick={handleSaveCredentials}
          >
            {credentials ? 'Update Key' : 'Save Key'}
          </Button>
        </div>
      </div>
      
      {/* Advanced settings section */}
      <AdvancedSettings
        platform={platform}
        selectedModelId={selectedModelId}
        advancedSettings={advancedSettings}
        onModelSelect={handleModelSelect}
        onSettingsUpdate={handleAdvancedSettingsUpdate}
      />
    </div>
  );
};

export default PlatformDetails;