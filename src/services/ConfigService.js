// src/services/ConfigService.js
import { logger } from '../shared/logger.js';

let cachedApiConfig = null;
let cachedDisplayConfig = null;

/**
 * Internal helper to load configuration with caching.
 * @param {string} urlPath - The path relative to the extension root (e.g., 'platform-api-config.json').
 * @param {object | null} cacheRef - Reference to the module-level cache variable.
 * @returns {Promise<object>} - The loaded configuration object.
 */
async function _loadConfig(urlPath, cacheRef) {
  if (cacheRef) {
    logger.service.info(`ConfigService: Cache hit for ${urlPath}`);
    return cacheRef;
  }

  logger.service.info(
    `ConfigService: Loading configuration from ${urlPath}...`
  );
  try {
    const response = await fetch(chrome.runtime.getURL(urlPath));
    if (!response.ok) {
      throw new Error(`Failed to fetch ${urlPath}: ${response.statusText}`);
    }
    const config = await response.json();
    // Update the cache indirectly by returning the loaded config,
    // the caller will assign it to the cache variable.
    logger.service.info(`ConfigService: Successfully loaded ${urlPath}.`);
    return config;
  } catch (error) {
    logger.service.error(
      `ConfigService: Error loading configuration from ${urlPath}:`,
      error
    );
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Gets the entire API configuration object, loading and caching if necessary.
 * @returns {Promise<object>} The API configuration object.
 */
async function getApiConfig() {
  if (!cachedApiConfig) {
    cachedApiConfig = await _loadConfig(
      'platform-api-config.json',
      cachedApiConfig
    );
  }
  return cachedApiConfig;
}

/**
 * Gets the entire display configuration object, loading and caching if necessary.
 * @returns {Promise<object>} The display configuration object.
 */
async function getDisplayConfig() {
  if (!cachedDisplayConfig) {
    cachedDisplayConfig = await _loadConfig(
      'platform-display-config.json',
      cachedDisplayConfig
    );
  }
  return cachedDisplayConfig;
}

/**
 * Gets the API configuration for a specific platform.
 * @param {string} platformId - The ID of the platform.
 * @returns {Promise<object|null>} The API configuration for the platform, or null if not found.
 */
async function getPlatformApiConfig(platformId) {
  try {
    const config = await getApiConfig();
    return config?.aiPlatforms?.[platformId] || null;
  } catch (error) {
    logger.service.error(
      `ConfigService: Error getting API config for platform ${platformId}:`,
      error
    );
    return null;
  }
}

/**
 * Gets the display configuration for a specific platform.
 * @param {string} platformId - The ID of the platform.
 * @returns {Promise<object|null>} The display configuration for the platform, or null if not found.
 */
async function getPlatformDisplayConfig(platformId) {
  try {
    const config = await getDisplayConfig();
    return config?.aiPlatforms?.[platformId] || null;
  } catch (error) {
    logger.service.error(
      `ConfigService: Error getting display config for platform ${platformId}:`,
      error
    );
    return null;
  }
}

/**
 * Gets a combined list of all platform configurations (display + API).
 * Useful for UI components needing comprehensive platform info.
 * @returns {Promise<Array<object>>} A list of combined platform configuration objects.
 */
async function getAllPlatformConfigs() {
  try {
    const [displayConfig, apiConfigData] = await Promise.all([
      getDisplayConfig(),
      getApiConfig(),
    ]);

    if (!displayConfig?.aiPlatforms || !apiConfigData?.aiPlatforms) {
      throw new Error(
        'AI platforms configuration not found in one or both files'
      );
    }

    const platformList = Object.keys(displayConfig.aiPlatforms)
      .map((id) => {
        const displayInfo = displayConfig.aiPlatforms[id];
        const apiInfo = apiConfigData.aiPlatforms[id];

        if (!displayInfo || !apiInfo) {
          logger.service.warn(
            `ConfigService: Missing config for platform ID: ${id} during getAllPlatformConfigs`
          );
          return null; // Skip if data is incomplete
        }

        return {
          id,
          name: displayInfo.name,
          url: displayInfo.url,
          iconUrl: chrome.runtime.getURL(displayInfo.icon),
          docApiLink: displayInfo.docApiLink || '#',
          modelApiLink: displayInfo.modelApiLink || '#',
          consoleApiLink: displayInfo.consoleApiLink || '#',
          keyApiLink: displayInfo.keyApiLink || '#',
          apiConfig: apiInfo, // Attach the whole API config object
        };
      })
      .filter((p) => p !== null); // Filter out any null entries

    return platformList;
  } catch (error) {
    logger.service.error(
      'ConfigService: Error getting all platform configs:',
      error
    );
    return []; // Return empty array on error
  }
}


// Define the ConfigService object with all exported functions
const ConfigService = {
  getApiConfig,
  getDisplayConfig,
  getPlatformApiConfig,
  getPlatformDisplayConfig,
  getAllPlatformConfigs
};

export default ConfigService;
