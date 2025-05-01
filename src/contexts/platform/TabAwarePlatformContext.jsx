// src/contexts/platform/TabAwarePlatformContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';

import { INTERFACE_SOURCES } from '../../shared/constants';
import ConfigService from '../../services/ConfigService';

// Import the new hooks
import {
  usePlatformConfigurations,
  useCredentialStatus,
  usePlatformSelection,
  useModelManagement,
} from './hooks';

/**
 * Creates a tab-aware platform context with shared functionality,
 * now refactored to use internal hooks for logic separation.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.interfaceType - Interface type (popup or sidebar)
 * @param {string} options.globalStorageKey - Key for global preference storage
 * @param {Function} [options.onStatusUpdate=()=>{}] - Optional callback for status updates
 * @returns {Object} Context provider and hook
 */
export function createTabAwarePlatformContext(options = {}) {
  const {
    interfaceType,
    globalStorageKey,
    onStatusUpdate = () => {},
  } = options;

  const TabAwarePlatformContext = createContext(null);

  function TabAwarePlatformProvider({ children }) {
    // State for Tab ID remains here as it's fundamental
    const [tabId, setTabId] = useState(null);

    // --- Hook Orchestration ---

    // 1. Fetch Platform Configurations
    const {
      platformConfigs,
      isLoading: isLoadingConfigs,
      // error: configError, // TODO: Handle or expose errors if needed
    } = usePlatformConfigurations();

    // 2. Fetch Credential Status (depends on configs)
    const {
      credentialStatus,
      hasAnyPlatformCredentials,
      isLoading: isLoadingCredentials,
      // error: credentialError, // TODO: Handle or expose errors if needed
    } = useCredentialStatus(platformConfigs, interfaceType);

    // 3. Manage Platform Selection (depends on tabId, configs, creds)
    const {
      selectedPlatformId,
      selectPlatform: selectPlatformInternal,
      isLoading: isLoadingSelection,
    } = usePlatformSelection(
      tabId,
      globalStorageKey,
      platformConfigs,
      credentialStatus,
      onStatusUpdate // Pass the status update callback
    );

    // 4. Manage Model Selection (depends on selectedPlatformId, tabId)
    const {
      models,
      selectedModelId,
      selectModel,
      isLoading: isLoadingModels,
      // error: modelError, // TODO: Handle or expose errors if needed
    } = useModelManagement(selectedPlatformId, tabId, interfaceType);

    // --- End Hook Orchestration ---

    // Determine overall loading state
    const isLoading = useMemo(() => {
        // Need tabId before anything else can load properly
        if (!tabId) return true;
        // Then wait for configs, selection logic, and potentially credentials/models
        return isLoadingConfigs || isLoadingSelection || isLoadingCredentials || isLoadingModels;
    }, [tabId, isLoadingConfigs, isLoadingSelection, isLoadingCredentials, isLoadingModels]);


    // Get current tab ID on mount
    useEffect(() => {
      const getCurrentTab = async () => {
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs && tabs[0]) {
            setTabId(tabs[0].id);
          } else {
             // No active tab found, loading will remain true until tabId is set
             console.warn('Could not get active tab ID.');
          }
        } catch (error) {
          console.error('Error getting current tab:', error);
           // Handle error, maybe set an error state? Loading remains true.
        }
      };
      getCurrentTab();
    }, []);


    // Function to get API config (remains simple)
    const getPlatformApiConfig = useCallback((platformId) => {
      return ConfigService.getPlatformApiConfig(platformId);
    }, []);

    // Construct final platforms array with credential status
    const platforms = useMemo(() => {
      return platformConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        url: config.url || null,
        iconUrl: config.iconUrl,
        hasCredentials:
          interfaceType === INTERFACE_SOURCES.SIDEBAR
            ? credentialStatus[config.id] || false
            : true, // Popups don't check/need creds here
      }));
    }, [platformConfigs, credentialStatus, interfaceType]);


    // Build the context value
    const contextValue = useMemo(() => {
      const baseValue = {
        platforms,
        selectedPlatformId,
        selectPlatform: selectPlatformInternal, // Use the function from the hook
        isLoading,
        getPlatformApiConfig,
        tabId,
        setTabId, // Expose setTabId if needed externally (e.g., for testing or specific scenarios)
      };

      if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
        return {
          ...baseValue,
          models,
          selectedModel: selectedModelId, // Rename for consistency
          selectModel,
          hasAnyPlatformCredentials,
        };
      }

      return baseValue;
    }, [
        platforms,
        selectedPlatformId,
        selectPlatformInternal,
        isLoading,
        getPlatformApiConfig,
        tabId,
        models,
        selectedModelId,
        selectModel,
        hasAnyPlatformCredentials
    ]);


    return (
      <TabAwarePlatformContext.Provider value={contextValue}>
        {children}
      </TabAwarePlatformContext.Provider>
    );
  }

  TabAwarePlatformProvider.propTypes = {
    children: PropTypes.node.isRequired,
  };

  // Custom hook to use the context remains the same
  const useTabAwarePlatform = () => {
    const context = useContext(TabAwarePlatformContext);
    if (!context) {
      throw new Error(
        `use${interfaceType.charAt(0).toUpperCase() + interfaceType.slice(1)}Platform must be used within a ${interfaceType}PlatformProvider`
      );
    }
    return context;
  };

  return {
    TabAwarePlatformContext,
    TabAwarePlatformProvider,
    useTabAwarePlatform,
  };
}