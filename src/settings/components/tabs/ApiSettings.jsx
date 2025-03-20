import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import PlatformSidebar from '../ui/api/PlatformSidebar';
import PlatformDetails from '../ui/api/PlatformDetails';

const API_SETTINGS_KEY = 'api_advanced_settings';
const API_CREDENTIALS_KEY = 'api_credentials'; // Single key for all credentials

const ApiSettings = () => {
  const { error } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [advancedSettings, setAdvancedSettings] = useState({});
  
  // Load initial data only once or when explicitly needed
  useEffect(() => {
    const initialize = async () => {
      if (!isLoading) return; // Prevent unnecessary re-initialization
      
      try {
        // Load platform config
        const response = await fetch(chrome.runtime.getURL('platform-config.json'));
        const config = await response.json();
        
        if (!config.aiPlatforms) {
          throw new Error('AI platforms configuration not found');
        }
        
        // Transform to array with icon URLs
        const platformList = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
          id,
          name: platform.name,
          url: platform.url,
          iconUrl: chrome.runtime.getURL(platform.icon),
          docUrl: platform.docLink || '#',
          modelApiLink: platform.modelApiLink || '#',
          consoleApiLink: platform.consoleApiLink || '#',
          apiConfig: platform.api
        }));
        
        setPlatforms(platformList);
        
        // Load all credentials from a single key
        let allCredentials = {};
        
        // First try to get all credentials from the unified key
        const mainResult = await chrome.storage.local.get(API_CREDENTIALS_KEY);
        if (mainResult[API_CREDENTIALS_KEY]) {
          allCredentials = mainResult[API_CREDENTIALS_KEY];
        } else {
          // Migration: If not found, try to get from individual platform keys for backward compatibility
          for (const platform of platformList) {
            const result = await chrome.storage.local.get(`api_credentials_${platform.id}`);
            if (result[`api_credentials_${platform.id}`]) {
              allCredentials[platform.id] = result[`api_credentials_${platform.id}`];
            }
          }
          
          // Save migrated credentials to the new format if any were found
          if (Object.keys(allCredentials).length > 0) {
            await chrome.storage.local.set({ [API_CREDENTIALS_KEY]: allCredentials });
            
            // Clean up old keys
            for (const platform of platformList) {
              await chrome.storage.local.remove(`api_credentials_${platform.id}`);
            }
          }
        }
        
        setCredentials(allCredentials);
        
        // Set first platform as selected ONLY if no platform is currently selected
        if (selectedPlatformId === null && platformList.length > 0) {
          setSelectedPlatformId(platformList[0].id);
        }
        
        // Load advanced settings
        const result = await chrome.storage.sync.get(API_SETTINGS_KEY);
        setAdvancedSettings(result[API_SETTINGS_KEY] || {});
      } catch (err) {
        console.error('Error loading API settings:', err);
        error('Failed to load API settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [isLoading, error, selectedPlatformId]);
  
  const handleSelectPlatform = (platformId) => {
    setSelectedPlatformId(platformId);
  };
  
  const handleCredentialsUpdated = (platformId, newCredentials) => {
    // Update local state AND storage with the unified format
    const updatedCredentials = {
      ...credentials,
      [platformId]: newCredentials
    };
    
    setCredentials(updatedCredentials);
    
    // Update storage (handled by PlatformDetails)
  };
  
  const handleCredentialsRemoved = (platformId) => {
    // Update local state
    const updatedCredentials = { ...credentials };
    delete updatedCredentials[platformId];
    
    setCredentials(updatedCredentials);
    
    // Update storage (handled by PlatformDetails)
  };
  
  const handleAdvancedSettingsUpdated = (platformId, modelId, settings) => {
    // Update local state
    setAdvancedSettings(prev => {
      const updated = { ...prev };
      
      if (!updated[platformId]) {
        updated[platformId] = {
          default: {},
          models: {}
        };
      }
      
      if (!modelId || modelId === 'default') {
        // Update default settings
        updated[platformId].default = {
          ...updated[platformId].default,
          ...settings
        };
      } else {
        if (!updated[platformId].models) {
          updated[platformId].models = {};
        }
        
        // Update model-specific settings
        updated[platformId].models[modelId] = {
          ...updated[platformId].models?.[modelId] || {},
          ...settings
        };
      }
      
      return updated;
    });
  };
  
  // Force refresh method to explicitly reload data when needed
  const refreshData = () => {
    setIsLoading(true);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="mt-4">Loading API settings...</p>
      </div>
    );
  }
  
  // Get selected platform
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId);
  
  return (
    <div>
      <h2 className="type-heading mb-4 pb-3 border-b border-theme text-lg font-medium">API Settings</h2>
      <p className="section-description text-theme-secondary mb-6">
        Configure API credentials for different AI platforms and customize advanced settings for each model. 
        These settings will be used when making API requests directly from the browser extension.
      </p>
      
      <div className="api-settings-layout flex gap-6">
        <PlatformSidebar
          platforms={platforms}
          selectedPlatformId={selectedPlatformId}
          credentials={credentials}
          onSelectPlatform={handleSelectPlatform}
        />
        
        {selectedPlatform ? (
          <PlatformDetails
            key={selectedPlatform.id} // Add key to force re-mount when platform changes
            platform={selectedPlatform}
            credentials={credentials[selectedPlatformId]}
            advancedSettings={advancedSettings[selectedPlatformId] || {}}
            onCredentialsUpdated={handleCredentialsUpdated}
            onCredentialsRemoved={handleCredentialsRemoved}
            onAdvancedSettingsUpdated={handleAdvancedSettingsUpdated}
            refreshData={refreshData}
            credentialsKey={API_CREDENTIALS_KEY}
          />
        ) : (
          <div className="platform-details-panel flex-1 bg-theme-surface p-8 text-center text-theme-secondary rounded-lg border border-theme">
            <p>Select a platform from the list to configure its API settings.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiSettings;