// src/contexts/platform/SidebarPlatformContext.jsx
import React, { useState, useEffect } from 'react';
import { createBasePlatformContext } from './BasePlatformContext';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

// Create base sidebar platform context
const { 
  PlatformContext,
  PlatformProvider: BaseSidebarPlatformProvider,
  usePlatform
} = createBasePlatformContext({
  storageKey: STORAGE_KEYS.SIDEBAR_PLATFORM
});

// Extended provider with model management
function SidebarPlatformProvider({ children }) {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  
  // Use the base platform context
  const SidebarPlatformConsumer = ({ children }) => (
    <PlatformContext.Consumer>
      {(platformContext) => {
        // Check for credentials when platform changes
        useEffect(() => {
          if (platformContext.selectedPlatformId) {
            checkCredentials(platformContext.selectedPlatformId);
            loadModels(platformContext.selectedPlatformId);
          }
        }, [platformContext.selectedPlatformId]);
        
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
                const platformConfig = await platformContext.getPlatformConfig(platformId);
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
        
        const selectModel = async (modelId) => {
          if (modelId === selectedModel) return;
          
          setSelectedModel(modelId);
          
          // Save preference for this platform in sidebar-specific storage
          const { [STORAGE_KEYS.SIDEBAR_MODEL]: modelPreferences } = 
            await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
          
          const preferences = modelPreferences || {};
          preferences[platformContext.selectedPlatformId] = modelId;
          
          await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_MODEL]: preferences });
        };
        
        // Return the full context with combined values
        return children({
          ...platformContext,
          models,
          selectedModel,
          hasCredentials,
          selectModel,
          checkCredentials
        });
      }}
    </PlatformContext.Consumer>
  );
  
  return (
    <BaseSidebarPlatformProvider>
      <SidebarPlatformConsumer>
        {(combinedContext) => (
          <PlatformContext.Provider value={combinedContext}>
            {children}
          </PlatformContext.Provider>
        )}
      </SidebarPlatformConsumer>
    </BaseSidebarPlatformProvider>
  );
}

// Custom hook to access the enhanced sidebar platform context
function useSidebarPlatform() {
  return usePlatform();
}

export { SidebarPlatformProvider, useSidebarPlatform };