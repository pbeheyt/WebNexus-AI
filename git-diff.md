diff --git a/src/background/core/message-router.js b/src/background/core/message-router.js
index 83895da..906b4bb 100644
--- a/src/background/core/message-router.js
+++ b/src/background/core/message-router.js
@@ -12,7 +12,7 @@ import {
   handleProcessContentRequest,
   handleProcessContentViaApiRequest,
 } from '../services/content-processing.js';
-import { handleToggleNativeSidePanelAction, handleCloseCurrentSidePanelRequest } from '../services/sidepanel-manager.js';
+import { handleToggleSidePanelAction, handleCloseCurrentSidePanelRequest } from '../services/sidepanel-manager.js';
 import { handleThemeOperation } from '../services/theme-service.js';
 import { handleClearTabDataRequest } from '../listeners/tab-state-listener.js';
 
@@ -174,10 +174,10 @@ function registerServiceHandlers() {
   // Clear specific tab data (for sidepanel refresh)
   messageHandlers.set('clearTabData', handleClearTabDataRequest);
 
-  // Handle requests to toggle the native side panel
+  // Handle requests to toggle the side panel
   messageHandlers.set(
-    'toggleNativeSidePanelAction',
-    handleToggleNativeSidePanelAction
+    'toggleSidePanelAction',
+    handleToggleSidePanelAction
   );
 
   // Add this line within registerServiceHandlers
diff --git a/src/background/services/sidepanel-manager.js b/src/background/services/sidepanel-manager.js
index ae31a66..2c8098b 100644
--- a/src/background/services/sidepanel-manager.js
+++ b/src/background/services/sidepanel-manager.js
@@ -1,21 +1,21 @@
-// src/background/services/sidepanel-manager.js - Tab-specific native side panel management
+// src/background/services/sidepanel-manager.js - Tab-specific side panel management
 
 import SidePanelStateManager from '../../services/SidePanelStateManager.js';
 import { logger } from '../../shared/logger.js';
 import { isSidePanelAllowedPage } from '../../shared/utils/content-utils.js';
 
 /**
- * Toggle native side panel visibility for a specific tab.
+ * Toggle side panel visibility for a specific tab.
  * @param {Object} message - Message object containing optional `tabId` and `visible` properties.
  * @param {Object} sender - Message sender, potentially containing `sender.tab.id`.
  * @param {Function} sendResponse - Function to send the response back.
  */
-export async function toggleNativeSidePanel(message, sender, sendResponse) {
+export async function toggleSidePanel(message, sender, sendResponse) {
   let targetTabId;
   let newState; // To store the final state (true for open, false for closed)
   try {
     logger.background.info(
-      'Handling native sidepanel toggle request'
+      'Handling sidepanel toggle request'
     );
 
     // Determine the target tab ID
@@ -108,7 +108,7 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
     });
   } catch (error) {
     logger.background.error(
-      `Error handling native sidepanel toggle for tab ${targetTabId || 'unknown'}:`,
+      `Error handling sidepanel toggle for tab ${targetTabId || 'unknown'}:`,
       error
     );
     // If an error occurred, the actual panel state might not match the intended state.
@@ -123,23 +123,23 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
 }
 
 /**
- * Handles the 'toggleNativeSidePanelAction' message request.
+ * Handles the 'toggleSidePanelAction' message request.
  * @param {object} message - The message object.
  * @param {chrome.runtime.MessageSender} sender - The sender of the message.
  * @param {function} sendResponse - Function to call to send the response.
  * @returns {boolean} - True to indicate an asynchronous response.
  */
-export function handleToggleNativeSidePanelAction(
+export function handleToggleSidePanelAction(
   message,
   sender,
   sendResponse
 ) {
   logger.background.info(
-    'Received toggleNativeSidePanelAction request via message router'
+    'Received toggleSidePanelAction request via message router'
   );
   // Call the actual function which handles the logic and response
-  toggleNativeSidePanel(message, sender, sendResponse);
-  // toggleNativeSidePanel is async and handles sendResponse itself
+  toggleSidePanel(message, sender, sendResponse);
+  // toggleSidePanel is async and handles sendResponse itself
   return true; // Keep channel open for async response
 }
 
diff --git a/src/popup/Popup.jsx b/src/popup/Popup.jsx
index 2c84846..8e0a6ad 100644
--- a/src/popup/Popup.jsx
+++ b/src/popup/Popup.jsx
@@ -188,7 +188,7 @@ export function Popup() {
     updateStatus('Toggling Side Panel...', true);
     try {
       const response = await robustSendMessage({
-        action: 'toggleNativeSidePanelAction',
+        action: 'toggleSidePanelAction',
         tabId: currentTab.id,
       });
 
