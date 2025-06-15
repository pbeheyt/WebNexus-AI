// src/contexts/platform/hooks/usePlatformSelection.js
import { useState, useEffect, useCallback } from 'react';

import { logger } from '../../../shared/logger';
import { INTERFACE_SOURCES } from '../../../shared/constants';

/**
 * Hook to manage the selection of the active platform based on preferences and availability.
 * @param {number|null} tabId - The current tab ID.
 * @param {string} globalStorageKey - The storage key for the global platform preference.
 * @param {Array} platformConfigs - Array of platform configuration objects.
 * @param {Object} credentialStatus - Object mapping platform IDs to credential availability (Sidepanel only).
 * @param {string} interfaceType - The type of interface (e.g., 'sidepanel', 'popup').
 * @param {Function} onPlatformSelected - Callback function when platform selection changes.
 * @returns {{selectedPlatformId: string|null, selectPlatform: Function, isLoading: boolean}}
 */
export function usePlatformSelection(
  tabId,
  globalStorageKey,
  platformConfigs,
  credentialStatus,
  interfaceType,
  onPlatformSelected = () => {}
) {
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to determine initial platform selection
  useEffect(() => {
    if (!tabId || !platformConfigs.length) {
      // Don't try to select if tabId or configs aren't ready
      // Keep loading true until tabId and configs are available
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    const determineInitialPlatform = async () => {
      try {
        // Construct available platforms based on credentials (for sidepanel)
        const availablePlatforms = platformConfigs.filter((config) =>
          interfaceType === INTERFACE_SOURCES.SIDEPANEL
            ? credentialStatus[config.id] || false
            : true
        );
        const availablePlatformIds = new Set(
          availablePlatforms.map((p) => p.id)
        );

        if (
          availablePlatforms.length === 0 &&
          interfaceType === INTERFACE_SOURCES.SIDEPANEL
        ) {
          setSelectedPlatformId(null); // No platforms available
          setIsLoading(false);
          return;
        }

        // Get preferences
        const globalPreferences =
          await chrome.storage.sync.get(globalStorageKey);
        const globalPlatformPref = globalPreferences[globalStorageKey];

        let platformToUse = null;

        // Priority 1: Global preference (if valid and available)
        if (
          globalPlatformPref &&
          platformConfigs.some((p) => p.id === globalPlatformPref) && // Check if it's a known platform
          availablePlatformIds.has(globalPlatformPref) // Check if available based on creds
        ) {
          platformToUse = globalPlatformPref;
        }

        // Priority 2: First available platform (if any)
        if (!platformToUse && availablePlatforms.length > 0) {
          platformToUse = availablePlatforms[0].id;
        }

        // Update state only if it changes
        if (platformToUse !== selectedPlatformId) {
          setSelectedPlatformId(platformToUse);
        }
      } catch (error) {
        logger.context.error('Error determining initial platform:', error);
        setSelectedPlatformId(null); // Fallback on error
      } finally {
        setIsLoading(false);
      }
    };

    determineInitialPlatform();
  }, [
    tabId,
    platformConfigs,
    credentialStatus,
    globalStorageKey,
    interfaceType,
    selectedPlatformId, // Ensure effect re-runs if selection changes externally
  ]);

  // Callback to handle platform selection
  const selectPlatform = useCallback(
    async (platformId, options = {}) => {
      if (!platformConfigs.some((p) => p.id === platformId)) {
        logger.context.error(
          'Attempted to select invalid platform:',
          platformId
        );
        return false;
      }
      if (!tabId || platformId === selectedPlatformId) return true;

      try {
        setSelectedPlatformId(platformId); // Update state immediately

        // Update global preference for new tabs, unless opted out
        if (options.savePreference !== false) {
          await chrome.storage.sync.set({ [globalStorageKey]: platformId });
        }

        // Notify parent/context if needed
        const platformName =
          platformConfigs.find((p) => p.id === platformId)?.name || platformId;
        onPlatformSelected(platformName); // Call the provided callback

        return true;
      } catch (error) {
        logger.context.error('Error setting platform preference:', error);
        return false;
      }
    },
    [
      tabId,
      selectedPlatformId,
      platformConfigs,
      globalStorageKey,
      onPlatformSelected,
    ]
  );

  return { selectedPlatformId, selectPlatform, isLoading };
}
