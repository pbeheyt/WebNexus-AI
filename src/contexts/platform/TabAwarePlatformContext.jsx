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
 * This version introduces a "stable state" layer to prevent UI "jank" during
 * asynchronous data loading (e.g., when switching platforms). The UI remains
 * bound to the stable state, which is only updated once all new data is ready.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.interfaceType - Interface type (popup or sidepanel)
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
    // Fundamental state
    const [tabId, setTabId] = useState(null);

    // --- Hook Orchestration (Transient State) ---
    // These hooks fetch the latest data but are not exposed directly to the UI.
    const {
      platformConfigs,
      isLoading: isLoadingConfigs,
      error: configError,
    } = usePlatformConfigurations();

    const {
      credentialStatus,
      hasAnyPlatformCredentials,
      isLoading: isLoadingCredentials,
      error: credentialError,
    } = useCredentialStatus(platformConfigs, interfaceType);

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

    const {
      models,
      selectedModelId,
      selectModel,
      isLoading: isLoadingModels,
      error: modelError,
    } = useModelManagement(selectedPlatformId, tabId, interfaceType);
    // --- End Hook Orchestration ---

    // --- Stable State (UI-Facing) ---
    // This state is what the UI components will consume. It's only updated
    // when all transient loading is complete.
    const [stablePlatformConfigs, setStablePlatformConfigs] = useState([]);
    const [stableCredentialStatus, setStableCredentialStatus] = useState({});
    const [stableSelectedPlatformId, setStableSelectedPlatformId] =
      useState(null);
    const [stableSelectedModelId, setStableSelectedModelId] = useState(null);
    const [stableModels, setStableModels] = useState([]);
    const [
      stableHasAnyPlatformCredentials,
      setStableHasAnyPlatformCredentials,
    ] = useState(false);
    const [stableError, setStableError] = useState(null);

    // Determine overall loading state
    const isLoading = useMemo(() => {
      if (!tabId) return true;
      return (
        isLoadingConfigs ||
        isLoadingSelection ||
        isLoadingCredentials ||
        isLoadingModels
      );
    }, [
      tabId,
      isLoadingConfigs,
      isLoadingSelection,
      isLoadingCredentials,
      isLoadingModels,
    ]);

    // Determine overall error state
    const error = useMemo(() => {
      return configError || credentialError || modelError || null;
    }, [configError, credentialError, modelError]);

    // --- Synchronization Effect ---
    // This is the core of the stable state pattern. It copies the loaded
    // transient data to the stable state *only when loading is complete*.
    useEffect(() => {
      if (!isLoading) {
        setStablePlatformConfigs(platformConfigs);
        setStableCredentialStatus(credentialStatus);
        setStableSelectedPlatformId(selectedPlatformId);
        setStableSelectedModelId(selectedModelId);
        setStableModels(models);
        setStableHasAnyPlatformCredentials(hasAnyPlatformCredentials);
        setStableError(error);
      }
    }, [
      isLoading,
      platformConfigs,
      credentialStatus,
      selectedPlatformId,
      selectedModelId,
      models,
      hasAnyPlatformCredentials,
      error,
    ]);

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

    // Function to get API config
    const getPlatformApiConfig = useCallback((platformId) => {
      return ConfigService.getPlatformApiConfig(platformId);
    }, []);

    // Construct final platforms array from STABLE data
    const stablePlatforms = useMemo(() => {
      if (configError) return [];
      return stablePlatformConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        url: config.url || null,
        iconUrl: config.iconUrl,
        hasCredentials:
          interfaceType === INTERFACE_SOURCES.SIDEPANEL
            ? stableCredentialStatus[config.id] || false
            : true,
      }));
    }, [stablePlatformConfigs, stableCredentialStatus, configError]);

    // Build the context value from STABLE data
    const contextValue = useMemo(() => {
      const baseValue = {
        platforms: stablePlatforms,
        selectedPlatformId: stableSelectedPlatformId,
        selectPlatform: selectPlatformInternal, // Expose the internal selector to trigger changes
        isLoading, // Expose the real-time loading state for subtle UI indicators
        error: stableError,
        getPlatformApiConfig,
        tabId,
        setTabId,
      };

      if (interfaceType === INTERFACE_SOURCES.SIDEPANEL) {
        return {
          ...baseValue,
          models: modelError ? [] : stableModels,
          selectedModel: stableSelectedModelId,
          selectModel, // Expose internal selector
          hasAnyPlatformCredentials: credentialError
            ? false
            : stableHasAnyPlatformCredentials,
        };
      }

      return baseValue;
    }, [
      stablePlatforms,
      stableSelectedPlatformId,
      selectPlatformInternal,
      isLoading,
      stableError,
      getPlatformApiConfig,
      tabId,
      stableModels,
      stableSelectedModelId,
      selectModel,
      stableHasAnyPlatformCredentials,
      modelError,
      credentialError,
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
