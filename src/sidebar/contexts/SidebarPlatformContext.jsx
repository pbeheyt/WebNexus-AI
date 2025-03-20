import React, { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

const SidebarPlatformContext = createContext(null);

export function SidebarPlatformProvider({ children }) {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
      } catch (error) {
        console.error('Error loading platforms:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlatforms();
  }, []);
  
  // Load models for a platform
  const loadModels = async (platformId) => {
    try {
      // Request models from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getApiModels',
        platformId
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
              modelToUse = response.models[0].id || response.models[0];
            } else if (typeof response.models === 'object') {
              // Handle case where models might be an object
              const firstModel = Object.values(response.models)[0];
              modelToUse = firstModel.id || firstModel;
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
    
    // Save preference
    await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_PLATFORM]: platformId });
    
    // Load models for new platform
    await loadModels(platformId);
  };
  
  // Select model
  const selectModel = async (modelId) => {
    if (modelId === selectedModel) return;
    
    setSelectedModel(modelId);
    
    // Save preference for this platform
    const { [STORAGE_KEYS.SIDEBAR_MODEL]: modelPreferences } = 
      await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
    
    const preferences = modelPreferences || {};
    preferences[selectedPlatformId] = modelId;
    
    await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_MODEL]: preferences });
  };
  
  // Check if API mode is available
  const checkApiAvailability = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkApiModeAvailable',
        platformId: selectedPlatformId
      });
      
      return response && response.success && response.isAvailable;
    } catch (error) {
      console.error('Error checking API availability:', error);
      return false;
    }
  };
  
  return (
    <SidebarPlatformContext.Provider value={{
      platforms,
      selectedPlatformId,
      models,
      selectedModel,
      isLoading,
      selectPlatform,
      selectModel,
      checkApiAvailability
    }}>
      {children}
    </SidebarPlatformContext.Provider>
  );
}

export const useSidebarPlatform = () => useContext(SidebarPlatformContext);