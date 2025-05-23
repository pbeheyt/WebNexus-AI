import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Service for managing tab-specific sidepanel state
 */
class SidePanelStateManager {
  /**
   * Toggle sidepanel visibility for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {boolean|undefined} visible - Visibility state (undefined to toggle)
   */
  async _toggleForTab(tabId, visible) {
    // Get current tab states
    const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
      await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);

    // Convert tabId to string for use as object key
    const tabIdStr = tabId.toString();
    const updatedStates = { ...tabStates }; // Create a mutable copy

    // Determine new visibility state
    let newVisibilityState;
    if (visible === undefined) {
      // Toggle current state: if it's currently true (present), set to false (delete), else set to true (add)
      newVisibilityState = !(updatedStates[tabIdStr] === true);
    } else {
      newVisibilityState = visible;
    }

    // Update tab state
    if (newVisibilityState === true) {
      updatedStates[tabIdStr] = true; // Store true if visible
    } else {
      delete updatedStates[tabIdStr]; // Delete key if not visible (default state)
    }

    // Save updated states
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: updatedStates,
    });

    logger.service.info(`Tab ${tabId} sidepanel visibility intention set to ${newVisibilityState} (stored as: ${updatedStates[tabIdStr] === true ? 'true' : 'absent/false'}).`);
  }

  /**
   * Get sidepanel visibility for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Visibility state
   */
  async getSidePanelVisibilityForTab(tabId) {
    try {
      const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);

      // If tabId.toString() is not a key in tabStates, it's considered false (default by absence)
      // Otherwise, it's true (as only true values are stored).
      return tabStates[tabId.toString()] === true;
    } catch (error) {
      logger.service.error(`Error getting sidepanel visibility for tab ${tabId}:`, error);
      return false; // Default to false on error
    }
  }

  /**
   * Set sidepanel visibility for specific tab
   * @param {number} tabId - Tab ID
   * @param {boolean} visible - Visibility state
   * @returns {Promise<boolean>} Success indicator
   */
  async setSidePanelVisibilityForTab(tabId, visible) {
    try {
      await this._toggleForTab(tabId, visible);
      return true;
    } catch (error) {
      logger.service.error(`Error setting sidepanel visibility for tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Store formatted content for a specific tab.
   * @param {number} tabId - Tab ID.
   * @param {string} formattedContent - The formatted content string.
   * @returns {Promise<void>}
   */
  async storeFormattedContentForTab(tabId, formattedContent) {
    if (typeof tabId !== 'number') {
      logger.service.warn('storeFormattedContentForTab called with invalid tabId:', tabId);
      return;
    }
    if (typeof formattedContent !== 'string') {
      logger.service.warn('storeFormattedContentForTab called with non-string content for tabId:', tabId);
      return;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};
      allFormattedContent[key] = formattedContent;
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: allFormattedContent });
      logger.service.info(`Stored formatted content for tab ${key}.`);
    } catch (error) {
      logger.service.error(`Error storing formatted content for tab ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get formatted content for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<string|null>} The formatted content string, or null if not found/error.
   */
  async getFormattedContentForTab(tabId) {
    if (typeof tabId !== 'number') {
      logger.service.warn('getFormattedContentForTab called with invalid tabId:', tabId);
      return null;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];
      if (allFormattedContent && typeof allFormattedContent === 'object' && Object.hasOwn(allFormattedContent, key)) {
        logger.service.info(`Retrieved formatted content for tab ${key}.`);
        return allFormattedContent[key];
      }
      logger.service.info(`No formatted content found for tab ${key} during retrieval.`);
      return null;
    } catch (error) {
      logger.service.error(`Error retrieving formatted content for tab ${key}:`, error);
      return null;
    }
  }

  /**
   * Check if formatted content exists for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<boolean>} True if formatted content exists, false otherwise.
   */
  async hasFormattedContentForTab(tabId) {
    if (typeof tabId !== 'number') {
      logger.service.warn('hasFormattedContentForTab called with invalid tabId:', tabId);
      return false;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];
      return !!(allFormattedContent && typeof allFormattedContent === 'object' && Object.hasOwn(allFormattedContent, key));
    } catch (error) {
      logger.service.error(`Error checking formatted content for tab ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear formatted content for a specific tab.
   * @param {number} tabId - Tab ID.
   * @returns {Promise<void>}
   */
  async clearFormattedContentForTab(tabId) {
    if (typeof tabId !== 'number') {
      logger.service.warn('clearFormattedContentForTab called with invalid tabId:', tabId);
      return;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];
      if (allFormattedContent && typeof allFormattedContent === 'object' && Object.hasOwn(allFormattedContent, key)) {
        delete allFormattedContent[key];
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: allFormattedContent });
        logger.service.info(`Cleared formatted content for tab ${key}.`);
      } else {
        logger.service.info(`No formatted content to clear for tab ${key}.`);
      }
    } catch (error) {
      logger.service.error(`Error clearing formatted content for tab ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set the context sent flag for a specific tab.
   * @param {number} tabId - The tab ID.
   * @param {boolean} sent - Whether context has been sent.
   * @returns {Promise<void>}
   */
  async setTabContextSentFlag(tabId, sent) {
    if (typeof tabId !== 'number') {
      logger.service.warn('setTabContextSentFlag called with invalid tabId:', tabId);
      return;
    }
    const tabIdStr = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG);
      const flags = result[STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG] || {};
      if (sent === true) {
        flags[tabIdStr] = true;
      } else {
        // If sent is false (or anything other than true), delete the key
        if (Object.hasOwn(flags, tabIdStr)) {
          delete flags[tabIdStr];
        }
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG]: flags });
      logger.service.info(`Set context sent flag for tab ${tabIdStr} to ${sent}.`);
    } catch (error) {
      logger.service.error(`Error setting context sent flag for tab ${tabIdStr}:`, error);
    }
  }

  /**
   * Get the context sent flag for a specific tab.
   * @param {number} tabId - The tab ID.
   * @returns {Promise<boolean>} Whether context has been sent for this tab.
   */
  async getTabContextSentFlag(tabId) {
    if (typeof tabId !== 'number') {
      logger.service.warn('getTabContextSentFlag called with invalid tabId:', tabId);
      return false;
    }
    const tabIdStr = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG);
      const flags = result[STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG];
      return !!(flags && typeof flags === 'object' && flags[tabIdStr]);
    } catch (error) {
      logger.service.error(`Error getting context sent flag for tab ${tabIdStr}:`, error);
      return false;
    }
  }

  /**
   * Store or remove the system prompt for a specific tab.
   * @param {number} tabId - Tab ID.
   * @param {string | null | undefined} systemPrompt - The system prompt string or null/undefined to remove.
   * @returns {Promise<void>}
   */
  async storeSystemPromptForTab(tabId, systemPrompt) {
    if (typeof tabId !== 'number') {
      logger.service.warn('storeSystemPromptForTab called with invalid tabId:', tabId);
      return;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SYSTEM_PROMPTS);
      const allTabSystemPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] && typeof result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] === 'object'
        ? { ...result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] }
        : {};

      if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
        if (allTabSystemPrompts[key] !== systemPrompt) {
          allTabSystemPrompts[key] = systemPrompt;
          logger.service.info(`Stored/Updated system prompt for tab ${key}.`);
          await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts });
        } else {
          logger.service.info(`System prompt for tab ${key} is unchanged. No storage update needed.`);
        }
      } else {
        if (Object.hasOwn(allTabSystemPrompts, key)) {
          delete allTabSystemPrompts[key];
          logger.service.info(`Removed system prompt entry for tab ${key} as new prompt is absent/empty.`);
          await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts });
        } else {
          logger.service.info(`No system prompt entry to remove for tab ${key}.`);
        }
      }
    } catch (error) {
      logger.service.error(`Error updating system prompt state for tab ${key}:`, error);
    }
  }

  /**
   * Get the system prompt for a specific tab.
   * @param {number} tabId - Tab ID.
   * @returns {Promise<string|null>} The system prompt string or null if not found.
   */
  async getSystemPromptForTab(tabId) {
    if (typeof tabId !== 'number') {
      logger.service.warn('getSystemPromptForTab called with invalid tabId:', tabId);
      return null;
    }
    const key = String(tabId);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SYSTEM_PROMPTS);
      const allTabSystemPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS];
      if (allTabSystemPrompts && typeof allTabSystemPrompts === 'object' && Object.hasOwn(allTabSystemPrompts, key)) {
        return allTabSystemPrompts[key];
      }
      return null;
    } catch (error) {
      logger.service.error(`Error getting system prompt for tab ${key}:`, error);
      return null;
    }
  }

  /**
   * Clean up all managed tab states for closed/stale tabs.
   * Iterates through `TAB_SIDEPANEL_STATES`, `TAB_FORMATTED_CONTENT`,
   * `TAB_CONTEXT_SENT_FLAG`, and `TAB_SYSTEM_PROMPTS`.
   * @returns {Promise<void>}
   */
  async cleanupTabStates() {
    try {
      const tabs = await chrome.tabs.query({});
      const activeTabIds = new Set(tabs.map((tab) => tab.id.toString()));
      logger.service.info(`SidePanelStateManager: Found ${activeTabIds.size} active tabs for cleanup.`);

      const keysToClean = [
        STORAGE_KEYS.TAB_SIDEPANEL_STATES,
        STORAGE_KEYS.TAB_FORMATTED_CONTENT,
        STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG,
        STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
      ];

      for (const storageKey of keysToClean) {
        const result = await chrome.storage.local.get(storageKey);
        const currentData = result[storageKey];

        if (currentData && typeof currentData === 'object' && Object.keys(currentData).length > 0) {
          const updatedData = {};
          let changed = false;
          for (const tabIdStr in currentData) {
            if (activeTabIds.has(tabIdStr)) {
              updatedData[tabIdStr] = currentData[tabIdStr];
            } else {
              changed = true;
              logger.service.info(`SidePanelStateManager: Removing stale ${storageKey} data for closed tab ID ${tabIdStr}`);
            }
          }

          if (changed) {
            if (Object.keys(updatedData).length > 0) {
              await chrome.storage.local.set({ [storageKey]: updatedData });
            } else {
              // If updatedData is empty, remove the key itself from storage
              await chrome.storage.local.remove(storageKey);
            }
            logger.service.info(`SidePanelStateManager: Cleaned up ${storageKey}.`);
          }
        } else {
          // logger.service.info(`SidePanelStateManager: No data or empty data found for ${storageKey}, skipping cleanup for this key.`);
        }
      }
      logger.service.info('SidePanelStateManager: All managed tab states cleanup process completed.');
    } catch (error) {
      logger.service.error('SidePanelStateManager: Error cleaning up tab states:', error);
    }
  }

  /**
   * Resets all side panel visibility states to default (closed).
   * Sets the TAB_SIDEPANEL_STATES storage item to an empty object.
   * This is typically called on extension install/update or browser startup.
   * @returns {Promise<void>}
   */
  async resetAllSidePanelVisibilityStates() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: {} });
      logger.service.info('All side panel visibility states have been reset to default (closed).');
    } catch (error) {
      logger.service.error('Error resetting all side panel visibility states:', error);
      // Depending on desired error handling, you might re-throw or just log.
      // For now, just logging.
    }
  }
}

export default new SidePanelStateManager();
