import React, { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

const SidebarPlatformContext = createContext(null);

export function SidebarPlatformProvider({ children }) {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);
  
  // Load platforms and models
  useEffect(() => {
    const loadPlatforms = async () => {
      setIsLoading(true);
      try {
        // Load platform config
        const response = await fetch(chrome.runtime.getURL('platform-config.json'));
        const config = await response.json();
        
        if (!config || !config.aiPlatforms) {
          throw new Error('Invalid platform configuration');
        }
        
        // Transform to array with icon URLs
        const platformList = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
          id,
          name: platform.name,
          iconUrl: chrome.runtime.getURL(platform.icon)
        }));
        
        // Get preferred platform for sidebar
        const { [STORAGE_KEYS.SIDEBAR_PLATFORM]: preferredPlatform } = 
          await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_PLATFORM);
        
        // Use preferred platform or default
        const platformId = preferredPlatform || config.defaultAiPlatform;
        
        setPlatforms(platformList);
        setSelectedPlatformId(platformId);
        
        // Load models for selected platform
        await loadModels(platformId);
        
        // Check for credentials
        await checkCredentials(platformId);
      } catch (error) {
        console.error('Error loading platforms:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlatforms();
  }, []);
  
  // Check if credentials exist for platform
  const checkCredentials = async (platformId) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'credentialOperation',
        operation: 'get',
        platformId
      });
      
      const hasValidCredentials = response && response.success && response.credentials;
      setHasCredentials(hasValidCredentials);
      return hasValidCredentials;
    } catch (error) {
      console.error(`Error checking credentials for ${platformId}:`, error);
      setHasCredentials(false);
      return false;
    }
  };
  
  // Load models for a platform
  const loadModels = async (platformId) => {
    try {
      // Request models from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getApiModels',
        platformId,
        source: INTERFACE_SOURCES.SIDEBAR
      });
      
      if (response && response.success && response.models) {
        setModels(response.models);
        
        // Get preferred model for this platform
        const { [STORAGE_KEYS.SIDEBAR_MODEL]: modelPreferences } = 
          await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
        
        const preferences = modelPreferences || {};
        
        // Use preferred model, platform default, or first available
        let modelToUse = null;
        
        if (preferences[platformId]) {
          modelToUse = preferences[platformId];
        } else {
          // Get platform default from config
          const platformConfig = await getPlatformConfig(platformId);
          if (platformConfig && platformConfig.api && platformConfig.api.defaultModel) {
            modelToUse = platformConfig.api.defaultModel;
          } else if (response.models.length > 0) {
            if (Array.isArray(response.models)) {
              modelToUse = typeof response.models[0] === 'object' 
                ? response.models[0].id 
                : response.models[0];
            } else if (typeof response.models === 'object') {
              // Handle case where models might be an object
              const firstModel = Object.values(response.models)[0];
              modelToUse = typeof firstModel === 'object' ? firstModel.id : firstModel;
            }
          }
        }
        
        setSelectedModel(modelToUse);
      } else {
        console.error('Invalid response format for models:', response);
        setModels([]);
      }
    } catch (error) {
      console.error(`Error loading models for ${platformId}:`, error);
      setModels([]);
    }
  };
  
  // Get platform configuration
  const getPlatformConfig = async (platformId) => {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      return config.aiPlatforms[platformId] || null;
    } catch (error) {
      console.error(`Error loading platform config for ${platformId}:`, error);
      return null;
    }
  };
  
  // Select platform
  const selectPlatform = async (platformId) => {
    if (platformId === selectedPlatformId) return;
    
    setSelectedPlatformId(platformId);
    
    // Save preference in sidebar-specific storage
    await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_PLATFORM]: platformId });
    
    // Check credentials for this platform
    await checkCredentials(platformId);
    
    // Load models for new platform
    await loadModels(platformId);
  };
  
  const selectModel = async (modelId) => {
    if (modelId === selectedModel) return;
    
    setSelectedModel(modelId);
    
    // Save preference for this platform in sidebar-specific storage
    const { [STORAGE_KEYS.SIDEBAR_MODEL]: modelPreferences } = 
      await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
    
    const preferences = modelPreferences || {};
    preferences[selectedPlatformId] = modelId; // This is the correct format
    
    await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_MODEL]: preferences });
    
    console.log(`[Sidebar] Saved model selection for ${selectedPlatformId}: ${modelId}`);
  };
  
  return (
    <SidebarPlatformContext.Provider value={{
      platforms,
      selectedPlatformId,
      models,
      selectedModel,
      isLoading,
      hasCredentials,
      selectPlatform,
      selectModel,
      checkCredentials
    }}>
      {children}
    </SidebarPlatformContext.Provider>
  );
}

export const useSidebarPlatform = () => useContext(SidebarPlatformContext);