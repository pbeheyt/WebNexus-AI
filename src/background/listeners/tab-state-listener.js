// src/background/listeners/tab-state-listener.js
import { STORAGE_KEYS } from '../../shared/constants.js';
import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../utils/logger.js';

/**
 * Set up tab state cleanup listeners
 */
export function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    logger.background.info(`Tab ${tabId} closed, cleaning up tab-specific state`);
    
    try {
      // Clean up tab-specific platform preferences
      const tabPlatformPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
      if (tabPlatformPrefs[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]) {
        const updatedPrefs = { ...tabPlatformPrefs[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] };
        delete updatedPrefs[tabId];
        
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]: updatedPrefs
        });
        
        logger.background.info(`Removed platform preference for tab ${tabId}`);
      }
      
      // Clean up tab-specific model preferences
      const tabModelPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
      if (tabModelPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES]) {
        const updatedPrefs = { ...tabModelPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] };
        delete updatedPrefs[tabId];
        
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_MODEL_PREFERENCES]: updatedPrefs
        });
        
        logger.background.info(`Removed model preferences for tab ${tabId}`);
      }
      
      // Clean up tab-specific chat history
      const tabChatHistories = await chrome.storage.local.get(STORAGE_KEYS.TAB_CHAT_HISTORIES);
      if (tabChatHistories[STORAGE_KEYS.TAB_CHAT_HISTORIES]) {
        const updatedHistories = { ...tabChatHistories[STORAGE_KEYS.TAB_CHAT_HISTORIES] };
        delete updatedHistories[tabId];
        
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_CHAT_HISTORIES]: updatedHistories
        });
        
        logger.background.info(`Removed chat history for tab ${tabId}`);
      }
    } catch (error) {
      logger.background.error('Error cleaning up tab-specific preferences:', error);
    }
    
    // Run existing sidebar state cleanup
    SidebarStateManager.cleanupTabStates();
  });

  // Periodically clean up tab states to prevent storage bloat
  setInterval(async () => {
    try {
      // Get all valid tabs
      const tabs = await chrome.tabs.query({});
      const validTabIds = new Set(tabs.map(tab => tab.id));
      
      // Clean platform preferences for invalid tabs
      const tabPlatformPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
      if (tabPlatformPrefs[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]) {
        const updatedPrefs = { ...tabPlatformPrefs[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] };
        let hasChanges = false;
        
        for (const tabIdStr of Object.keys(updatedPrefs)) {
          const tabId = parseInt(tabIdStr, 10);
          if (!validTabIds.has(tabId)) {
            delete updatedPrefs[tabIdStr];
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.TAB_PLATFORM_PREFERENCES]: updatedPrefs
          });
          logger.background.info('Cleaned up stale tab platform preferences');
        }
      }
      
      // Clean model preferences for invalid tabs
      const tabModelPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
      if (tabModelPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES]) {
        const updatedPrefs = { ...tabModelPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] };
        let hasChanges = false;
        
        for (const tabIdStr of Object.keys(updatedPrefs)) {
          const tabId = parseInt(tabIdStr, 10);
          if (!validTabIds.has(tabId)) {
            delete updatedPrefs[tabIdStr];
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.TAB_MODEL_PREFERENCES]: updatedPrefs
          });
          logger.background.info('Cleaned up stale tab model preferences');
        }
      }
      
      // Clean chat histories for invalid tabs
      const tabChatHistories = await chrome.storage.local.get(STORAGE_KEYS.TAB_CHAT_HISTORIES);
      if (tabChatHistories[STORAGE_KEYS.TAB_CHAT_HISTORIES]) {
        const updatedHistories = { ...tabChatHistories[STORAGE_KEYS.TAB_CHAT_HISTORIES] };
        let hasChanges = false;
        
        for (const tabIdStr of Object.keys(updatedHistories)) {
          const tabId = parseInt(tabIdStr, 10);
          if (!validTabIds.has(tabId)) {
            delete updatedHistories[tabIdStr];
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.TAB_CHAT_HISTORIES]: updatedHistories
          });
          logger.background.info('Cleaned up stale tab chat histories');
        }
      }
      
      // Run existing cleanup routine
      SidebarStateManager.cleanupTabStates();
    } catch (error) {
      logger.background.error('Error in periodic tab state cleanup:', error);
    }
  }, 3600000); // Every hour

  logger.background.info('Tab state listener initialized with tab-specific cleanup');
}