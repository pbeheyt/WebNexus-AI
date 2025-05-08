// src/contexts/platform/hooks/usePlatformSelection.js
import { useState, useEffect, useCallback } from 'react';

import { logger } from '../../../shared/logger';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../../shared/constants';

/**
 * Hook to manage the selection of the active platform based on preferences and availability.
 * @param {number|null} tabId - The current tab ID.
 * @param {string} globalStorageKey - The storage key for the global platform preference.
 * @param {Array} platformConfigs - Array of platform configuration objects.
 * @param {Object} credentialStatus - Object mapping platform IDs to credential availability (Sidebar only).
 * @param {string} interfaceType - The type of interface (e.g., 'sidebar', 'popup').
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
      logger.context.debug(`[usePlatformSelection Effect] Running. Tab ID: ${tabId}, Configs Loaded: ${platformConfigs.length > 0}, Creds Status Changed:`, credentialStatus);
    const determineInitialPlatform = async () => {
      logger.context.debug(`[usePlatformSelection Effect] determineInitialPlatform executing...`);
      try {
        // Construct available platforms based on credentials (for sidebar)
        const availablePlatforms = platformConfigs.filter((config) =>
          interfaceType === INTERFACE_SOURCES.SIDEBAR
            ? credentialStatus[config.id] || false
            : true
        );
        const availablePlatformIds = new Set(
          availablePlatforms.map((p) => p.id)
        );
        logger.context.debug(`[usePlatformSelection Effect] Available platform IDs based on creds:`, Array.from(availablePlatformIds));

        if (availablePlatforms.length === 0 && interfaceType === INTERFACE_SOURCES.SIDEBAR) {
           setSelectedPlatformId(null); // No platforms available
           setIsLoading(false);
           return;
        }

        // Get preferences
        const [tabPreferences, globalPreferences] = await Promise.all([
          chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES),
          chrome.storage.sync.get(globalStorageKey),
        ]);

        const tabPlatformPrefs =
          tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};
        const lastUsedTabPlatform = tabPlatformPrefs[tabId];
        const globalPlatformPref = globalPreferences[globalStorageKey];
        logger.context.debug(`[usePlatformSelection Effect] Preferences - Tab: ${lastUsedTabPlatform}, Global (${globalStorageKey}): ${globalPlatformPref}`);

        let platformToUse = null;

        // Priority 1: Tab-specific preference (ONLY IF SIDEBAR)
        if (
          interfaceType === INTERFACE_SOURCES.SIDEBAR &&
          lastUsedTabPlatform &&
          platformConfigs.some((p) => p.id === lastUsedTabPlatform) && // Check if it's a known platform
          availablePlatformIds.has(lastUsedTabPlatform)                 // Check if available based on creds
        ) {
          platformToUse = lastUsedTabPlatform;
          logger.context.debug(`[usePlatformSelection Effect] Priority 1: Using tab preference for platform: ${platformToUse}`);
        }

        // Priority 2: Global preference (if valid and available)
        if (
          !platformToUse &&
          globalPlatformPref &&
          platformConfigs.some((p) => p.id === globalPlatformPref) && // Check if it's a known platform
          availablePlatformIds.has(globalPlatformPref)                // Check if available based on creds
        ) {
          platformToUse = globalPlatformPref;
          logger.context.debug(`[usePlatformSelection Effect] Priority 2: Using global preference for platform: ${platformToUse}`);
        }

        // Priority 3: First available platform (if any)
        if (!platformToUse && availablePlatforms.length > 0) {
          platformToUse = availablePlatforms[0].id;
          logger.context.debug(`[usePlatformSelection Effect] Priority 3: Using first available platform: ${platformToUse}`);
        }

        // Update state only if it changes
        if (platformToUse !== selectedPlatformId) {
             logger.context.debug(`[usePlatformSelection Effect] Setting selectedPlatformId to: ${platformToUse} (Previous: ${selectedPlatformId})`);
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
    // Re-run if dependencies change, especially credentialStatus
  }, [
    tabId,
    platformConfigs,
    credentialStatus,
    globalStorageKey,
    interfaceType,
    selectedPlatformId // Include selectedPlatformId to prevent unnecessary updates if already set
  ]);

  // Callback to handle platform selection
  const selectPlatform = useCallback(
    async (platformId) => {
      logger.context.debug(`[usePlatformSelection selectPlatform] Invoked with platformId: ${platformId}. Current selected: ${selectedPlatformId}, Tab ID: ${tabId}`);
      if (!platformConfigs.some((p) => p.id === platformId)) {
        logger.context.error(
          'Attempted to select invalid platform:',
          platformId
        );
        return false;
      }
      if (!tabId || platformId === selectedPlatformId) return true; // No change needed

      try {
        logger.context.debug(`[usePlatformSelection selectPlatform] Setting selectedPlatformId to: ${platformId}`);
        setSelectedPlatformId(platformId); // Update state immediately

        // Update tab-specific preference ONLY IF SIDEBAR
        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
          const tabPreferences = await chrome.storage.local.get(
            STORAGE_KEYS.TAB_PLATFORM_PREFERENCES
          );
          const tabPlatformPrefs =
            tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};
          tabPlatformPrefs[tabId] = platformId;
          await chrome.storage.local.set({
            [STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]: tabPlatformPrefs,
          });
          logger.context.debug(`Saved tab preference (Sidebar): Tab ${tabId} -> ${platformId}`);
        }

        // Update global preference for new tabs
        await chrome.storage.sync.set({ [globalStorageKey]: platformId });

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
      interfaceType
    ]
  );

  return { selectedPlatformId, selectPlatform, isLoading };
}
