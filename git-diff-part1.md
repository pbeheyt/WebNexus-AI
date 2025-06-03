diff --git a/src/background/index.js b/src/background/index.js
index 1e8522e..118b145 100644
--- a/src/background/index.js
+++ b/src/background/index.js
@@ -75,18 +75,18 @@ async function startBackgroundService() {
     // 4. Add the onStartup listener for cleanup
     // This listener persists across service worker restarts.
     chrome.runtime.onStartup.addListener(async () => {
-      // Reset all side panel visibility states as Chrome starts fresh.
+      // Reset all tab UI states as Chrome starts fresh.
       try {
         logger.background.info(
-          'Resetting all side panel visibility states due to browser startup...'
+          'Resetting all tab UI states due to browser startup...'
         );
-        await SidePanelStateManager.resetAllSidePanelVisibilityStates();
+        await SidePanelStateManager.resetAllTabUIStates();
         logger.background.info(
-          'Side panel visibility states reset successfully on startup.'
+          'Tab UI states reset successfully on startup.'
         );
       } catch (resetError) {
         logger.background.error(
-          'Error resetting side panel visibility states during browser startup:',
+          'Error resetting tab UI states during browser startup:',
           resetError
         );
       }
diff --git a/src/background/initialization.js b/src/background/initialization.js
index 112ca42..9374385 100644
--- a/src/background/initialization.js
+++ b/src/background/initialization.js
@@ -83,16 +83,16 @@ async function handleInstallation(details) {
   logger.background.info(`Extension event: ${details.reason}`, details);
 
   // --- Default Prompt Initialization Logic ---
-  // Reset all side panel visibility states as Chrome closes them on install/update.
+  // Reset all tab UI states as Chrome closes them on install/update.
   try {
     logger.background.info(
-      'Resetting all side panel visibility states due to installation event...'
+      'Resetting all tab UI states due to installation event...'
     );
-    await SidePanelStateManager.resetAllSidePanelVisibilityStates();
-    logger.background.info('Side panel visibility states reset successfully.');
+    await SidePanelStateManager.resetAllTabUIStates();
+    logger.background.info('Tab UI states reset successfully.');
   } catch (resetError) {
     logger.background.error(
-      'Error resetting side panel visibility states during installation:',
+      'Error resetting tab UI states during installation:',
       resetError
     );
   }
diff --git a/src/background/listeners/tab-listener.js b/src/background/listeners/tab-listener.js
index 6ae4fe9..a5fb0d6 100644
--- a/src/background/listeners/tab-listener.js
+++ b/src/background/listeners/tab-listener.js
@@ -118,8 +118,8 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
           `Tab ${tabId} finished loading (${tab.url}). Setting final side panel state.`
         );
         const isAllowed = isSidePanelAllowedPage(tab.url);
-        const isVisible =
-          await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
+        const tabUIState =
+          await SidePanelStateManager.getTabUIState(tabId);
 
         if (
           chrome.sidePanel &&
@@ -129,10 +129,10 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
             await chrome.sidePanel.setOptions({
               tabId: tabId,
               path: `sidepanel.html?tabId=${tabId}`, // Always set path when allowed
-              enabled: isVisible, // Enable based on stored visibility
+              enabled: tabUIState.isVisible, // Enable based on stored visibility
             });
             logger.background.info(
-              `Side Panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${isVisible}`
+              `Side Panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${tabUIState.isVisible}`
             );
           } else {
             await chrome.sidePanel.setOptions({
@@ -265,10 +265,10 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
   if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
     try {
       // Check if the side panel is *intended* to be visible for this tab
-      const isVisible =
-        await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
+      const tabUIState =
+        await SidePanelStateManager.getTabUIState(tabId);
 
-      if (isVisible) {
+      if (tabUIState.isVisible) {
         logger.background.info(
           `Tab ${tabId} navigated to ${tab.url}. Side panel is relevant. Checking content type.`
         );
@@ -333,23 +333,23 @@ async function handleTabActivation(activeInfo) {
       }
 
       // Retrieve the intended visibility state for the activated tab
-      const isVisible =
-        await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
+      const tabUIState =
+        await SidePanelStateManager.getTabUIState(tabId);
 
       // Conditionally set side panel options based on stored visibility
-      if (isVisible) {
+      if (tabUIState.isVisible) {
         // Enable and set the path ONLY if it should be visible
         await chrome.sidePanel.setOptions({
           tabId: tabId,
           path: `sidepanel.html?tabId=${tabId}`,
-          enabled: true,
+          enabled: true, // Use tabUIState.isVisible
         });
         logger.background.info(`Side Panel enabled for activated tab ${tabId}`);
       } else {
         // Disable the panel if it shouldn't be visible
         await chrome.sidePanel.setOptions({
           tabId: tabId,
-          enabled: false,
+          enabled: false, // Use tabUIState.isVisible
         });
         logger.background.info(
           `Side Panel disabled for activated tab ${tabId}`
diff --git a/src/background/listeners/tab-state-listener.js b/src/background/listeners/tab-state-listener.js
index 0068b80..5d5da30 100644
--- a/src/background/listeners/tab-state-listener.js
+++ b/src/background/listeners/tab-state-listener.js
@@ -1,34 +1,32 @@
 // src/background/listeners/tab-state-listener.js
 
-import { STORAGE_KEYS } from '../../shared/constants.js';
 import SidePanelStateManager from '../../services/SidePanelStateManager.js';
 import { logger } from '../../shared/logger.js';
 
 // List of tab-specific storage keys to clear on manual refresh (excluding sidepanel visibility)
-const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR_ON_MANUAL_REFRESH = [
-  STORAGE_KEYS.TAB_CHAT_HISTORIES,
-  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
-  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
-  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
-  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
-  // Note: TAB_SIDEPANEL_STATES is intentionally excluded to preserve visibility state during manual refresh.
-];
+// const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR_ON_MANUAL_REFRESH = [ // This array is no longer used directly in clearSingleTabData
+//   STORAGE_KEYS.TAB_CHAT_HISTORIES, // Deprecated
+//   STORAGE_KEYS.TAB_TOKEN_STATISTICS, // Deprecated
+//   STORAGE_KEYS.TAB_MODEL_PREFERENCES, // Might be part of global session or tab UI state
+//   STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, // Might be part of global session or tab UI state
+//   STORAGE_KEYS.TAB_FORMATTED_CONTENT, // This might be tied to global sessions or still tab-specific for non-chat
+// ];
 
 // List of all storage keys that are tab-specific and need automatic cleanup (used for onRemoved/periodic cleanup)
 // This includes TAB_SIDEPANEL_STATES which is handled by SidePanelStateManager.cleanupTabStates
-const ALL_TAB_SPECIFIC_KEYS_FOR_AUTOMATIC_CLEANUP = [
-  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
-  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
-  STORAGE_KEYS.TAB_SIDEPANEL_STATES, // Included for the loop, but handled separately by SidePanelStateManager
-  STORAGE_KEYS.TAB_CHAT_HISTORIES,
-  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
-  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
-];
+// const ALL_TAB_SPECIFIC_KEYS_FOR_AUTOMATIC_CLEANUP = [ // This array is no longer used directly in performStaleTabCleanup or onRemoved
+//   STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
+//   STORAGE_KEYS.TAB_MODEL_PREFERENCES,
+//   STORAGE_KEYS.TAB_SIDEPANEL_STATES,
+//   STORAGE_KEYS.TAB_CHAT_HISTORIES, // Deprecated
+//   STORAGE_KEYS.TAB_TOKEN_STATISTICS, // Deprecated
+//   STORAGE_KEYS.TAB_FORMATTED_CONTENT,
+// ];
 
 /**
- * Clears specified storage data for a single tab.
+ * Resets the UI state for a single tab, effectively preparing it for a new chat session.
  * Used for the manual refresh action initiated from the UI.
- * @param {number} tabId - The ID of the tab to clear data for.
+ * @param {number} tabId - The ID of the tab to reset UI state for.
  * @returns {Promise<boolean>} - True if successful, false otherwise.
  */
 export async function clearSingleTabData(tabId) {
@@ -39,50 +37,26 @@ export async function clearSingleTabData(tabId) {
     );
     return false;
   }
-  const tabIdStr = tabId.toString();
-  logger.background.info(`Clearing specific data for tab ${tabIdStr}...`);
+  logger.background.info(`Resetting tab UI state for tab ${tabId} for a new chat...`);
 
   try {
-    for (const storageKey of TAB_SPECIFIC_DATA_KEYS_TO_CLEAR_ON_MANUAL_REFRESH) {
-      let result;
-      let data;
-      switch (storageKey) {
-        case STORAGE_KEYS.TAB_FORMATTED_CONTENT:
-          await SidePanelStateManager.clearFormattedContentForTab(tabId);
-          break;
+    // Get current visibility to preserve it, or assume true if resetting
+    const currentTabState = await SidePanelStateManager.getTabUIState(tabId);
+    await SidePanelStateManager.setTabUIVisibility(tabId, currentTabState.isVisible); // This sets the visibility part
+    await SidePanelStateManager.setActiveChatSessionForTab(tabId, null); // Clear active session
+    await SidePanelStateManager.setTabViewMode(tabId, 'chat'); // Reset view to chat
+    
+    // If TAB_FORMATTED_CONTENT is still purely tab-specific and not tied to global sessions, clear it.
+    // Otherwise, this line might be removed if formatted content is now part of a global session.
+    // For now, assuming it might still be relevant for the tab context before a new session starts.
+    await SidePanelStateManager.clearFormattedContentForTab(tabId);
 
-        default:
-          // Handle other keys not managed by SidePanelStateManager
-          result = await chrome.storage.local.get(storageKey);
-          data = result[storageKey];
-
-          if (
-            data &&
-            typeof data === 'object' &&
-            data[tabIdStr] !== undefined
-          ) {
-            logger.background.info(
-              `Found data for key ${storageKey} for tab ${tabIdStr}. Deleting...`
-            );
-            delete data[tabIdStr];
-            await chrome.storage.local.set({ [storageKey]: data });
-            logger.background.info(
-              `Cleared ${storageKey} for tab ${tabIdStr}.`
-            );
-          } else {
-            logger.background.info(
-              `No data found for key ${storageKey} for tab ${tabIdStr}. Skipping.`
-            );
-          }
-          break;
-      }
-    }
     logger.background.info(
-      `Successfully cleared specified data for tab ${tabIdStr}.`
+      `Successfully reset tab UI state for tab ${tabId}.`
     );
     return true;
   } catch (error) {
-    logger.background.error(`Error clearing data for tab ${tabIdStr}:`, error);
+    logger.background.error(`Error resetting tab UI state for tab ${tabId}:`, error);
     return false;
   }
 }
@@ -140,6 +114,7 @@ export function handleClearTabDataRequest(message, sender, sendResponse) {
  * @param {Set<number>|null} [validTabIds=null] - Set of currently open tab IDs (for periodic cleanup). If null, uses tabId.
  * @returns {Promise<boolean>} - True if changes were made, false otherwise.
  */
+/*
 async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
   try {
     // Get the current storage data for the specified key
@@ -213,6 +188,7 @@ async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
     return false; // Indicate failure on error
   }
 }
+*/
 
 /**
  * Set up tab state cleanup listeners (Handles tab removal).
@@ -234,39 +210,23 @@ export function setupTabStateListener() {
       );
 
       try {
-        // Clean up all general tab-specific storage keys
-        for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_AUTOMATIC_CLEANUP) {
-          // Skip sidepanel state in this loop; handled separately below.
-          if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
-            await cleanupTabStorage(storageKey, tabId, null); // Pass tabId for single removal, validTabIds=null
-          }
-        }
+        // Set tab UI visibility to false. The generic cleanupTabStates will handle full removal later if needed.
+        await SidePanelStateManager.setTabUIVisibility(tabId, false);
         logger.background.info(
-          `General tab data cleanup completed for closed tab ${tabId}.`
+          `Tab UI visibility set to false for closed tab ${tabId}.`
         );
 
-        // Use SidePanelStateManager to specifically clean its state for the removed tab
-        // This will now delete the key if it exists and is set to false (closed)
-        await SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false);
-        logger.background.info(
-          `Sidepanel visibility state (set to false/key removed) for closed tab ${tabId}.`
-        );
-      } catch (error) {
-        logger.background.error(
-          `Error cleaning up tab-specific data on tab removal (tabId: ${tabId}):`,
-          error
-        );
-      }
-
-      // Clear other data managed by SidePanelStateManager for the removed tab
-      try {
+        // If TAB_FORMATTED_CONTENT is still purely tab-specific and not tied to global sessions, clear it.
+        // Otherwise, this line might be removed if formatted content is now part of a global session.
+        // For now, assuming it might still be relevant for the tab context.
         await SidePanelStateManager.clearFormattedContentForTab(tabId);
         logger.background.info(
-          `SidePanelStateManager managed data (formatted content) cleared for closed tab ${tabId}.`
+          `Formatted content cleared for closed tab ${tabId}.`
         );
+
       } catch (error) {
         logger.background.error(
-          `Error clearing SidePanelStateManager managed data for tab ${tabId}:`,
+          `Error during onRemoved cleanup for tab ${tabId}:`,
           error
         );
       }
@@ -304,29 +264,22 @@ export function setupTabStateListener() {
 export async function performStaleTabCleanup() {
   logger.background.info('Running stale tab data cleanup...');
   try {
-    // Get all currently open tabs
-    const tabs = await chrome.tabs.query({});
-    const validTabIds = new Set(tabs.map((tab) => tab.id)); // Set of IDs for open tabs
-    logger.background.info(`Found ${validTabIds.size} currently open tabs.`);
-
-    // Clean up all general tab-specific storage keys based on the valid IDs
-    for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_AUTOMATIC_CLEANUP) {
-      // Skip sidepanel state in this loop; handled separately below.
-      if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
-        await cleanupTabStorage(storageKey, null, validTabIds); // Pass validTabIds for periodic removal, tabId=null
-      }
-    }
-    logger.background.info(
-      `General stale tab data cleanup processing completed.`
-    );
-
-    // Use SidePanelStateManager to clean its state based on valid IDs
-    // This will iterate through stored side panel states and remove entries for closed tabs.
+    // The primary call to SidePanelStateManager.cleanupTabStates() will handle
+    // the cleanup of TAB_SIDEPANEL_STATES and any other keys it's configured to manage.
     await SidePanelStateManager.cleanupTabStates();
     logger.background.info(
-      `SidePanelStateManager stale state cleanup completed.`
+      `SidePanelStateManager.cleanupTabStates() completed.`
     );
 
+    // No need to loop through ALL_TAB_SPECIFIC_KEYS_FOR_AUTOMATIC_CLEANUP here anymore,
+    // as deprecated keys are phased out and TAB_SIDEPANEL_STATES is handled above.
+    // If other tab-specific keys were still in use and *not* managed by SidePanelStateManager,
+    // they would be handled by cleanupTabStorage here.
+    // For example, if TAB_PLATFORM_PREFERENCES was still a standalone tab-specific key:
+    // const tabs = await chrome.tabs.query({});
+    // const validTabIds = new Set(tabs.map((tab) => tab.id));
+    // await cleanupTabStorage(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, null, validTabIds);
+
     logger.background.info('Stale tab data cleanup finished successfully.');
   } catch (error) {
     logger.background.error(
diff --git a/src/background/services/sidepanel-manager.js b/src/background/services/sidepanel-manager.js
index fae64a8..e201715 100644
--- a/src/background/services/sidepanel-manager.js
+++ b/src/background/services/sidepanel-manager.js
@@ -82,18 +82,19 @@ export async function toggleSidePanel(message, sender, sendResponse) {
     }
 
     // Read the current *intended* state from storage
-    const currentState =
-      await SidePanelStateManager.getSidePanelVisibilityForTab(targetTabId);
+    const currentTabUIState =
+      await SidePanelStateManager.getTabUIState(targetTabId);
     logger.background.info(
-      `Current stored visibility for tab ${targetTabId}: ${currentState}`
+      `Current stored UI state for tab ${targetTabId}:`, currentTabUIState
     );
 
     // Determine the new state and perform actions
-    if (currentState === false) {
+    newState = !currentTabUIState.isVisible; // The new visibility state
+
+    if (newState === true) {
       // Current state is closed, so we intend to open (enable) it
-      newState = true;
       logger.background.info(`Action: Enable sidepanel for tab ${targetTabId}`);
-      await SidePanelStateManager.setSidePanelVisibilityForTab(
+      await SidePanelStateManager.setTabUIVisibility(
         targetTabId,
         true
       );
@@ -107,11 +108,10 @@ export async function toggleSidePanel(message, sender, sendResponse) {
       );
     } else {
       // Current state is open, so we intend to close (disable) it
-      newState = false;
       logger.background.info(
         `Action: Disable sidepanel for tab ${targetTabId}`
       );
-      await SidePanelStateManager.setSidePanelVisibilityForTab(
+      await SidePanelStateManager.setTabUIVisibility(
         targetTabId,
         false
       );
@@ -182,7 +182,7 @@ export async function handleCloseCurrentSidePanelRequest(
   );
 
   try {
-    await SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false);
+    await SidePanelStateManager.setTabUIVisibility(tabId, false);
     if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
       await chrome.sidePanel.setOptions({ tabId, enabled: false });
       logger.background.info(
diff --git a/src/services/SidePanelStateManager.js b/src/services/SidePanelStateManager.js
index 2573a45..1239bfe 100644
--- a/src/services/SidePanelStateManager.js
+++ b/src/services/SidePanelStateManager.js
@@ -8,43 +8,42 @@ import { logger } from '../shared/logger';
  */
 class SidePanelStateManager {
   /**
-   * Get the visibility state of the side panel for a specific tab.
+   * Get the UI state of the side panel for a specific tab.
    * @param {number} tabId - The ID of the tab.
-   * @returns {Promise<boolean>} - True if the side panel is intended to be visible, false otherwise.
+   * @returns {Promise<Object>} An object containing { isVisible: boolean, activeChatSessionId: string|null, currentView: string }.
    */
-  static async getSidePanelVisibilityForTab(tabId) {
+  static async getTabUIState(tabId) {
     if (tabId === null || tabId === undefined) {
       logger.service.warn(
-        'SidePanelStateManager: getSidePanelVisibilityForTab called with invalid tabId.'
+        'SidePanelStateManager: getTabUIState called with invalid tabId.'
       );
-      return false;
+      return { isVisible: false, activeChatSessionId: null, currentView: 'chat' }; // Default state for invalid tabId
     }
     try {
       const result = await chrome.storage.local.get(
         STORAGE_KEYS.TAB_SIDEPANEL_STATES
       );
       const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
-      return !!states[tabId.toString()]; // Default to false if not found
+      return states[tabId.toString()] || { isVisible: false, activeChatSessionId: null, currentView: 'chat' };
     } catch (error) {
       logger.service.error(
-        `Error getting side panel visibility for tab ${tabId}:`,
+        `SidePanelStateManager: Error getting tab UI state for tab ${tabId}:`,
         error
       );
-      return false; // Default to false on error
+      return { isVisible: false, activeChatSessionId: null, currentView: 'chat' }; // Default state on error
     }
   }
 
   /**
    * Set the visibility state of the side panel for a specific tab.
-   * If setting to false (closed), it will remove the key for that tab to save space.
    * @param {number} tabId - The ID of the tab.
    * @param {boolean} isVisible - The new visibility state.
    * @returns {Promise<void>}
    */
-  static async setSidePanelVisibilityForTab(tabId, isVisible) {
+  static async setTabUIVisibility(tabId, isVisible) {
     if (tabId === null || tabId === undefined) {
       logger.service.warn(
-        'SidePanelStateManager: setSidePanelVisibilityForTab called with invalid tabId.'
+        'SidePanelStateManager: setTabUIVisibility called with invalid tabId.'
       );
       return;
     }
@@ -53,42 +52,90 @@ class SidePanelStateManager {
         STORAGE_KEYS.TAB_SIDEPANEL_STATES
       );
       const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
-
-      if (isVisible) {
-        states[tabId.toString()] = true;
-      } else {
-        // If setting to not visible, remove the key for that tab to save storage space
-        delete states[tabId.toString()];
+      const tabIdStr = tabId.toString();
+      if (!states[tabIdStr]) {
+        states[tabIdStr] = { isVisible: false, activeChatSessionId: null, currentView: 'chat' };
       }
+      states[tabIdStr].isVisible = isVisible;
 
+      // Optional: Cleanup if state is default and not visible
+      // if (!isVisible && states[tabIdStr].activeChatSessionId === null && states[tabIdStr].currentView === 'chat') {
+      //   delete states[tabIdStr];
+      // }
       await chrome.storage.local.set({
         [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states,
       });
       logger.service.info(
-        `Side panel visibility for tab ${tabId} set to ${isVisible} (key ${isVisible ? 'added/updated' : 'removed'}).`
+        `SidePanelStateManager: Tab UI visibility for tab ${tabId} set to ${isVisible}.`
       );
     } catch (error) {
       logger.service.error(
-        `Error setting side panel visibility for tab ${tabId}:`,
+        `SidePanelStateManager: Error setting tab UI visibility for tab ${tabId}:`,
         error
       );
     }
   }
 
+  static async setActiveChatSessionForTab(tabId, chatSessionId) {
+    if (tabId === null || tabId === undefined) {
+      logger.service.warn('SidePanelStateManager: setActiveChatSessionForTab called with invalid tabId.');
+      return;
+    }
+    try {
+      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
+      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
+      const tabIdStr = tabId.toString();
+
+      if (!states[tabIdStr]) {
+        states[tabIdStr] = { isVisible: true, activeChatSessionId: null, currentView: 'chat' }; // Assume visible if setting active chat
+      }
+      states[tabIdStr].activeChatSessionId = chatSessionId;
+      // Optionally, ensure currentView is 'chat' when a session is made active
+      // states[tabIdStr].currentView = 'chat'; 
+
+      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states });
+      logger.service.info(`SidePanelStateManager: Active chat session for tab ${tabId} set to ${chatSessionId}.`);
+    } catch (error) {
+      logger.service.error(`SidePanelStateManager: Error setting active chat session for tab ${tabId}:`, error);
+    }
+  }
+
+  static async setTabViewMode(tabId, viewMode) {
+    if (tabId === null || tabId === undefined || (viewMode !== 'chat' && viewMode !== 'history')) {
+      logger.service.warn('SidePanelStateManager: setTabViewMode called with invalid parameters.', { tabId, viewMode });
+      return;
+    }
+    try {
+      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
+      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
+      const tabIdStr = tabId.toString();
+
+      if (!states[tabIdStr]) {
+        states[tabIdStr] = { isVisible: true, activeChatSessionId: null, currentView: 'chat' }; // Assume visible if setting view mode
+      }
+      states[tabIdStr].currentView = viewMode;
+
+      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states });
+      logger.service.info(`SidePanelStateManager: View mode for tab ${tabId} set to ${viewMode}.`);
+    } catch (error) {
+      logger.service.error(`SidePanelStateManager: Error setting view mode for tab ${tabId}:`, error);
+    }
+  }
+
   /**
-   * Resets all side panel visibility states stored. Typically called on browser startup or extension install/update.
+   * Resets all tab UI states stored. Typically called on browser startup or extension install/update.
    * This effectively clears the TAB_SIDEPANEL_STATES storage key.
    * @returns {Promise<void>}
    */
-  static async resetAllSidePanelVisibilityStates() {
+  static async resetAllTabUIStates() {
     try {
       await chrome.storage.local.remove(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
       logger.service.info(
-        'All side panel visibility states have been reset (storage key removed).'
+        'All tab UI states have been reset (storage key removed).'
       );
     } catch (error) {
       logger.service.error(
-        'Error resetting all side panel visibility states:',
+        'Error resetting all tab UI states:',
         error
       );
     }
@@ -194,14 +241,14 @@ class SidePanelStateManager {
       const openTabs = await chrome.tabs.query({});
       const openTabIds = new Set(openTabs.map((tab) => tab.id.toString()));
 
+      // Only clean TAB_SIDEPANEL_STATES directly. Other keys are managed by their respective services or deprecated.
       const keysToClean = [
         STORAGE_KEYS.TAB_SIDEPANEL_STATES,
-        STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
-        STORAGE_KEYS.TAB_MODEL_PREFERENCES,
-        STORAGE_KEYS.TAB_CHAT_HISTORIES, // Already handled by ChatHistoryService
-        STORAGE_KEYS.TAB_TOKEN_STATISTICS, // Already handled by TokenManagementService
-        STORAGE_KEYS.TAB_FORMATTED_CONTENT,
+        // STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, // Potentially keep if still used independently
+        // STORAGE_KEYS.TAB_MODEL_PREFERENCES, // Potentially keep if still used independently
+        STORAGE_KEYS.TAB_FORMATTED_CONTENT, // Keep if used for non-chat tab-specific content
       ];
+      // Deprecated keys like TAB_CHAT_HISTORIES and TAB_TOKEN_STATISTICS are no longer cleaned here.
 
       for (const storageKey of keysToClean) {
         const result = await chrome.storage.local.get(storageKey);
@@ -243,4 +290,4 @@ class SidePanelStateManager {
   }
 }
 
-export default SidePanelStateManager;
\ No newline at end of file
+export default SidePanelStateManager;
diff --git a/src/shared/constants.js b/src/shared/constants.js
index 2d0e0e5..fd09e4f 100644
--- a/src/shared/constants.js
+++ b/src/shared/constants.js
@@ -96,21 +96,28 @@ export const STORAGE_KEYS = {
   API_RESPONSE_TIMESTAMP: 'api_response_timestamp',
   /** @description Unique identifier for an active API stream. Local. */
   API_STREAM_ID: 'api_stream_id',
+  // --- Global Chat Session Data ---
+  /** @description Stores all global chat sessions. Keyed by chatSessionId. Local. */
+  GLOBAL_CHAT_SESSIONS: 'global_chat_sessions',
+  /** @description Stores token statistics for each global chat session. Keyed by chatSessionId. Local. */
+  GLOBAL_CHAT_TOKEN_STATS: 'global_chat_token_stats',
 
   // --- Tab-Specific Data (Primarily for Sidepanel context persistence per tab) ---
   /** @description Formatted page content specific to a tab, for Sidepanel context. Local. */
   TAB_FORMATTED_CONTENT: 'tab_formatted_content',
   /** @description Chat history for each tab's Sidepanel instance. Local. */
-  TAB_CHAT_HISTORIES: 'tab_chat_histories',
+  // DEPRECATED_FOR_GLOBAL_HISTORY: TAB_CHAT_HISTORIES: 'tab_chat_histories',
 
   /** @description Token usage statistics for each tab's Sidepanel instance. Local. */
-  TAB_TOKEN_STATISTICS: 'tab_token_statistics',
+  // DEPRECATED_FOR_GLOBAL_HISTORY: TAB_TOKEN_STATISTICS: 'tab_token_statistics',
   /** @description Last selected/preferred platform for each tab's Sidepanel instance. Local. */
   TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
   /** @description Last selected/preferred model (per platform) for each tab's Sidepanel instance. Local. */
   TAB_MODEL_PREFERENCES: 'tab_model_preferences',
   /** @description Visibility state (true/false) of the Sidepanel for each tab. Local. */
   TAB_SIDEPANEL_STATES: 'tab_sidepanel_states',
+  // --- Identifiers & Prefixes ---
+  CHAT_SESSION_ID_PREFIX: 'chat_', // Used for generating global chat session IDs
 };
 
 // Prompt limits
diff --git a/src/sidepanel/services/ChatHistoryService.js b/src/sidepanel/services/ChatHistoryService.js
index 6292434..69a0547 100644
--- a/src/sidepanel/services/ChatHistoryService.js
+++ b/src/sidepanel/services/ChatHistoryService.js
@@ -14,30 +14,30 @@ import TokenManagementService from './TokenManagementService';
  */
 class ChatHistoryService {
   /**
-   * Get chat history for a specific tab
-   * @param {number} tabId - The tab ID
+   * Get chat history for a specific chat session
+   * @param {string} chatSessionId - The chat session ID
    * @returns {Promise<Array>} Chat history messages
    */
-  static async getHistory(tabId) {
+  static async getHistory(chatSessionId) {
     try {
-      if (!tabId) {
+      if (!chatSessionId) {
         logger.sidepanel.error(
-          'TabChatHistory: No tabId provided for getHistory'
+          'ChatHistoryService: No chatSessionId provided for getHistory'
         );
         return [];
       }
 
-      // Get all tab chat histories
+      // Get all global chat sessions
       const result = await chrome.storage.local.get([
-        STORAGE_KEYS.TAB_CHAT_HISTORIES,
+        STORAGE_KEYS.GLOBAL_CHAT_SESSIONS,
       ]);
-      const allTabHistories = result[STORAGE_KEYS.TAB_CHAT_HISTORIES] || {};
+      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
 
-      // Return history for this tab or empty array
-      return allTabHistories[tabId] || [];
+      // Return messages for this session or empty array
+      return allSessions[chatSessionId]?.messages || [];
     } catch (error) {
       logger.sidepanel.error(
-        'TabChatHistory: Error getting chat history:',
+        'ChatHistoryService: Error getting chat session messages:',
         error
       );
       return [];
@@ -47,18 +47,19 @@ class ChatHistoryService {
 
 
   /**
-   * Save chat history for a specific tab
-   * @param {number} tabId - The tab ID
+   * Save chat history for a specific chat session
+   * @param {string} chatSessionId - The chat session ID
    * @param {Array} messages - Chat history messages
-   * @param {Object} modelConfig - Model configuration (optional, for token tracking)
+   * @param {Object} modelConfig - Model configuration (optional, for token tracking and session metadata)
    * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
    * @param {number} [options.initialAccumulatedCost] - Starting cost for calculation (used in reruns).
    * @param {number} [options.initialOutputTokens] - Starting output tokens for calculation (used in reruns).
    * @param {boolean} [isThinkingModeEnabled=false] - Whether thinking mode is active
-   * @returns {Promise<boolean>} Success status
+   * @param {string | null} [systemPromptForThisTurn=null] - The system prompt used for the current turn.
+   * @returns {Promise<boolean|Object>} Success status or token stats object
    */
   static async saveHistory(
-    tabId,
+    chatSessionId,
     messages,
     modelConfig = null,
     options = {},
@@ -66,58 +67,72 @@ class ChatHistoryService {
     systemPromptForThisTurn = null
   ) {
     try {
-      if (!tabId) {
+      if (!chatSessionId) {
         logger.sidepanel.error(
-          'TabChatHistory: No tabId provided for saveHistory'
+          'ChatHistoryService: No chatSessionId provided for saveHistory'
         );
         return false;
       }
 
-      // Get all tab chat histories
+      // Get all global chat sessions
       const result = await chrome.storage.local.get([
-        STORAGE_KEYS.TAB_CHAT_HISTORIES,
+        STORAGE_KEYS.GLOBAL_CHAT_SESSIONS,
       ]);
-      const allTabHistories = result[STORAGE_KEYS.TAB_CHAT_HISTORIES] || {};
+      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
 
       // Limit number of messages to prevent storage problems
       const limitedMessages = messages.slice(-MAX_MESSAGES_PER_TAB_HISTORY);
 
       // Transform messages for storage to reduce footprint
       const storableMessages = limitedMessages.map(msg => {
-        const { 
+        const {
           // eslint-disable-next-line no-unused-vars
           isStreaming,
           // eslint-disable-next-line no-unused-vars
           inputTokens,
           // eslint-disable-next-line no-unused-vars
-          outputTokens, 
+          outputTokens,
           thinkingContent,
           // eslint-disable-next-line no-unused-vars
           systemPromptUsedForThisTurn,
-          ...restOfMsg 
+          ...restOfMsg
         } = msg;
 
         const storableMsg = { ...restOfMsg };
 
         // Omit thinkingContent if it's an empty string
-        if (thinkingContent && thinkingContent.trim() !== "") {
+        if (thinkingContent && thinkingContent.trim() !== '') {
           storableMsg.thinkingContent = thinkingContent;
         }
 
         return storableMsg;
       });
 
-      // Update history for this tab
-      allTabHistories[tabId] = storableMessages;
+      // Update history for this session
+      if (allSessions[chatSessionId]) {
+        allSessions[chatSessionId].messages = storableMessages;
+        allSessions[chatSessionId].metadata.lastActivityAt = new Date().toISOString();
+        // Update platformId and modelId if they were part of the message or options
+        if (modelConfig && modelConfig.platformId) { // Assuming modelConfig contains platformId
+            allSessions[chatSessionId].metadata.platformId = modelConfig.platformId;
+        }
+        if (modelConfig && modelConfig.id) { // Assuming modelConfig.id is the modelId
+           allSessions[chatSessionId].metadata.modelId = modelConfig.id;
+        }
+      } else {
+        logger.sidepanel.error(`ChatHistoryService: Attempted to save history for non-existent chatSessionId: ${chatSessionId}`);
+        // Potentially create it, but for now, log error. Creation should be explicit.
+        return false;
+      }
 
-      // Save updated histories
+      // Save updated sessions
       await chrome.storage.local.set({
-        [STORAGE_KEYS.TAB_CHAT_HISTORIES]: allTabHistories,
+        [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions,
       });
 
       // Calculate and save token statistics using TokenManagementService, passing options
       const stats = await TokenManagementService.calculateAndUpdateStatistics(
-        tabId,
+        chatSessionId,
         limitedMessages,
         modelConfig,
         options,
@@ -128,18 +143,50 @@ class ChatHistoryService {
       return stats;
     } catch (error) {
       logger.sidepanel.error(
-        'TabChatHistory: Error saving chat history:',
+        'ChatHistoryService: Error saving chat session:',
         error
       );
       return false;
     }
   }
 
+  static async createNewChatSession({ platformId, modelId, initialTabUrl, initialTabTitle } = {}) {
+    try {
+      const chatSessionId = `${STORAGE_KEYS.CHAT_SESSION_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
+      const now = new Date().toISOString();
+      const newSession = {
+        metadata: {
+          id: chatSessionId,
+          title: initialTabTitle ? `Chat: ${initialTabTitle.substring(0, 30)}` : `Chat ${new Date(now).toLocaleString()}`,
+          createdAt: now,
+          lastActivityAt: now,
+          platformId: platformId || null,
+          modelId: modelId || null,
+          initialTabUrl: initialTabUrl || null,
+          initialTabTitle: initialTabTitle || null,
+        },
+        messages: [],
+      };
+
+      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
+      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
+      allSessions[chatSessionId] = newSession;
+
+      await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions });
+      logger.sidepanel.info(`ChatHistoryService: Created new chat session: ${chatSessionId}`);
+      return newSession; // Return the full session object
+    } catch (error) {
+      logger.sidepanel.error('ChatHistoryService: Error creating new chat session:', error);
+      return null;
+    }
+  }
+
   /**
    * Clear chat history for a specific tab
    * @param {number} tabId - The tab ID
    * @returns {Promise<boolean>} Success status
    */
+  /*
   static async clearHistory(tabId) {
     try {
       if (!tabId) {
@@ -175,12 +222,14 @@ class ChatHistoryService {
       return false;
     }
   }
+  */
 
   /**
    * Clean up histories for closed tabs
    * @param {Array<number>} activeTabIds - List of currently active tab IDs
    * @returns {Promise<boolean>} Success status
    */
+  /*
   static async cleanupClosedTabs(activeTabIds) {
     try {
       if (!activeTabIds || !Array.isArray(activeTabIds)) {
@@ -232,6 +281,45 @@ class ChatHistoryService {
       return false;
     }
   }
+  */
+
+  static async getAllChatSessionsMetadata() {
+    try {
+      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
+      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
+      const metadataArray = Object.values(allSessions)
+        .map(session => session.metadata)
+        .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
+      return metadataArray;
+    } catch (error) {
+      logger.sidepanel.error('ChatHistoryService: Error getting all chat sessions metadata:', error);
+      return [];
+    }
+  }
+
+  static async deleteChatSession(chatSessionId) {
+    try {
+      if (!chatSessionId) {
+        logger.sidepanel.error('ChatHistoryService: No chatSessionId provided for deleteChatSession');
+        return false;
+      }
+      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
+      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
+
+      if (allSessions[chatSessionId]) {
+        delete allSessions[chatSessionId];
+        await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions });
+        await TokenManagementService.clearTokenStatistics(chatSessionId); // Use the refactored service
+        logger.sidepanel.info(`ChatHistoryService: Deleted chat session: ${chatSessionId}`);
+        return true;
+      }
+      logger.sidepanel.warn(`ChatHistoryService: Chat session ${chatSessionId} not found for deletion.`);
+      return false;
+    } catch (error) {
+      logger.sidepanel.error(`ChatHistoryService: Error deleting chat session ${chatSessionId}:`, error);
+      return false;
+    }
+  }
 
   /**
    * Get token statistics for a specific tab
diff --git a/src/sidepanel/services/TokenManagementService.js b/src/sidepanel/services/TokenManagementService.js
index cdf9552..72b1e58 100644
--- a/src/sidepanel/services/TokenManagementService.js
+++ b/src/sidepanel/services/TokenManagementService.js
@@ -14,29 +14,32 @@ import { createStructuredPromptString } from '../../shared/utils/prompt-formatti
  */
 class TokenManagementService {
   /**
-   * Get token statistics for a specific tab
-   * @param {number} tabId - Tab identifier
+   * Get token statistics for a specific chat session
+   * @param {string} chatSessionId - Chat session identifier
    * @returns {Promise<Object>} - Token usage statistics
    */
-  static async getTokenStatistics(tabId) {
-    if (!tabId) {
+  static async getTokenStatistics(chatSessionId) {
+    if (!chatSessionId) {
+      logger.sidepanel.warn(
+        'TokenManagementService: No chatSessionId provided for getTokenStatistics'
+      );
       return this._getEmptyStats();
     }
 
     try {
-      // Get all tab token statistics
+      // Get all global chat token statistics
       const result = await chrome.storage.local.get([
-        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
+        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
       ]);
-      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};
-      const tabStats = allTokenStats[tabId] || {};
+      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};
+      const sessionStats = allTokenStats[chatSessionId] || {};
 
       // Return merged stats, ensuring all default fields are present
-      const mergedStats = { ...this._getEmptyStats(), ...tabStats };
+      const mergedStats = { ...this._getEmptyStats(), ...sessionStats };
       return mergedStats;
     } catch (error) {
       logger.sidepanel.error(
-        'TokenManagementService: Error getting token statistics:',
+        `TokenManagementService: Error getting token statistics for chat session ${chatSessionId}:`,
         error
       );
       return this._getEmptyStats();
@@ -44,35 +47,35 @@ class TokenManagementService {
   }
 
   /**
-   * Update token statistics for a specific tab
-   * @param {number} tabId - Tab identifier
+   * Update token statistics for a specific chat session
+   * @param {string} chatSessionId - Chat session identifier
    * @param {Object} stats - Token statistics to store
    * @returns {Promise<boolean>} - Success status
    */
-  static async updateTokenStatistics(tabId, stats) {
-    if (!tabId) return false;
+  static async updateTokenStatistics(chatSessionId, stats) {
+    if (!chatSessionId) return false;
 
     try {
-      // Get all tab token statistics
+      // Get all global chat token statistics
       const result = await chrome.storage.local.get([
-        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
+        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
       ]);
-      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};
+      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};
 
-      // Update stats for this tab
-      allTokenStats[tabId] = {
+      // Update stats for this session
+      allTokenStats[chatSessionId] = {
         ...stats,
         lastUpdated: Date.now(),
       };
 
       // Save all token statistics
       await chrome.storage.local.set({
-        [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats,
+        [STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS]: allTokenStats,
       });
       return true;
     } catch (error) {
       logger.sidepanel.error(
-        'TokenManagementService: Error updating token statistics:',
+        `TokenManagementService: Error updating token statistics for chat session ${chatSessionId}:`,
         error
       );
       return false;
@@ -212,31 +215,31 @@ class TokenManagementService {
   }
 
   /**
-   * Clear token statistics for a tab
-   * @param {number} tabId - Tab identifier
+   * Clear token statistics for a chat session
+   * @param {string} chatSessionId - Chat session identifier
    * @returns {Promise<boolean>} - Success status
    */
-  static async clearTokenStatistics(tabId) {
-    if (!tabId) return false;
+  static async clearTokenStatistics(chatSessionId) {
+    if (!chatSessionId) return false;
 
     try {
-      // Get all tab token statistics
+      // Get all global chat token statistics
       const result = await chrome.storage.local.get([
-        STORAGE_KEYS.TAB_TOKEN_STATISTICS,
+        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
       ]);
-      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};
+      const allTokenStats = result[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};
 
-      // Remove stats for this tab
-      delete allTokenStats[tabId];
+      // Remove stats for this session
+      delete allTokenStats[chatSessionId];
 
       // Save updated stats
       await chrome.storage.local.set({
-        [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats,
+        [STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS]: allTokenStats,
       });
       return true;
     } catch (error) {
       logger.sidepanel.error(
-        'TokenManagementService: Error clearing token statistics:',
+        `TokenManagementService: Error clearing token statistics for chat session ${chatSessionId}:`,
         error
       );
       return false;
@@ -245,7 +248,7 @@ class TokenManagementService {
 
   /**
    * Calculate token statistics for a specific chat history
-   * @param {number} tabId - Tab identifier
+   * @param {string} chatSessionId - Chat session identifier
    * @param {Array} messages - Chat messages
    * @param {Object} modelConfig - Model configuration
    * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
@@ -255,7 +258,7 @@ class TokenManagementService {
    * @returns {Promise<Object>} - Token statistics
    */
   static async calculateAndUpdateStatistics(
-    tabId,
+    chatSessionId,
     messages,
     // eslint-disable-next-line no-unused-vars
     modelConfig = null,
@@ -264,7 +267,7 @@ class TokenManagementService {
     isThinkingModeEnabled = false,
     systemPromptForThisTurn = null
   ) {
-    if (!tabId) return this._getEmptyStats();
+    if (!chatSessionId) return this._getEmptyStats();
 
     let initialAccumulatedCost;
     let initialOutputTokens;
@@ -280,7 +283,7 @@ class TokenManagementService {
       initialOutputTokens = options.initialOutputTokens;
     } else {
       // Fetch currently stored statistics if options are not valid
-      const currentStats = await this.getTokenStatistics(tabId);
+      const currentStats = await this.getTokenStatistics(chatSessionId);
       initialAccumulatedCost = currentStats.accumulatedCost || 0;
       initialOutputTokens = currentStats.outputTokens || 0;
     }
@@ -359,7 +362,7 @@ class TokenManagementService {
       };
 
       // 7. Save the complete, updated statistics
-      await this.updateTokenStatistics(tabId, finalStatsObject);
+      await this.updateTokenStatistics(chatSessionId, finalStatsObject);
 
       // 8. Return the final statistics object
       return finalStatsObject;
