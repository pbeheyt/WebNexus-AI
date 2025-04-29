// src/contexts/platform/TabAwarePlatformContext.jsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';
import logger from '../../shared/logger';
import ModelParameterService from '../../services/ModelParameterService';
import ConfigService from '../../services/ConfigService';
import { robustSendMessage } from '../../shared/utils/message-utils';

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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasAnyPlatformCredentials, setHasAnyPlatformCredentials] = useState(false);
    const [tabId, setTabId] = useState(null);
    
    // Get current tab ID on mount
    useEffect(() => {
      const getCurrentTab = async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            setTabId(tabs[0].id);
          } else {
            logger.sidebar.warn('Could not get active tab ID.');
            setIsLoading(false); // Stop loading if no tab ID
          }
        } catch (error) {
          logger.sidebar.error('Error getting current tab:', error);
          setIsLoading(false); // Stop loading on error
        }
      };
      
      getCurrentTab();
    }, []);
    
    // Load models for the selected platform (memoized)
    const loadModels = useCallback(async (platformId) => {
      if (!platformId || !tabId || interfaceType !== INTERFACE_SOURCES.SIDEBAR) return;

      try {
        // Request models from background script
        const response = await robustSendMessage({
          action: 'getApiModels',
          platformId,
          source: interfaceType
        });

        if (response && response.success && response.models) {
          setModels(response.models);

          // Determine the model to use, prioritizing tab preference, then falling back to default
          let finalModelIdToUse = null;
          try {
            const preferredModelId = await ModelParameterService.resolveModel(
              platformId,
              { tabId, source: interfaceType }
            );

            if (preferredModelId && response.models.some(m => m.id === preferredModelId)) {
              finalModelIdToUse = preferredModelId;
              logger.sidebar.info(`Using preferred model for ${platformId}: ${finalModelIdToUse}`);
            } else {
              // Get default model from config if preference is invalid
              const platformApiConfig = await ConfigService.getPlatformApiConfig(platformId);
              const defaultModelId = platformApiConfig?.defaultModel;

              if (defaultModelId && response.models.some(m => m.id === defaultModelId)) {
                finalModelIdToUse = defaultModelId;
                logger.sidebar.info(`No valid preference found, using default model for ${platformId}: ${finalModelIdToUse}`);
              } else if (response.models.length > 0) {
                // Fallback to first available model
                finalModelIdToUse = response.models[0].id;
                logger.sidebar.warn(`No valid default model, falling back to first available for ${platformId}: ${finalModelIdToUse}`);
              }
            }
          } catch (error) {
            logger.sidebar.error(`Error resolving model for ${platformId}:`, error);
            // Attempt to use default model on error
            const platformApiConfig = await ConfigService.getPlatformApiConfig(platformId);
            const defaultModelId = platformApiConfig?.defaultModel;
            if (defaultModelId && response.models.some(m => m.id === defaultModelId)) {
              finalModelIdToUse = defaultModelId;
            } else if (response.models.length > 0) {
              finalModelIdToUse = response.models[0].id;
            }
          }

          setSelectedModelId(finalModelIdToUse);
        } else {
           logger.sidebar.warn(`Failed to load models for ${platformId}:`, response?.error);
           setModels([]); // Clear models on failure
           setSelectedModelId(null);
        }
      } catch (error) {
        logger.sidebar.error(`Error loading models for ${platformId}:`, error);
        setModels([]); // Clear models on error
        setSelectedModelId(null);
      }
    }, [tabId, interfaceType]);

    const _loadAndCheckPlatforms = useCallback(async (setLoadingState) => {
       if (!tabId) {
         logger.sidebar.warn('Attempted to load platforms without tabId.');
         return;
       }
      setLoadingState(true);
      try {
        let platformList = await ConfigService.getAllPlatformConfigs();

        // Transform to expected format with hasCredentials flag
        platformList = platformList.map(platform => ({
          id: platform.id,
          name: platform.name,
          url: platform.url || null,
          iconUrl: platform.iconUrl,
          hasCredentials: false // Initialize with false
        }));

        let anyCredentialsFound = false;

        // Check credentials for all platforms (only if sidebar)
        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
          const credentialChecks = platformList.map(platform =>
            robustSendMessage({
              action: 'credentialOperation',
              operation: 'get',
              platformId: platform.id
            }).catch(err => {
              logger.sidebar.error(`Credential check failed for ${platform.id}:`, err);
              return { success: false }; // Treat errors as no credentials
            })
          );

          const results = await Promise.allSettled(credentialChecks);

          // Update platformList with credential status
          platformList = platformList.map((platform, index) => {
            const result = results[index];
            const hasCreds = result.status === 'fulfilled' &&
                             result.value &&
                             result.value.success &&
                             result.value.credentials;
            if (hasCreds) {
              anyCredentialsFound = true; // Update overall flag if any platform has credentials
            }
            return { ...platform, hasCredentials: hasCreds };
          });

          setHasAnyPlatformCredentials(anyCredentialsFound); // Set the overall flag
        } else {
           // For popup interfaces
           setHasAnyPlatformCredentials(true);
        }

        // Get tab-specific platform preference
        const tabPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
        const tabPlatformPrefs = tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};
        const lastUsedTabPlatform = tabPlatformPrefs[tabId];

        // Get global platform preference
        const globalPreferences = await chrome.storage.sync.get(globalStorageKey);
        const globalPlatformPref = globalPreferences[globalStorageKey];

        // Determine the platform to use based strictly on preferences and credentials (for sidebar)
        let platformToUse = null;
        let defaultModelId = null;
        const credentialedPlatformIds = new Set(platformList.filter(p => p.hasCredentials).map(p => p.id));

        // Priority 1: Tab-specific preference
        if (lastUsedTabPlatform) {
          const isValidTabPref = platformList.some(p => p.id === lastUsedTabPlatform);
          const hasCredsForTabPref = interfaceType !== INTERFACE_SOURCES.SIDEBAR || credentialedPlatformIds.has(lastUsedTabPlatform);
          if (isValidTabPref && hasCredsForTabPref) {
            platformToUse = lastUsedTabPlatform;
          }
        }

        // Priority 2: Global preference (if tab pref didn't work out)
        if (!platformToUse && globalPlatformPref) {
          const isValidGlobalPref = platformList.some(p => p.id === globalPlatformPref);
          const hasCredsForGlobalPref = interfaceType !== INTERFACE_SOURCES.SIDEBAR || credentialedPlatformIds.has(globalPlatformPref);
          if (isValidGlobalPref && hasCredsForGlobalPref) {
            platformToUse = globalPlatformPref;
          }
        }

        // Set platforms (now with credential status)
        setPlatforms(platformList);

        // Update selected platform state based on the determined platformToUse
        if (platformToUse && platformToUse !== selectedPlatformId) {
          setSelectedPlatformId(platformToUse);
          if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
            await loadModels(platformToUse);
          }
        } else if (platformToUse && interfaceType === INTERFACE_SOURCES.SIDEBAR && !models.length) {
          // If platform didn't change but models are missing (e.g., initial load), load them
          await loadModels(platformToUse);
        } else if (!platformToUse) {
          // Explicitly set to null if no valid platform was found
          setSelectedPlatformId(null);
          setModels([]);
          setSelectedModelId(null);
        }


      } catch (error) {
        logger.sidebar.error('Error loading platforms:', error);
        setPlatforms([]);
        setHasAnyPlatformCredentials(false);
        setSelectedPlatformId(null);
        setModels([]);
        setSelectedModelId(null);
      } finally {
        setLoadingState(false);
      }
    }, [tabId, interfaceType, globalStorageKey, loadModels, selectedPlatformId, models.length]);

    // Initial load effect
    useEffect(() => {
      if (tabId) {
        _loadAndCheckPlatforms(setIsLoading);
      }
    }, [tabId, _loadAndCheckPlatforms]);

    // Function to manually refresh platform data
    const refreshPlatformData = useCallback(async () => {
      await _loadAndCheckPlatforms(setIsRefreshing);
    }, [_loadAndCheckPlatforms]);

    // Select platform and save preference
    const selectPlatform = useCallback(async (platformId) => {
      // Add validation check
        if (!platforms.some(p => p.id === platformId)) {
          logger.sidebar.error('Attempted to select invalid platform:', platformId);
          return false;
        }
        if (!tabId || platformId === selectedPlatformId) return true; // No change needed

      try {
        // Update state immediately
        setSelectedPlatformId(platformId);

        // Update tab-specific preference
        const tabPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
        const tabPlatformPrefs = tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};

        tabPlatformPrefs[tabId] = platformId;

        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]: tabPlatformPrefs,
        });

        // Update global preference for new tabs
        await chrome.storage.sync.set({ [globalStorageKey]: platformId });

        // If this is sidebar, reload models for the new platform
        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
          await loadModels(platformId); // Await model loading
        }

        // Notify status if callback provided
        const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
        onStatusUpdate(`Platform set to ${platformName}`);

        return true;
      } catch (error) {
        logger.sidebar.error('Error setting platform preference:', error);
        return false;
      }
    }, [tabId, selectedPlatformId, interfaceType, globalStorageKey, platforms, onStatusUpdate, loadModels]);

    // Select model and save preference
    const selectModel = useCallback(async (modelId) => {
      // Add validation check
      if (!models.some(m => m.id === modelId)) {
        logger.sidebar.error('Attempted to select invalid model:', modelId);
        return false;
      }
      if (!tabId || interfaceType !== INTERFACE_SOURCES.SIDEBAR ||
          !selectedPlatformId || modelId === selectedModelId) {
        return false; // No change or invalid state
      }

      try {
        // Update state immediately
        setSelectedModelId(modelId);

        // Use centralized ModelParameterService to save preferences
        await ModelParameterService.saveTabModelPreference(tabId, selectedPlatformId, modelId);
        await ModelParameterService.saveSourceModelPreference(interfaceType, selectedPlatformId, modelId);

        return true;
      } catch (error) {
        logger.sidebar.error('Error setting model preference:', error);
        // Optionally revert state or show error
        return false;
      }
}, [tabId, interfaceType, selectedPlatformId, selectedModelId, models]); // Added models dependency

// Function to get API config for a specific platform
const getPlatformApiConfig = useCallback((platformId) => {
  return ConfigService.getPlatformApiConfig(platformId);
}, []); // No dependencies since ConfigService manages its own state

// Build context value with interface-specific properties
const contextValue = {
      // Core properties for all interfaces
      platforms,
      selectedPlatformId,
      selectPlatform,
      isLoading,
      getPlatformApiConfig,
      tabId,
      setTabId,

  // Sidebar-specific properties (undefined for popup)
      ...(interfaceType === INTERFACE_SOURCES.SIDEBAR ? {
        models,
        selectedModel: selectedModelId, // Renamed for clarity
        selectModel,
        hasAnyPlatformCredentials, // Overall credential status
        isRefreshing, // Expose refresh loading state
        refreshPlatformData // Expose refresh function
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
