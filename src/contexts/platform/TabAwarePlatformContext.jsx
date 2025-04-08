// src/contexts/platform/TabAwarePlatformContext.jsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
    const [isRefreshing, setIsRefreshing] = useState(false); // New state for refresh
    const [hasAnyPlatformCredentials, setHasAnyPlatformCredentials] = useState(false); // For overall check
    const [tabId, setTabId] = useState(null);
    
    // Get current tab ID on mount
    useEffect(() => {
      const getCurrentTab = async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            setTabId(tabs[0].id);
          } else {
            console.warn('Could not get active tab ID.');
            setIsLoading(false); // Stop loading if no tab ID
          }
        } catch (error) {
          console.error('Error getting current tab:', error);
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
        } else {
           console.warn(`Failed to load models for ${platformId}:`, response?.error);
           setModels([]); // Clear models on failure
           setSelectedModelId(null);
        }
      } catch (error) {
        console.error(`Error loading models for ${platformId}:`, error);
        setModels([]); // Clear models on error
        setSelectedModelId(null);
      }
    }, [tabId, interfaceType]); // Dependencies for loadModels


    // Refactored logic to load platforms and check credentials
    const _loadAndCheckPlatforms = useCallback(async (setLoadingState) => {
       if (!tabId) {
         console.warn('Attempted to load platforms without tabId.');
         return; // Don't proceed without tabId
       }
      setLoadingState(true);
      try {
        // Load platform display config
        const response = await fetch(chrome.runtime.getURL('platform-display-config.json'));
        const config = await response.json(); // This is now the display config

        if (!config || !config.aiPlatforms) {
          throw new Error('Invalid platform configuration');
        }

        // Transform to array with icon URLs
        let platformList = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
          id,
          name: platform.name,
          url: platform.url || null,
          iconUrl: chrome.runtime.getURL(platform.icon),
          hasCredentials: false // Initialize with false
        }));

        let anyCredentialsFound = false;

        // Check credentials for all platforms (only if sidebar)
        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
          const credentialChecks = platformList.map(platform =>
            chrome.runtime.sendMessage({
              action: 'credentialOperation',
              operation: 'get',
              platformId: platform.id
            }).catch(err => {
              console.error(`Credential check failed for ${platform.id}:`, err);
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
           // For non-sidebar interfaces, assume credentials aren't managed this way
           setHasAnyPlatformCredentials(true); // Or adjust based on popup logic if needed
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

        // If sidebar and still no platform, try the *first* credentialed platform as a last resort?
        // DECISION: No, the requirement is to remove fallbacks. If preferences don't yield a valid, credentialed platform, it should be null.
        // if (!platformToUse && interfaceType === INTERFACE_SOURCES.SIDEBAR && credentialedPlatformIds.size > 0) {
        //   platformToUse = [...credentialedPlatformIds][0]; // Get the first one
        // }

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
        console.error('Error loading platforms:', error);
        setPlatforms([]); // Clear platforms on error
        setHasAnyPlatformCredentials(false);
        setSelectedPlatformId(null);
        setModels([]);
        setSelectedModelId(null);
      } finally {
        setLoadingState(false);
      }
    }, [tabId, interfaceType, globalStorageKey, loadModels, selectedPlatformId, models.length]); // Added dependencies


    // Initial load effect
    useEffect(() => {
      if (tabId) {
        _loadAndCheckPlatforms(setIsLoading);
      }
    }, [tabId, _loadAndCheckPlatforms]); // Use the callback


    // Function to manually refresh platform data
    const refreshPlatformData = useCallback(async () => {
      await _loadAndCheckPlatforms(setIsRefreshing);
    }, [_loadAndCheckPlatforms]); // Use the callback


    // Select platform and save preference
    const selectPlatform = useCallback(async (platformId) => {
      // Add validation check
      if (!platforms.some(p => p.id === platformId)) {
        console.error('Attempted to select invalid platform:', platformId);
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
          [STORAGE_KEYS.LAST_ACTIVE_TAB]: tabId
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
        console.error('Error setting platform preference:', error);
        // Optionally revert state or show error
        return false;
      }
    }, [tabId, selectedPlatformId, interfaceType, globalStorageKey, platforms, onStatusUpdate, loadModels]); // Added dependencies


    // Select model and save preference
    const selectModel = useCallback(async (modelId) => {
      // Add validation check
      if (!models.some(m => m.id === modelId)) {
        console.error('Attempted to select invalid model:', modelId);
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
        console.error('Error setting model preference:', error);
        // Optionally revert state or show error
        return false;
      }
    }, [tabId, interfaceType, selectedPlatformId, selectedModelId, models]); // Added models dependency


    // Build context value with interface-specific properties
    const contextValue = {
      // Core properties for all interfaces
      platforms,
      selectedPlatformId,
      selectPlatform,
      isLoading,
      // getPlatformConfig removed as it's no longer needed here and fetched old config
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
