// src/contexts/platform/hooks/usePlatformConfigurations.js
import { useState, useEffect } from 'react';

import ConfigService from '../../../services/ConfigService';
import { logger } from '../../../shared/logger';

/**
 * Hook to fetch and provide platform configurations.
 * @returns {{platformConfigs: Array, isLoading: boolean, error: Error|null}}
 */
export function usePlatformConfigurations() {
  const [platformConfigs, setPlatformConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchConfigs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const configs = await ConfigService.getAllPlatformConfigs();
        if (isMounted) {
          setPlatformConfigs(configs);
        }
      } catch (err) {
        logger.context.error('Error fetching platform configurations:', err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchConfigs();

    return () => {
      isMounted = false;
    };
  }, []);

  return { platformConfigs, isLoading, error };
}
