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
import { logger } from '../../shared/logger';
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
 * now refactored to use internal hooks for logic separation and includes error handling.
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
      error: configError, // Capture config error
    } = usePlatformConfigurations();

    // 2. Fetch Credential Status (depends on configs)
    const {
      credentialStatus,
      hasAnyPlatformCredentials,
      isLoading: isLoadingCredentials,
      error: credentialError, // Capture credential error
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
      interfaceType,
      onStatusUpdate
    );

    // 4. Manage Model Selection (depends on selectedPlatformId, tabId)
    const {
      models,
      selectedModelId,
      selectModel,
      isLoading: isLoadingModels,
      error: modelError, // Capture model error
    } = useModelManagement(selectedPlatformId, tabId, interfaceType);

    // --- End Hook Orchestration ---

    // Determine overall loading state
    const isLoading = useMemo(() => {
        // Need tabId before anything else can load properly
        if (!tabId) return true;
        // Then wait for configs, selection logic, and potentially credentials/models
        // Loading is finished once all dependent hooks are no longer loading
        return isLoadingConfigs || isLoadingSelection || isLoadingCredentials || isLoadingModels;
    }, [tabId, isLoadingConfigs, isLoadingSelection, isLoadingCredentials, isLoadingModels]);

    // Determine overall error state (prioritize first error in sequence)
    const error = useMemo(() => {
        return configError || credentialError || modelError || null;
    }, [configError, credentialError, modelError]);


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
             logger.context.warn('Could not get active tab ID.');
          }
        } catch (err) {
          logger.context.error('Error getting current tab:', err);
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
      // If configs failed to load, return empty array
      if (configError) return [];
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
    }, [platformConfigs, credentialStatus, configError]);


    // Build the context value
    const contextValue = useMemo(() => {
      const baseValue = {
        platforms,
        selectedPlatformId,
        selectPlatform: selectPlatformInternal,
        isLoading,
        error, // Expose the combined error state
        getPlatformApiConfig,
        tabId,
        setTabId,
      };

      if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
        return {
          ...baseValue,
          models: modelError ? [] : models, // Return empty models if model loading failed
          selectedModel: selectedModelId,
          selectModel,
          hasAnyPlatformCredentials: credentialError ? false : hasAnyPlatformCredentials, // Assume no creds if fetch failed
        };
      }

      return baseValue;
    }, [
        platforms,
        selectedPlatformId,
        selectPlatformInternal,
        isLoading,
        error,
        getPlatformApiConfig,
        tabId,
        models,
        selectedModelId,
        selectModel,
        hasAnyPlatformCredentials,
        modelError,
        credentialError
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