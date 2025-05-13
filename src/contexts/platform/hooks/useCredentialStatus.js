// src/contexts/platform/hooks/useCredentialStatus.js
import { useState, useEffect, useCallback } from 'react';

import { robustSendMessage } from '../../../shared/utils/message-utils';
import { logger } from '../../../shared/logger';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../../shared/constants';

/**
 * Hook to fetch and manage API credential status, specifically for the Sidepanel.
 * Listens for changes in credential storage.
 * @param {Array} platformConfigs - Array of platform configuration objects.
 * @param {string} interfaceType - The type of interface (e.g., 'sidepanel', 'popup').
 * @returns {{credentialStatus: Object, hasAnyPlatformCredentials: boolean, isLoading: boolean, error: Error|null}}
 */
export function useCredentialStatus(platformConfigs, interfaceType) {
  const [credentialStatus, setCredentialStatus] = useState({});
  const [hasAnyPlatformCredentials, setHasAnyPlatformCredentials] =
    useState(false);
  const [isLoading, setIsLoading] = useState(
    interfaceType === INTERFACE_SOURCES.SIDEPANEL
  ); // Only loading for sidepanel initially
  const [error, setError] = useState(null);

  const fetchCredentials = useCallback(async () => {
    if (interfaceType !== INTERFACE_SOURCES.SIDEPANEL || !platformConfigs.length) {
      setIsLoading(false);
      setCredentialStatus({});
      setHasAnyPlatformCredentials(false); // No creds needed/checked for popup
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const platformIds = platformConfigs.map((p) => p.id);
      const response = await robustSendMessage({
        action: 'credentialOperation',
        operation: 'checkMultiple',
        platformIds,
      });

      if (response && response.success && response.results) {
        const newStatus = response.results;
        setCredentialStatus(newStatus);
        setHasAnyPlatformCredentials(Object.values(newStatus).some(Boolean));
      } else {
        throw new Error(
          response?.error || 'Failed to check credentials via background script'
        );
      }
    } catch (err) {
      logger.context.error('Error fetching credential status:', err);
      setError(err);
      setCredentialStatus({});
      setHasAnyPlatformCredentials(false);
    } finally {
      setIsLoading(false);
    }
  }, [interfaceType, platformConfigs]); // platformConfigs needed

  // Initial fetch
  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Listener for credential changes in storage (only for sidepanel)
  useEffect(() => {
    if (interfaceType !== INTERFACE_SOURCES.SIDEPANEL) {
      return; // No listener needed for popup
    }

    const handleStorageChange = async (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.API_CREDENTIALS]) {
        logger.context.info(
          'API credentials changed in storage, refreshing status...'
        );
        await fetchCredentials(); // Re-fetch credentials
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      logger.context.info('Removed storage change listener for credentials.');
    };
  }, [fetchCredentials, interfaceType]); // Re-run if fetchCredentials or interfaceType changes

  return { credentialStatus, hasAnyPlatformCredentials, isLoading, error };
}