// src/platforms/platform-interface.js

/**
 * Interface defining the public contract that all AI platform implementations must follow.
 * This contract is consumed by external modules like the PlatformFactory.
 */
class PlatformInterface {
  /**
   * Checks if the current page URL belongs to this specific AI platform.
   * This is called by the factory to determine which platform to activate.
   * @returns {boolean} True if the current page is a match for this platform.
   * @abstract
   */
  isCurrentPlatform() {
    throw new Error('isCurrentPlatform must be implemented by subclasses');
  }

  /**
   * Initialize the platform integration.
   * This is the main entry point called by the content script.
   * @returns {Promise<void>}
   * @abstract
   */
  async initialize() {
    throw new Error('initialize must be implemented by subclasses');
  }
}

export default PlatformInterface;
