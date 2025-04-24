import React, { useState, useEffect } from 'react';
import { Button, useNotification } from '../../../../components';
import AdvancedSettings from './AdvancedSettings';
import { STORAGE_KEYS } from '../../../../shared/constants';

const PlatformDetails = ({
  platform,
  credentials,
  advancedSettings,
  onCredentialsUpdated,
  onCredentialsRemoved,
  onAdvancedSettingsUpdated,
  credentialsKey
}) => {
  const { success, error } = useNotification();
  const [apiKey, setApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [hasApiKeyChanges, setHasApiKeyChanges] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(
    platform.apiConfig?.models?.length > 0 ? platform.apiConfig.models[0].id : 'default'
  );
  
  // Synchronize API key state with platform credentials when platform changes
  useEffect(() => {
    if (credentials?.apiKey) {
      setApiKey(credentials.apiKey);
      setOriginalApiKey(credentials.apiKey);
    } else {
      setApiKey('');
      setOriginalApiKey('');
    }
    setHasApiKeyChanges(false);
    console.log('Platfom:', platform);
  }, [platform.id, credentials]);
  
  // Check for API key changes
  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    
    // Check if the API key has changed from its original value
    if (credentials) {
      // For existing credentials, compare with original
      setHasApiKeyChanges(newApiKey !== originalApiKey);
    } else {
      // For new credentials, any non-empty value is a change
      setHasApiKeyChanges(newApiKey.trim() !== '');
    }
  };

  const handleSaveCredentials = async () => {
    if (!apiKey.trim()) {
      error('API key cannot be empty');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Create credentials object
    const newCredentials = {
      apiKey
    };
      
      // Validate the API key before saving
      const credentialManager = await import('../../../../services/CredentialManager')
        .then(module => module.default || module);
      
      const validationResult = await credentialManager.validateCredentials(
        platform.id,
        newCredentials
      );
      
      if (!validationResult.isValid) {
        error(`Invalid API key: ${validationResult.message}`);
        return;
      }
      
      // Get current credentials from storage
      const result = await chrome.storage.local.get(credentialsKey);
      const allCredentials = result[credentialsKey] || {};
      
      // Update credentials for this platform
      allCredentials[platform.id] = newCredentials;
      
      // Save all credentials under a single key
      await chrome.storage.local.set({
        [credentialsKey]: allCredentials
      });
      
      onCredentialsUpdated(platform.id, newCredentials);
      success(`API key saved for ${platform.name}`);
      
      // Update original key reference after successful save
      setOriginalApiKey(apiKey);
      setHasApiKeyChanges(false);
    } catch (err) {
      console.error('Error saving API key:', err);
      error(`Failed to save API key: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleRemoveCredentials = async () => {
    if (!window.confirm(`Are you sure you want to remove the API key for ${platform.name}?`)) {
      return;
    }
    
    try {
      // Get current credentials from storage
      const result = await chrome.storage.local.get(credentialsKey);
      const allCredentials = result[credentialsKey] || {};
      
      // Remove credentials for this platform
      delete allCredentials[platform.id];
      
      // Save updated credentials
      await chrome.storage.local.set({
        [credentialsKey]: allCredentials
      });
      
      onCredentialsRemoved(platform.id);
      success(`API key removed for ${platform.name}`);
      setApiKey('');
      setOriginalApiKey('');
      setHasApiKeyChanges(false);
    } catch (err) {
      console.error('Error removing API key:', err);
      error(`Failed to remove API key: ${err.message}`);
    }
  };
  
  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
  };

  // New function to handle resetting advanced settings to defaults
  const handleResetAdvancedSettings = async (modelId) => {
    try {
      // Load current settings from storage
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const currentSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      if (!currentSettings[platform.id]) {
        // Nothing to remove, already at defaults
        onAdvancedSettingsUpdated(platform.id, modelId, {}); // Notify with empty settings
        success('Settings already at defaults'); // Adjusted message
        return true;
      }

      let settingsChanged = false; // Track if anything was actually deleted

      // Handle model-specific or default settings removal
      if (!modelId || modelId === 'default') {
        // Remove default settings
        if (currentSettings[platform.id].default) {
          delete currentSettings[platform.id].default;
          settingsChanged = true;
        }
      } else {
        // Remove model-specific settings
        if (currentSettings[platform.id].models &&
            currentSettings[platform.id].models[modelId]) {
          delete currentSettings[platform.id].models[modelId];
          settingsChanged = true;
        }

        // Clean up empty models object if needed
        if (currentSettings[platform.id].models &&
            Object.keys(currentSettings[platform.id].models).length === 0) {
          delete currentSettings[platform.id].models;
          // No need to set settingsChanged here, already handled above or below
        }
      }

      // Remove entire platform entry if it's now empty
      if (currentSettings[platform.id] && Object.keys(currentSettings[platform.id]).length === 0) {
        delete currentSettings[platform.id];
        settingsChanged = true; // Ensure change is tracked if only the platform entry is removed
      }

      // Only save and notify if changes were made
      if (settingsChanged) {
        // Save updated settings to storage
        await chrome.storage.sync.set({
          [STORAGE_KEYS.API_ADVANCED_SETTINGS]: currentSettings
        });

        // Notify parent component of reset with empty settings object
        onAdvancedSettingsUpdated(platform.id, modelId, {});

        // Show success message
        success('Advanced settings reset to defaults');
      } else {
         // If no settings were actually removed (e.g., trying to reset non-existent model settings)
         onAdvancedSettingsUpdated(platform.id, modelId, {}); // Still notify parent
         success('Settings already at defaults');
      }

      return true;
    } catch (err) {
      console.error('Error resetting advanced settings:', err);
      error(`Failed to reset advanced settings: ${err.message}`);
      return false;
    }
  };
  
  const handleAdvancedSettingsUpdate = async (modelId, settings) => {
    try {
      // Load current settings
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const currentSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};
      
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
          ...currentSettings[platform.id].models?.[modelId] || {},
          ...settings
        };
      }
      
      // Save to storage
      await chrome.storage.sync.set({
        [STORAGE_KEYS.API_ADVANCED_SETTINGS]: currentSettings
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
            src={platform.iconUrl}
            alt={platform.name}
            className={`platform-icon-large w-12 h-12 mr-4 object-contain ${platform.id === 'chatgpt' ? 'invert dark:invert-0' : ''}`}
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
              href={platform.consoleApiLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="platform-link text-primary hover:underline text-sm"
            >
              API Console
            </a>
            <a 
              href={platform.docApiLink} 
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
            <a 
              href={platform.keyApiLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="platform-link text-primary hover:underline text-sm"
            >
              API Keys
            </a>
          </div>
        </div>
      </div>
      
      {/* API credentials section */}
      <div className="settings-section bg-theme-surface p-5 rounded-lg border border-theme mb-6">
        <h4 className="section-subtitle text-lg font-medium mb-4">API Credentials</h4>
        
        <div className="form-group mb-4">
          <label 
            htmlFor={`${platform.id}-api-key`}
            className="block mb-2 text-sm font-medium text-theme-secondary"
          >
            API Key:
          </label>
          <div className="relative flex items-center">
            <input
              type={showApiKey ? 'text' : 'password'}
              id={`${platform.id}-api-key`}
              className="api-key-input w-full p-2 pr-16 bg-theme-surface text-theme-primary border border-theme rounded-md font-mono focus:ring-primary focus:border-primary"
              placeholder={credentials?.apiKey ? "••••••••••••••••••••••••••" : "Enter your API key"}
              value={apiKey}
              onChange={handleApiKeyChange}
            />
            <button
              type="button"
              className="show-key-toggle absolute right-2 px-2 py-1 text-primary hover:text-primary-hover bg-theme-surface rounded"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        
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
            onClick={handleSaveCredentials}
            disabled={isSaving || !hasApiKeyChanges}
            variant={!hasApiKeyChanges ? 'inactive' : 'primary'}
          >
            {isSaving ? 'Saving...' : (credentials ? 'Update Key' : 'Save Key')}
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
        onResetToDefaults={handleResetAdvancedSettings}
      />
    </div>
  );
};

export default PlatformDetails;
