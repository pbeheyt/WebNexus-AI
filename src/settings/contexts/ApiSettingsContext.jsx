// src/settings/contexts/ApiSettingsContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../shared/logger';
import { STORAGE_KEYS } from '../../shared/constants';
import ConfigService from '../../services/ConfigService';
import CredentialManager from '../../services/CredentialManager';
import { useNotification } from '../../components/feedback/NotificationContext';

const ApiSettingsContext = createContext(null);

export const useApiSettings = () => useContext(ApiSettingsContext);

export const ApiSettingsProvider = ({ children }) => {
  const { success: showSuccessNotification, error: showErrorNotification } =
    useNotification();

  const [platformConfigs, setPlatformConfigs] = useState([]);
  const [allCredentials, setAllCredentials] = useState({});
  const [allAdvancedSettings, setAllAdvancedSettings] = useState({});
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial Data Loading
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [
          loadedPlatformConfigs,
          credentialsResult,
          advancedSettingsResult,
        ] = await Promise.all([
          ConfigService.getAllPlatformConfigs(),
          chrome.storage.local.get(STORAGE_KEYS.API_CREDENTIALS),
          chrome.storage.local.get(STORAGE_KEYS.API_ADVANCED_SETTINGS),
        ]);

        setPlatformConfigs(loadedPlatformConfigs || []);
        setAllCredentials(
          credentialsResult[STORAGE_KEYS.API_CREDENTIALS] || {}
        );
        setAllAdvancedSettings(
          advancedSettingsResult[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {}
        );

        if (loadedPlatformConfigs && loadedPlatformConfigs.length > 0) {
          setSelectedPlatformId(loadedPlatformConfigs[0].id);
        }
      } catch (err) {
        logger.settings.error('Error loading API settings context data:', err);
        setError('Failed to load API settings data.');
        showErrorNotification('Failed to load API settings data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // showErrorNotification is stable

  // Derived State
  const selectedPlatformConfig = useMemo(() => {
    if (!selectedPlatformId || platformConfigs.length === 0) {
      return null;
    }
    return platformConfigs.find((p) => p.id === selectedPlatformId) || null;
  }, [selectedPlatformId, platformConfigs]);

  const credentialsForSelectedPlatform = useMemo(() => {
    if (!selectedPlatformId) {
      return null;
    }
    return allCredentials[selectedPlatformId] || null;
  }, [selectedPlatformId, allCredentials]);

  const advancedSettingsForSelectedPlatform = useMemo(() => {
    if (!selectedPlatformId) {
      return {}; // Return empty object if no platform selected
    }
    return allAdvancedSettings[selectedPlatformId] || {};
  }, [selectedPlatformId, allAdvancedSettings]);

  // Action Functions
  const selectPlatform = useCallback((platformId) => {
    setSelectedPlatformId(platformId);
  }, []);

  const saveApiKey = useCallback(
    async (platformId, apiKey) => {
      if (!apiKey.trim()) {
        showErrorNotification('API Key is required.');
        return false;
      }
      try {
        const validationResult = await CredentialManager.validateCredentials(
          platformId,
          { apiKey }
        );
        if (!validationResult.isValid) {
          showErrorNotification(`Invalid API key: ${validationResult.message}`);
          return false;
        }

        const updatedCredentials = { ...allCredentials, [platformId]: { apiKey } };
        await chrome.storage.local.set({
          [STORAGE_KEYS.API_CREDENTIALS]: updatedCredentials,
        });
        setAllCredentials(() => updatedCredentials);
        showSuccessNotification('API key saved successfully.');
        return true;
      } catch (err) {
        logger.settings.error('Error saving API key in context:', err);
        showErrorNotification(`Failed to save API key: ${err.message}`);
        return false;
      }
    },
    [allCredentials, showErrorNotification, showSuccessNotification]
  );

  const removeApiKey = useCallback(
    async (platformId) => {
      try {
        const updatedCredentials = { ...allCredentials };
        delete updatedCredentials[platformId];
        await chrome.storage.local.set({
          [STORAGE_KEYS.API_CREDENTIALS]: updatedCredentials,
        });
        setAllCredentials(() => updatedCredentials);
        showSuccessNotification('API key removed successfully.');
        return true;
      } catch (err) {
        logger.settings.error('Error removing API key in context:', err);
        showErrorNotification(`Failed to remove API key: ${err.message}`);
        return false;
      }
    },
    [allCredentials, showErrorNotification, showSuccessNotification]
  );

  const saveAdvancedModelSettings = useCallback(
    async (platformId, modelId, mode, settings) => {
      try {
        const updatedAllAdvancedSettings = JSON.parse(JSON.stringify(allAdvancedSettings)); // Deep copy

        if (!updatedAllAdvancedSettings[platformId]) {
          updatedAllAdvancedSettings[platformId] = { default: {}, models: {} };
        }
        if (!updatedAllAdvancedSettings[platformId].models) {
            updatedAllAdvancedSettings[platformId].models = {};
        }
        if (!updatedAllAdvancedSettings[platformId].models[modelId]) {
            updatedAllAdvancedSettings[platformId].models[modelId] = {};
        }
        
        // Merge settings into the correct mode key
        updatedAllAdvancedSettings[platformId].models[modelId][mode] = {
            ...(updatedAllAdvancedSettings[platformId].models[modelId][mode] || {}),
            ...settings,
        };

        await chrome.storage.local.set({
          [STORAGE_KEYS.API_ADVANCED_SETTINGS]: updatedAllAdvancedSettings,
        });
        setAllAdvancedSettings(() => updatedAllAdvancedSettings);
        showSuccessNotification('Advanced settings saved.');
        return true;
      } catch (err) {
        logger.settings.error('Error saving advanced settings in context:', err);
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          showErrorNotification('Sync storage limit reached for advanced settings.', 10000);
        } else {
          showErrorNotification(`Failed to save advanced settings: ${err.message}`);
        }
        return false;
      }
    },
    [allAdvancedSettings, showErrorNotification, showSuccessNotification]
  );

  const resetAdvancedModelSettingsToDefaults = useCallback(
    async (platformId, modelId, mode) => {
      try {
        const updatedAllAdvancedSettings = JSON.parse(JSON.stringify(allAdvancedSettings)); // Deep copy
        let settingsChanged = false;

        if (updatedAllAdvancedSettings[platformId]?.models?.[modelId]?.[mode]) {
          delete updatedAllAdvancedSettings[platformId].models[modelId][mode];
          settingsChanged = true;
          logger.settings.info(`Reset advanced settings for ${platformId}/${modelId}/${mode}.`);

          // Clean up model entry if both base and thinking modes are now empty or non-existent
          const modelEntry = updatedAllAdvancedSettings[platformId].models[modelId];
          if (modelEntry && Object.keys(modelEntry).every(key => !modelEntry[key] || Object.keys(modelEntry[key]).length === 0)) {
            delete updatedAllAdvancedSettings[platformId].models[modelId];
            logger.settings.info(`Removed empty model entry for ${platformId}/${modelId}.`);
          }

          // Clean up 'models' object for the platform if it becomes empty
          if (updatedAllAdvancedSettings[platformId].models && Object.keys(updatedAllAdvancedSettings[platformId].models).length === 0) {
            delete updatedAllAdvancedSettings[platformId].models;
            logger.settings.info(`Removed empty 'models' object for platform ${platformId}.`);
          }

          // Clean up platform entry itself if it becomes entirely empty (e.g., only had models and now models is gone)
          if (Object.keys(updatedAllAdvancedSettings[platformId]).length === 0) {
            delete updatedAllAdvancedSettings[platformId];
            logger.settings.info(`Removed empty platform entry for ${platformId}.`);
          }
        } else {
          logger.settings.info(`No settings found to reset for ${platformId}/${modelId}/${mode}.`);
        }

        if (settingsChanged) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.API_ADVANCED_SETTINGS]: updatedAllAdvancedSettings,
          });
          setAllAdvancedSettings(() => updatedAllAdvancedSettings);
        }
        showSuccessNotification('Advanced settings reset to configuration defaults.');
        return true;
      } catch (err) {
        logger.settings.error('Error resetting advanced settings in context:', err);
        showErrorNotification(`Failed to reset advanced settings: ${err.message}`);
        return false;
      }
    },
    [allAdvancedSettings, showErrorNotification, showSuccessNotification]
  );


  const contextValue = useMemo(
    () => ({
      platformConfigs,
      allCredentials,
      allAdvancedSettings,
      selectedPlatformId,
      isLoading,
      error,
      selectedPlatformConfig,
      credentialsForSelectedPlatform,
      advancedSettingsForSelectedPlatform,
      selectPlatform,
      saveApiKey,
      removeApiKey,
      saveAdvancedModelSettings,
      resetAdvancedModelSettingsToDefaults,
    }),
    [
      platformConfigs,
      allCredentials,
      allAdvancedSettings,
      selectedPlatformId,
      isLoading,
      error,
      selectedPlatformConfig,
      credentialsForSelectedPlatform,
      advancedSettingsForSelectedPlatform,
      selectPlatform,
      saveApiKey,
      removeApiKey,
      saveAdvancedModelSettings,
      resetAdvancedModelSettingsToDefaults,
    ]
  );

  return (
    <ApiSettingsContext.Provider value={contextValue}>
      {children}
    </ApiSettingsContext.Provider>
  );
};

ApiSettingsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
