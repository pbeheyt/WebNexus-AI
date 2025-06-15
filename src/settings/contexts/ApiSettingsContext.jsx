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
import { robustDeepClone } from '../../shared/utils/object-utils';
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
  const [allModelParameterSettings, setAllModelParameterSettings] = useState(
    {}
  );
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
          chrome.storage.local.get(STORAGE_KEYS.MODEL_PARAMETER_SETTINGS),
        ]);

        setPlatformConfigs(loadedPlatformConfigs || []);
        setAllCredentials(
          credentialsResult[STORAGE_KEYS.API_CREDENTIALS] || {}
        );
        setAllModelParameterSettings(
          advancedSettingsResult[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {}
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

  const modelParametersForSelectedPlatform = useMemo(() => {
    if (!selectedPlatformId) {
      return {}; // Return empty object if no platform selected
    }
    return allModelParameterSettings[selectedPlatformId] || {};
  }, [selectedPlatformId, allModelParameterSettings]);

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

        const updatedCredentials = {
          ...allCredentials,
          [platformId]: { apiKey },
        };
        await chrome.storage.local.set({
          [STORAGE_KEYS.API_CREDENTIALS]: updatedCredentials,
        });
        setAllCredentials(() => updatedCredentials);
        showSuccessNotification('API key saved successfully.');
        return true;
      } catch (err) {
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          showErrorNotification(
            'Local storage limit reached. Could not save API key.'
          );
        } else {
          logger.settings.error('Error saving API key in context:', err);
          showErrorNotification(`Failed to save API key: ${err.message}`);
        }
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
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          showErrorNotification(
            'Local storage limit reached. Could not remove API key.'
          );
        } else {
          logger.settings.error('Error removing API key in context:', err);
          showErrorNotification(`Failed to remove API key: ${err.message}`);
        }
        return false;
      }
    },
    [allCredentials, showErrorNotification, showSuccessNotification]
  );

  const saveModelParametersSettings = useCallback(
    async (platformId, modelId, mode, settings, changedParamsList = []) => {
      try {
        const updatedAllModelParameterSettings =
          robustDeepClone(allModelParameterSettings);

        if (!updatedAllModelParameterSettings[platformId]) {
          updatedAllModelParameterSettings[platformId] = { models: {} };
        }
        if (!updatedAllModelParameterSettings[platformId].models) {
          updatedAllModelParameterSettings[platformId].models = {};
        }
        if (!updatedAllModelParameterSettings[platformId].models[modelId]) {
          updatedAllModelParameterSettings[platformId].models[modelId] = {};
        }

        // Merge settings into the correct mode key
        updatedAllModelParameterSettings[platformId].models[modelId][mode] = {
          ...(updatedAllModelParameterSettings[platformId].models[modelId][
            mode
          ] || {}),
          ...settings,
        };

        await chrome.storage.local.set({
          [STORAGE_KEYS.MODEL_PARAMETER_SETTINGS]:
            updatedAllModelParameterSettings,
        });
        setAllModelParameterSettings(() => updatedAllModelParameterSettings);

        // Updated success notification
        let successMessage = `Model parameters for '${modelId}' saved.`;
        if (changedParamsList.length > 0) {
          const paramsString = changedParamsList.join(', ');
          if (changedParamsList.length <= 3) {
            // Show all if 3 or less
            successMessage = `Updated ${paramsString} for '${modelId}'.`;
          } else {
            // Show count if more than 3
            successMessage = `Updated ${changedParamsList.length} parameters for '${modelId}'.`;
          }
        }
        showSuccessNotification(successMessage);
        return true;
      } catch (err) {
        logger.settings.error('Error saving model parameters in context:', err);
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          showErrorNotification(
            'Local storage limit reached for model parameters.'
          );
        } else {
          showErrorNotification(
            `Failed to save model parameters: ${err.message}`
          );
        }
        return false;
      }
    },
    [allModelParameterSettings, showErrorNotification, showSuccessNotification]
  );

  const resetModelParametersSettingsToDefaults = useCallback(
    async (platformId, modelId, mode) => {
      try {
        const updatedAllModelParameterSettings =
          robustDeepClone(allModelParameterSettings);
        let settingsChanged = false;

        if (
          updatedAllModelParameterSettings[platformId]?.models?.[modelId]?.[
            mode
          ]
        ) {
          delete updatedAllModelParameterSettings[platformId].models[modelId][
            mode
          ];
          settingsChanged = true;
          logger.settings.info(
            `Reset model parameters for ${platformId}/${modelId}/${mode}.`
          );

          // Clean up model entry if both base and thinking modes are now empty or non-existent
          const modelEntry =
            updatedAllModelParameterSettings[platformId].models[modelId];
          if (
            modelEntry &&
            Object.keys(modelEntry).every(
              (key) =>
                !modelEntry[key] || Object.keys(modelEntry[key]).length === 0
            )
          ) {
            delete updatedAllModelParameterSettings[platformId].models[modelId];
            logger.settings.info(
              `Removed empty model entry for ${platformId}/${modelId}.`
            );
          }

          // Clean up 'models' object for the platform if it becomes empty
          if (
            updatedAllModelParameterSettings[platformId].models &&
            Object.keys(updatedAllModelParameterSettings[platformId].models)
              .length === 0
          ) {
            delete updatedAllModelParameterSettings[platformId].models;
            logger.settings.info(
              `Removed empty 'models' object for platform ${platformId}.`
            );
          }

          // Clean up platform entry itself if it becomes entirely empty (e.g., only had models and now models is gone)
          if (
            Object.keys(updatedAllModelParameterSettings[platformId]).length ===
            0
          ) {
            delete updatedAllModelParameterSettings[platformId];
            logger.settings.info(
              `Removed empty platform entry for ${platformId}.`
            );
          }
        } else {
          logger.settings.info(
            `No settings found to reset for ${platformId}/${modelId}/${mode}.`
          );
        }

        if (settingsChanged) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.MODEL_PARAMETER_SETTINGS]:
              updatedAllModelParameterSettings,
          });
          setAllModelParameterSettings(() => updatedAllModelParameterSettings);
        }
        // Updated success notification
        showSuccessNotification(
          `Model parameters for '${modelId}' reset to configuration defaults.`
        );
        return true;
      } catch (err) {
        logger.settings.error(
          'Error resetting model parameters in context:',
          err
        );
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          showErrorNotification(
            'Local storage limit reached. Could not reset parameters.'
          );
        } else {
          showErrorNotification(
            `Failed to reset model parameters: ${err.message}`
          );
        }
        return false;
      }
    },
    [allModelParameterSettings, showErrorNotification, showSuccessNotification]
  );

  const contextValue = useMemo(
    () => ({
      platformConfigs,
      allCredentials,
      allModelParameterSettings,
      selectedPlatformId,
      isLoading,
      error,
      selectedPlatformConfig,
      credentialsForSelectedPlatform,
      modelParametersForSelectedPlatform,
      selectPlatform,
      saveApiKey,
      removeApiKey,
      saveModelParametersSettings,
      resetModelParametersSettingsToDefaults,
    }),
    [
      platformConfigs,
      allCredentials,
      allModelParameterSettings,
      selectedPlatformId,
      isLoading,
      error,
      selectedPlatformConfig,
      credentialsForSelectedPlatform,
      modelParametersForSelectedPlatform,
      selectPlatform,
      saveApiKey,
      removeApiKey,
      saveModelParametersSettings,
      resetModelParametersSettingsToDefaults,
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
