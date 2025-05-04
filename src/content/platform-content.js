// src/content/platform-content.js
import PlatformFactory from '../platforms/platform-factory.js';
import { logger } from '../shared/logger.js';

/**
 * Entry point for platform integration
 * This is the content script that will be injected into the AI platform pages
 */
(async () => {
  try {
    // Create the appropriate platform for the current page
    const platform = PlatformFactory.createPlatform();

    if (platform) {
      // Initialize the platform
      await platform.initialize();
    } else {
      logger.platform.warn('No matching AI platform found for the current page');
    }
  } catch (error) {
    logger.platform.error('Error initializing AI platform integration:', error);
  }
})();
