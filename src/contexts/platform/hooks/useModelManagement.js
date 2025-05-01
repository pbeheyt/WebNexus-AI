// src/contexts/platform/hooks/useModelManagement.js
import { useState, useEffect, useCallback } from 'react';

import { robustSendMessage } from '../../../shared/utils/message-utils';
import { logger } from '../../../shared/logger';
import ModelParameterService from '../../../services/ModelParameterService';
import { INTERFACE_SOURCES } from '../../../shared/constants';
import ConfigService from '../../../services/ConfigService';

/**
 * Hook to manage fetching available models and selecting the active model (Sidebar only).
 * @param {string|null} selectedPlatformId - The ID of the currently selected platform.
 * @param {number|null} tabId - The current tab ID.
 * @param {string} interfaceType - The type of interface (e.g., 'sidebar', 'popup').
 * @returns {{models: Array, selectedModelId: string|null, selectModel: Function, isLoading: boolean, error: Error|null}}
 */
export function useModelManagement(selectedPlatformId, tabId, interfaceType) {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to load models and determine initial selection
  const loadModelsAndSelect = useCallback(async () => {
    if (
      interfaceType !== INTERFACE_SOURCES.SIDEBAR ||
      !selectedPlatformId ||
      !tabId
    ) {
      setModels([]);
      setSelectedModelId(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    let loadedModels = []; // Store loaded models temporarily

    try {
      // 1. Fetch Models
      const response = await robustSendMessage({
        action: 'getApiModels',
        platformId: selectedPlatformId,
        source: interfaceType,
      });

      if (response && response.success && response.models) {
        loadedModels = response.models;
        setModels(loadedModels); // Update state with fetched models
      } else {
        throw new Error(
          response?.error || `Failed to load models for ${selectedPlatformId}`
        );
      }

      // 2. Determine Model to Use (only if models were loaded successfully)
      if (loadedModels.length > 0) {
        let finalModelIdToUse = null;
        try {
          const preferredModelId = await ModelParameterService.resolveModel(
            selectedPlatformId,
            { tabId, source: interfaceType }
          );

          if (
            preferredModelId &&
            loadedModels.some((m) => m.id === preferredModelId)
          ) {
            finalModelIdToUse = preferredModelId;
            logger.context.info(
              `Using preferred model for ${selectedPlatformId}: ${finalModelIdToUse}`
            );
          } else {
            const platformApiConfig = await ConfigService.getPlatformApiConfig(
              selectedPlatformId
            );
            const defaultModelId = platformApiConfig?.defaultModel;

            if (
              defaultModelId &&
              loadedModels.some((m) => m.id === defaultModelId)
            ) {
              finalModelIdToUse = defaultModelId;
              logger.context.info(
                `No valid preference found, using default model for ${selectedPlatformId}: ${finalModelIdToUse}`
              );
            } else {
              finalModelIdToUse = loadedModels[0].id; // Fallback to first
              logger.context.warn(
                `No valid default model, falling back to first available for ${selectedPlatformId}: ${finalModelIdToUse}`
              );
            }
          }
        } catch (resolveError) {
          logger.context.error(
            `Error resolving model for ${selectedPlatformId}:`,
            resolveError
          );
          // Attempt fallback on resolve error
          const platformApiConfig = await ConfigService.getPlatformApiConfig(
            selectedPlatformId
          );
          const defaultModelId = platformApiConfig?.defaultModel;
          if (
            defaultModelId &&
            loadedModels.some((m) => m.id === defaultModelId)
          ) {
            finalModelIdToUse = defaultModelId;
          } else {
            finalModelIdToUse = loadedModels[0]?.id || null; // Fallback to first or null
          }
        }
        setSelectedModelId(finalModelIdToUse);
      } else {
        setSelectedModelId(null); // No models available
      }
    } catch (err) {
      logger.context.error(
        `Error in model loading/selection for ${selectedPlatformId}:`,
        err
      );
      setError(err);
      setModels([]);
      setSelectedModelId(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlatformId, tabId, interfaceType]);

  // Effect to trigger model loading when platform changes
  useEffect(() => {
    loadModelsAndSelect();
  }, [loadModelsAndSelect]); // Dependency is the memoized function itself

  // Callback to handle model selection
  const selectModel = useCallback(
    async (modelId) => {
      if (
        interfaceType !== INTERFACE_SOURCES.SIDEBAR ||
        !selectedPlatformId ||
        !tabId ||
        modelId === selectedModelId || // No change needed
        !models.some((m) => m.id === modelId) // Validate selection
      ) {
        if (!models.some((m) => m.id === modelId)) {
          logger.context.error('Attempted to select invalid model:', modelId);
        }
        return false;
      }

      try {
        setSelectedModelId(modelId); // Update state immediately

        // Use centralized ModelParameterService to save preferences
        await ModelParameterService.saveTabModelPreference(
          tabId,
          selectedPlatformId,
          modelId
        );
        await ModelParameterService.saveSourceModelPreference(
          interfaceType,
          selectedPlatformId,
          modelId
        );
        return true;
      } catch (err) {
        logger.context.error('Error setting model preference:', err);
        // Optionally revert state or show error
        return false;
      }
    },
    [
      interfaceType,
      selectedPlatformId,
      tabId,
      selectedModelId,
      models, // Need models for validation
    ]
  );

  return { models, selectedModelId, selectModel, isLoading, error };
}