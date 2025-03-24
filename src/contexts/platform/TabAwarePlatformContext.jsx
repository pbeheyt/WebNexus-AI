// src/contexts/platform/TabAwarePlatformContext.jsx (partial update, focusing on the model handling part)

import React, { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';
import ModelParameterService from '../../services/ModelParameterService';

/**
 * Creates a tab-aware platform context with shared functionality.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.interfaceType - Interface type (popup or sidebar)
 * @param {string} options.globalStorageKey - Key for global preference storage
 * @param {Function} options.onStatusUpdate - Optional callback for status updates
 * @returns {Object} Context provider and hook
 */
export function createTabAwarePlatformContext(options = {}) {
  const { 
    interfaceType, 
    globalStorageKey, 
    onStatusUpdate = () => {} 
  } = options;
  
  // Create the context
  const TabAwarePlatformContext = createContext(null);
  
  // Create provider component
  function TabAwarePlatformProvider({ children }) {
    const [platforms, setPlatforms] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedPlatformId, setSelectedPlatformId] = useState(null);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCredentials, setHasCredentials] = useState(false);
    const [tabId, setTabId] = useState(null);
    
    // Get current tab ID on mount
    useEffect(() => {
      const getCurrentTab = async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            setTabId(tabs[0].id);
          }
        } catch (error) {
          console.error('Error getting current tab:', error);
        }
      };
      
      getCurrentTab();
    }, []);
    
    // Load platforms and preferences when tab ID is available
    useEffect(() => {
      if (!tabId) return;
      
      const loadPlatforms = async () => {
        try {
          setIsLoading(true);
          
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
            url: platform.url || null,
            iconUrl: chrome.runtime.getURL(platform.icon)
          }));
          
          // Get tab-specific platform preference
          const tabPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
          const tabPlatformPrefs = tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};
          
          // Get global platform preference
          const globalPreferences = await chrome.storage.sync.get(globalStorageKey);
          const globalPlatformPref = globalPreferences[globalStorageKey];
          
          // Use tab-specific preference if available, otherwise use global
          const platformToUse = 
            (tabId && tabPlatformPrefs[tabId]) ||
            globalPlatformPref || 
            config.defaultAiPlatform;
          
          // Set platforms and selected ID
          setPlatforms(platformList);
          setSelectedPlatformId(platformToUse);
          
          // If this is sidebar, also load models for the selected platform
          if (interfaceType === INTERFACE_SOURCES.SIDEBAR && platformToUse) {
            await loadModels(platformToUse);
          }
        } catch (error) {
          console.error('Error loading platforms:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadPlatforms();
    }, [tabId]);
    
    // Load models for the selected platform
    const loadModels = async (platformId) => {
      if (!platformId || !tabId || interfaceType !== INTERFACE_SOURCES.SIDEBAR) return;
      
      try {
        // Request models from background script
        const response = await chrome.runtime.sendMessage({
          action: 'getApiModels',
          platformId,
          source: interfaceType
        });
        
        if (response && response.success && response.models) {
          setModels(response.models);
          
          // Use centralized ModelParameterService for model resolution
          const modelToUse = await ModelParameterService.resolveModel(
            platformId,
            { tabId, source: interfaceType }
          );
          
          setSelectedModelId(modelToUse);
          
          // Check credentials
          await checkCredentials(platformId);
        }
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };
    
    // Select platform and save preference
    const selectPlatform = async (platformId) => {
      if (!tabId || platformId === selectedPlatformId) return true;
      
      try {
        // Update state immediately
        setSelectedPlatformId(platformId);
        
        // Update tab-specific preference
        const tabPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
        const tabPlatformPrefs = tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};
        
        tabPlatformPrefs[tabId] = platformId;
        
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]: tabPlatformPrefs,
          [STORAGE_KEYS.LAST_ACTIVE_TAB]: tabId
        });
        
        // Update global preference for new tabs
        await chrome.storage.sync.set({ [globalStorageKey]: platformId });
        
        // If this is sidebar, reload models for the new platform
        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
          await loadModels(platformId);
        }
        
        // Notify status if callback provided
        const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
        onStatusUpdate(`Platform set to ${platformName}`);
        
        return true;
      } catch (error) {
        console.error('Error setting platform preference:', error);
        return false;
      }
    };
    
    // Select model and save preference
    const selectModel = async (modelId) => {
      if (!tabId || interfaceType !== INTERFACE_SOURCES.SIDEBAR || 
          !selectedPlatformId || modelId === selectedModelId) {
        return false;
      }
      
      try {
        // Update state immediately
        setSelectedModelId(modelId);
        
        // Use centralized ModelParameterService to save preferences
        await ModelParameterService.saveTabModelPreference(tabId, selectedPlatformId, modelId);
        await ModelParameterService.saveSourceModelPreference(interfaceType, selectedPlatformId, modelId);
        
        return true;
      } catch (error) {
        console.error('Error setting model preference:', error);
        return false;
      }
    };
    
    // Get platform configuration by ID
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
    
    // Check if credentials exist for platform
    const checkCredentials = async (platformId) => {
      if (interfaceType !== INTERFACE_SOURCES.SIDEBAR) return false;
      
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
        setHasCredentials(false);
        return false;
      }
    };
    
    // Build context value with interface-specific properties
    const contextValue = {
      // Core properties for all interfaces
      platforms,
      selectedPlatformId,
      selectPlatform,
      isLoading,
      getPlatformConfig,
      tabId,
      
      // Sidebar-specific properties (undefined for popup)
      ...(interfaceType === INTERFACE_SOURCES.SIDEBAR ? {
        models,
        selectedModel: selectedModelId,
        selectModel,
        hasCredentials,
        checkCredentials
      } : {})
    };
    
    return (
      <TabAwarePlatformContext.Provider value={contextValue}>
        {children}
      </TabAwarePlatformContext.Provider>
    );
  }
  
  // Custom hook to use the context
  const useTabAwarePlatform = () => {
    const context = useContext(TabAwarePlatformContext);
    if (!context) {
      throw new Error(`use${interfaceType.charAt(0).toUpperCase() + interfaceType.slice(1)}Platform must be used within ${interfaceType}PlatformProvider`);
    }
    return context;
  };
  
  return {
    TabAwarePlatformContext,
    TabAwarePlatformProvider,
    useTabAwarePlatform
  };
}