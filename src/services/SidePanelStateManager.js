// src/services/SidePanelStateManager.js
import { STORAGE_KEYS } from '../shared/constants';
import { logger } from '../shared/logger';

/**
 * Manages the state of the side panel for each tab,
 * including visibility, preferences, and associated data.
 */
class SidePanelStateManager {
  /**
   * Get the visibility state of the side panel for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<boolean>} - True if the side panel is intended to be visible, false otherwise.
   */
  static async getSidePanelVisibilityForTab(tabId) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: getSidePanelVisibilityForTab called with invalid tabId.'
      );
      return false;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SIDEPANEL_STATES
      );
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
      return !!states[tabId.toString()]; // Default to false if not found
    } catch (error) {
      logger.service.error(
        `Error getting side panel visibility for tab ${tabId}:`,
        error
      );
      return false; // Default to false on error
    }
  }

  /**
   * Set the visibility state of the side panel for a specific tab.
   * If setting to false (closed), it will remove the key for that tab to save space.
   * @param {number} tabId - The ID of the tab.
   * @param {boolean} isVisible - The new visibility state.
   * @returns {Promise<void>}
   */
  static async setSidePanelVisibilityForTab(tabId, isVisible) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: setSidePanelVisibilityForTab called with invalid tabId.'
      );
      return;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SIDEPANEL_STATES
      );
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};

      if (isVisible) {
        states[tabId.toString()] = true;
      } else {
        // If setting to not visible, remove the key for that tab to save storage space
        delete states[tabId.toString()];
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states,
      });
      logger.service.info(
        `Side panel visibility for tab ${tabId} set to ${isVisible} (key ${isVisible ? 'added/updated' : 'removed'}).`
      );
    } catch (error) {
      logger.service.error(
        `Error setting side panel visibility for tab ${tabId}:`,
        error
      );
    }
  }

  /**
   * Resets all side panel visibility states stored. Typically called on browser startup or extension install/update.
   * This effectively clears the TAB_SIDEPANEL_STATES storage key.
   * @returns {Promise<void>}
   */
  static async resetAllSidePanelVisibilityStates() {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
      logger.service.info(
        'All side panel visibility states have been reset (storage key removed).'
      );
    } catch (error) {
      logger.service.error(
        'Error resetting all side panel visibility states:',
        error
      );
    }
  }

  /**
   * Stores the formatted content for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @param {string|null} formattedContent - The formatted content string, or null to clear.
   * @returns {Promise<void>}
   */
  static async storeFormattedContentForTab(tabId, formattedContent) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: storeFormattedContentForTab called with invalid tabId.'
      );
      return;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_FORMATTED_CONTENT
      );
      const allContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};

      if (formattedContent === null || formattedContent === undefined) {
        delete allContents[tabId.toString()];
        logger.service.info(
          `Cleared formatted content for tab ${tabId.toString()}.`
        );
      } else {
        allContents[tabId.toString()] = formattedContent;
        logger.service.info(
          `Stored formatted content for tab ${tabId.toString()}.`
        );
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: allContents,
      });
    } catch (error) {
      logger.service.error(
        `Error storing/clearing formatted content for tab ${tabId}:`,
        error
      );
    }
  }

  /**
   * Retrieves the stored formatted content for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<string|null>} The formatted content string, or null if not found/error.
   */
  static async getFormattedContentForTab(tabId) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: getFormattedContentForTab called with invalid tabId.'
      );
      return null;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_FORMATTED_CONTENT
      );
      const allContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};
      return allContents[tabId.toString()] || null;
    } catch (error) {
      logger.service.error(
        `Error retrieving formatted content for tab ${tabId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Checks if formatted content exists for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<boolean>} True if content exists, false otherwise.
   */
  static async hasFormattedContentForTab(tabId) {
    const content = await this.getFormattedContentForTab(tabId);
    return content !== null && content !== undefined;
  }

  /**
   * Clears the stored formatted content for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<void>}
   */
  static async clearFormattedContentForTab(tabId) {
    await this.storeFormattedContentForTab(tabId, null);
  }

  /**
   * Stores the system prompt for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @param {string|null} systemPrompt - The system prompt string, or null/empty to clear.
   * @returns {Promise<void>}
   */
  static async storeSystemPromptForTab(tabId, systemPrompt) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: storeSystemPromptForTab called with invalid tabId.'
      );
      return;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SYSTEM_PROMPTS
      );
      const allPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] || {};

      if (
        systemPrompt === null ||
        systemPrompt === undefined ||
        systemPrompt.trim() === ''
      ) {
        delete allPrompts[tabId.toString()];
        logger.service.info(
          `Cleared system prompt for tab ${tabId.toString()}.`
        );
      } else {
        allPrompts[tabId.toString()] = systemPrompt;
        logger.service.info(
          `Stored system prompt for tab ${tabId.toString()}.`
        );
      }
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allPrompts,
      });
    } catch (error) {
      logger.service.error(
        `Error storing/clearing system prompt for tab ${tabId}:`,
        error
      );
    }
  }

  /**
   * Retrieves the stored system prompt for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<string|null>} The system prompt string, or null if not found/error.
   */
  static async getSystemPromptForTab(tabId) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: getSystemPromptForTab called with invalid tabId.'
      );
      return null;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SYSTEM_PROMPTS
      );
      const allPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] || {};
      return allPrompts[tabId.toString()] || null;
    } catch (error) {
      logger.service.error(
        `Error retrieving system prompt for tab ${tabId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Cleans up all tab-specific states (visibility, preferences, data) for tabs that are no longer open.
   * @returns {Promise<void>}
   */
  static async cleanupTabStates() {
    logger.service.info(
      'SidePanelStateManager: Starting cleanup of stale tab states.'
    );
    try {
      const openTabs = await chrome.tabs.query({});
      const openTabIds = new Set(openTabs.map((tab) => tab.id.toString()));

      const keysToClean = [
        STORAGE_KEYS.TAB_SIDEPANEL_STATES,
        STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
        STORAGE_KEYS.TAB_MODEL_PREFERENCES,
        STORAGE_KEYS.TAB_CHAT_HISTORIES, // Already handled by ChatHistoryService
        STORAGE_KEYS.TAB_TOKEN_STATISTICS, // Already handled by TokenManagementService
        STORAGE_KEYS.TAB_FORMATTED_CONTENT,
        STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
      ];

      for (const storageKey of keysToClean) {
        const result = await chrome.storage.local.get(storageKey);
        let data = result[storageKey];
        let changed = false;

        if (data && typeof data === 'object') {
          for (const storedTabIdStr in data) {
            if (!openTabIds.has(storedTabIdStr)) {
              delete data[storedTabIdStr];
              changed = true;
              logger.service.debug(
                `SidePanelStateManager: Cleaned up ${storageKey} for closed tab ${storedTabIdStr}.`
              );
            }
          }

          if (changed) {
            if (Object.keys(data).length === 0) {
              await chrome.storage.local.remove(storageKey);
              logger.service.info(
                `SidePanelStateManager: Removed empty storage key ${storageKey} after cleanup.`
              );
            } else {
              await chrome.storage.local.set({ [storageKey]: data });
            }
          }
        }
      }
      logger.service.info(
        'SidePanelStateManager: Stale tab state cleanup finished.'
      );
    } catch (error) {
      logger.service.error(
        'SidePanelStateManager: Error during tab state cleanup:',
        error
      );
    }
  }
}

export default SidePanelStateManager;