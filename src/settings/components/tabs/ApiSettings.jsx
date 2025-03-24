import React, { useState, useEffect } from 'react';
import { useNotification } from '../../../components';
import PlatformSidebar from '../ui/api/PlatformSidebar';
import PlatformDetails from '../ui/api/PlatformDetails';
import { STORAGE_KEYS } from '../../../shared/constants';

const ApiSettings = () => {
  const { error } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [advancedSettings, setAdvancedSettings] = useState({});
  
  useEffect(() => {
    const initialize = async () => {
      if (!isLoading) return;
      
      try {
        // Load platform configuration
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
        
        // Load credentials using the unified credential storage key
        const credentialResult = await chrome.storage.local.get(STORAGE_KEYS.API_CREDENTIALS);
        setCredentials(credentialResult[STORAGE_KEYS.API_CREDENTIALS] || {});
        
        // Set first platform as selected if none is currently selected
        if (selectedPlatformId === null && platformList.length > 0) {
          setSelectedPlatformId(platformList[0].id);
        }
        
        // Load advanced settings
        const advancedResult = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
        setAdvancedSettings(advancedResult[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {});
      } catch (err) {
        console.error('Error loading API settings:', err);
        error('Failed to load API settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [isLoading, error, selectedPlatformId]);
  
  // Handler implementations remain largely unchanged
  const handleSelectPlatform = (platformId) => {
    setSelectedPlatformId(platformId);
  };
  
  const handleCredentialsUpdated = (platformId, newCredentials) => {
    const updatedCredentials = {
      ...credentials,
      [platformId]: newCredentials
    };
    
    setCredentials(updatedCredentials);
  };
  
  const handleCredentialsRemoved = (platformId) => {
    const updatedCredentials = { ...credentials };
    delete updatedCredentials[platformId];
    
    setCredentials(updatedCredentials);
  };
  
  const handleAdvancedSettingsUpdated = (platformId, modelId, settings) => {
    setAdvancedSettings(prev => {
      const updated = { ...prev };
      
      if (!updated[platformId]) {
        updated[platformId] = {
          default: {},
          models: {}
        };
      }
      
      if (!modelId || modelId === 'default') {
        updated[platformId].default = {
          ...updated[platformId].default,
          ...settings
        };
      } else {
        if (!updated[platformId].models) {
          updated[platformId].models = {};
        }
        
        updated[platformId].models[modelId] = {
          ...updated[platformId].models?.[modelId] || {},
          ...settings
        };
      }
      
      return updated;
    });
  };
  
  const refreshData = () => {
    setIsLoading(true);
  };
  
  // Loading state and render logic remains unchanged
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-theme border-t-primary rounded-full"></div>
        <p className="mt-4">Loading API settings...</p>
      </div>
    );
  }
  
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
            key={selectedPlatform.id}
            platform={selectedPlatform}
            credentials={credentials[selectedPlatformId]}
            advancedSettings={advancedSettings[selectedPlatformId] || {}}
            onCredentialsUpdated={handleCredentialsUpdated}
            onCredentialsRemoved={handleCredentialsRemoved}
            onAdvancedSettingsUpdated={handleAdvancedSettingsUpdated}
            refreshData={refreshData}
            credentialsKey={STORAGE_KEYS.API_CREDENTIALS}
            advancedSettingsKey={STORAGE_KEYS.API_ADVANCED_SETTINGS}
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