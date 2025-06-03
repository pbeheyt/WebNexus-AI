diff --git a/src/sidepanel/contexts/SidePanelChatContext.jsx b/src/sidepanel/contexts/SidePanelChatContext.jsx
index d429092..77389d5 100644
--- a/src/sidepanel/contexts/SidePanelChatContext.jsx
+++ b/src/sidepanel/contexts/SidePanelChatContext.jsx
@@ -25,6 +25,7 @@ import { MESSAGE_ROLES } from '../../shared/constants';
 import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
 import { isInjectablePage } from '../../shared/utils/content-utils';
 import { robustSendMessage } from '../../shared/utils/message-utils';
+import { areMessagesDifferent } from '../../shared/utils/comparison-utils';
 
 const SidePanelChatContext = createContext(null);
 
@@ -326,6 +327,7 @@ export function SidePanelChatProvider({ children }) {
   }, [tokenStats, isPlatformLoading]);
 
   // Comprehensive Initialization Logic
+  // Effect for initializing context based on tabId, platform, model, etc.
   useEffect(() => {
     const initializeContext = async () => {
       if (isInitializingSessionRef.current) {
@@ -334,9 +336,8 @@ export function SidePanelChatProvider({ children }) {
       }
       isInitializingSessionRef.current = true;
 
-      if (!tabId || !selectedPlatformId) { // selectedModel might not be ready immediately
-        // Don't clear messages here, wait for valid context or new session
-        isInitializingSessionRef.current = false; // Release lock if exiting early
+      if (!tabId || !selectedPlatformId) {
+        isInitializingSessionRef.current = false;
         return;
       }
 
@@ -344,78 +345,35 @@ export function SidePanelChatProvider({ children }) {
       try {
         const tabUIState = await SidePanelStateManager.getTabUIState(tabId);
         let activeSessionId = tabUIState.activeChatSessionId;
-        let sessionMessages = [];
+        // let sessionMessages = []; // Not needed here as createNewChat/selectChatSession will set messages
 
         if (!activeSessionId) {
           logger.sidepanel.info(`SidePanelChatContext: No active session for tab ${tabId}. Creating new one.`);
-          const newSession = await ChatHistoryService.createNewChatSession({
-            platformId: selectedPlatformId,
-            modelId: selectedModel, // Pass current selectedModel (could be null)
-            initialTabUrl: currentTab?.url,
-            initialTabTitle: currentTab?.title,
-          });
-
-          if (newSession && newSession.metadata) {
-            activeSessionId = newSession.metadata.id;
-            await SidePanelStateManager.setTabUIVisibility(tabId, true); // Ensure visibility
-            await SidePanelStateManager.setActiveChatSessionForTab(tabId, activeSessionId);
-            await SidePanelStateManager.setTabViewMode(tabId, 'chat'); // Default to chat view
-            logger.sidepanel.info(`SidePanelChatContext: New provisional session ${activeSessionId} created and set for tab ${tabId}.`);
-            
-            setMessages([]);
-            if (typeof clearTokenData === 'function') await clearTokenData(activeSessionId);
-            setCurrentChatSessionId(activeSessionId);
-            setCurrentView('chat');
-          } else {
-            logger.sidepanel.error('SidePanelChatContext: Failed to create a new chat session.');
-            setMessages([]);
-            setCurrentChatSessionId(null);
-            setCurrentView('chat');
-            // Exit early from initializeContext if session creation fails
-            // The finally block will still run to release the lock
-            return; 
-          }
-        } else { // activeSessionId exists for the tab
+          await createNewChat(); 
+        } else {
           logger.sidepanel.info(`SidePanelChatContext: Tab ${tabId} has active session ${activeSessionId}. Checking its status.`);
           const sessionMetadata = await ChatHistoryService.getSessionMetadata(activeSessionId);
 
           if (sessionMetadata) {
             if (sessionMetadata.isProvisional === true && selectedModel && selectedModel !== sessionMetadata.modelId) {
-              logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is provisional and model changed (or was null). Updating metadata from ${sessionMetadata.modelId} to ${selectedModel}.`);
+              logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is provisional and model changed. Updating metadata.`);
               await ChatHistoryService.updateSessionMetadata(activeSessionId, {
-                platformId: selectedPlatformId, // Re-affirm platformId too
+                platformId: selectedPlatformId,
                 modelId: selectedModel,
               });
-              // Metadata updated, proceed to load this session
-            } else if (sessionMetadata.isProvisional === true) {
-                 logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is provisional. Model is ${sessionMetadata.modelId || 'null'}, selectedModel is ${selectedModel || 'null'}. No metadata update needed or selectedModel not ready.`);
-            } else {
-                 logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is not provisional. Loading as is.`);
             }
-            
-            // Load messages for the (potentially updated) active session
-            sessionMessages = await ChatHistoryService.getHistory(activeSessionId);
-            setCurrentChatSessionId(activeSessionId);
-            setMessages(sessionMessages);
-            setCurrentView(tabUIState.currentView || 'chat'); // Respect stored view or default to chat
+            // selectChatSession will set currentChatSessionId and messages
+            await selectChatSession(activeSessionId); 
+            setCurrentView(tabUIState.currentView || 'chat');
           } else {
-            // Metadata for activeSessionId not found - inconsistent state
-            logger.sidepanel.error(`SidePanelChatContext: Metadata not found for supposedly active session ${activeSessionId} on tab ${tabId}. Resetting tab's active session.`);
+            logger.sidepanel.error(`SidePanelChatContext: Metadata not found for active session ${activeSessionId}. Resetting.`);
             await SidePanelStateManager.setActiveChatSessionForTab(tabId, null);
-            // This will cause initializeContext to re-run (due to potential state change or next render),
-            // and it should then fall into the `!activeSessionId` path to create a new session.
-            // Reset local state to reflect no active session for this render.
-            setCurrentChatSessionId(null);
-            setMessages([]);
-            setCurrentView('chat');
-            // Exit early, the next run of initializeContext will handle creation.
-            // The finally block will still run to release the lock.
-            return;
+            await createNewChat(); // Create a new session if the old one was invalid
           }
         }
       } catch (error) {
         logger.sidepanel.error('Error initializing SidePanelChatContext:', error);
-        setMessages([]); 
+        setMessages([]); // Ensure messages are cleared on error
         setCurrentChatSessionId(null);
         setCurrentView('chat');
       } finally {
@@ -425,8 +383,61 @@ export function SidePanelChatProvider({ children }) {
     };
 
     initializeContext();
-  // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [tabId, selectedPlatformId, selectedModel, currentTab?.url, currentTab?.title, clearTokenData]); // Dependencies for re-initialization
+    
+    return () => { // Cleanup for the initialization effect
+        isInitializingSessionRef.current = false; 
+    };
+  // eslint-disable-next-line react-hooks/exhaustive-deps 
+  }, [tabId, selectedPlatformId, selectedModel, currentTab?.url, currentTab?.title, clearTokenData, createNewChat, selectChatSession]); // Dependencies for initialization
+
+
+  // Memoized handler for storage changes related to chat sessions
+  const handleChatSessionsStorageChange = useCallback((changes, area) => {
+    if (area !== 'local' || !currentChatSessionId) return;
+
+    if (changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]) {
+      const allSessionsNewValue = changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS].newValue;
+      
+      setMessages(currentMessagesState => {
+        // Case 1: The storage no longer contains the current session (it might have been deleted)
+        if (!(allSessionsNewValue && allSessionsNewValue[currentChatSessionId])) {
+          if (currentMessagesState.length > 0) { // Only log/clear if there were messages
+            logger.sidepanel.warn(`Chat session ${currentChatSessionId} seems to have been deleted from storage. Current messages will be cleared.`);
+            // Potentially call createNewChat() here if you want to auto-start a new one.
+            // For now, just clearing messages to avoid loops if createNewChat modifies storage again immediately.
+            return []; 
+          }
+          return currentMessagesState; // No messages to clear, or session already gone
+        }
+
+        // Case 2: The current session exists in storage, check for updates
+        const newSessionData = allSessionsNewValue[currentChatSessionId];
+        const newMessagesFromStorage = newSessionData.messages || [];
+
+        if (areMessagesDifferent(currentMessagesState, newMessagesFromStorage)) {
+          logger.sidepanel.info(`Chat session ${currentChatSessionId} messages updated via storage listener.`);
+          return newMessagesFromStorage;
+        }
+        return currentMessagesState; // No change
+      });
+    }
+  }, [currentChatSessionId, setMessages]); // setMessages is stable from useState
+
+  // Effect for listening to storage changes for chat sessions
+  useEffect(() => {
+    if (!currentChatSessionId) { // Only listen if there's an active session
+      logger.sidepanel.debug('SidePanelChatContext: No currentChatSessionId, storage listener not added.');
+      return; 
+    }
+
+    chrome.storage.onChanged.addListener(handleChatSessionsStorageChange);
+    logger.sidepanel.debug(`SidePanelChatContext: Added storage listener for session ${currentChatSessionId}.`);
+
+    return () => {
+      chrome.storage.onChanged.removeListener(handleChatSessionsStorageChange);
+      logger.sidepanel.debug(`SidePanelChatContext: Removed storage listener for session ${currentChatSessionId}.`);
+    };
+  }, [currentChatSessionId, handleChatSessionsStorageChange]);
 
   // Get visible messages (filtering out extracted content - this might be removed if extracted content is no longer a separate message type)
   const visibleMessages = useMemo(() => {
diff --git a/src/sidepanel/hooks/useTokenTracking.js b/src/sidepanel/hooks/useTokenTracking.js
index af738e0..1895042 100644
--- a/src/sidepanel/hooks/useTokenTracking.js
+++ b/src/sidepanel/hooks/useTokenTracking.js
@@ -5,6 +5,7 @@ import { useState, useEffect, useCallback } from 'react';
 import { logger } from '../../shared/logger';
 import TokenManagementService from '../services/TokenManagementService';
 import { STORAGE_KEYS } from '../../shared/constants';
+import { areTokenStatsDifferent } from '../../shared/utils/comparison-utils';
 
 /**
  * Hook for tracking token usage and providing token statistics in React components
@@ -21,62 +22,76 @@ export function useTokenTracking(chatSessionId) {
   const [isLoading, setIsLoading] = useState(true);
 
   // Load token data for the session on mount and when session changes
+  // Memoized handler for storage changes related to token stats
+  const handleTokenStatsStorageChange = useCallback((changes, area) => {
+    if (area !== 'local' || !chatSessionId) return;
+
+    if (changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS]) {
+      const allChatTokenStatsNewValue = changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue;
+      
+      setTokenStats(currentTokenStatsState => {
+        // Case 1: Storage no longer contains stats for the current session
+        if (!(allChatTokenStatsNewValue && allChatTokenStatsNewValue[chatSessionId])) {
+          if (currentTokenStatsState.isCalculated) { // Only reset if stats were previously calculated
+             logger.sidepanel.warn(`Token stats for session ${chatSessionId} removed from storage. Resetting local stats.`);
+             return TokenManagementService._getEmptyStats();
+          }
+          return currentTokenStatsState; // No calculated stats to reset
+        }
+
+        // Case 2: Current session stats exist in storage, check for updates
+        const newSessionStatsFromStorage = {
+          ...TokenManagementService._getEmptyStats(), // Ensure all default fields
+          ...allChatTokenStatsNewValue[chatSessionId],
+          isCalculated: true, // Mark as calculated since it came from storage
+        };
+
+        if (areTokenStatsDifferent(currentTokenStatsState, newSessionStatsFromStorage)) {
+          logger.sidepanel.info(`Token stats for session ${chatSessionId} updated via storage listener.`);
+          return newSessionStatsFromStorage;
+        }
+        return currentTokenStatsState; // No change
+      });
+    }
+  }, [chatSessionId, setTokenStats]); // setTokenStats is stable from useState
+
+  // Effect for loading initial data and listening to storage changes for token stats
   useEffect(() => {
     const loadData = async () => {
       if (!chatSessionId) {
-        setTokenStats(TokenManagementService._getEmptyStats()); // Reset stats if no session ID
+        setTokenStats(TokenManagementService._getEmptyStats());
         setIsLoading(false);
         return;
       }
-
       setIsLoading(true);
       try {
-        // Load token stats using service
         const stats = await TokenManagementService.getTokenStatistics(chatSessionId);
         setTokenStats(stats);
       } catch (error) {
         logger.sidepanel.error('Error loading token data for session:', chatSessionId, error);
+        setTokenStats(TokenManagementService._getEmptyStats());
       } finally {
         setIsLoading(false);
       }
     };
 
-    loadData();
-
-    // Set up a listener for storage changes to keep state in sync
-    const handleStorageChange = (changes, area) => {
-      if (area !== 'local' || !chatSessionId) return;
-
-      // Check if global chat token statistics were updated
-      // Assuming TokenManagementService now stores stats under a global key, keyed by chatSessionId
-      if (
-        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] &&
-        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue
-      ) {
-        const allChatTokenStats =
-          changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue;
-        const sessionStats = allChatTokenStats[chatSessionId];
-        if (sessionStats) {
-          setTokenStats((_prevStats) => ({
-            ...TokenManagementService._getEmptyStats(),
-            ...sessionStats,
-            isCalculated: true,
-          }));
-        } else {
-          // If the current session's stats are not in the new value (e.g., cleared), reset them
-          setTokenStats(TokenManagementService._getEmptyStats());
-        }
-      }
-    };
-
-    // Add storage change listener
-    chrome.storage.onChanged.addListener(handleStorageChange);
+    loadData(); // Load initial data
 
-    // Clean up listener
+    // Listener part: only add if chatSessionId is present
+    if (!chatSessionId) {
+      logger.sidepanel.debug('useTokenTracking: No chatSessionId, storage listener not added.');
+      return;
+    }
+    
+    chrome.storage.onChanged.addListener(handleTokenStatsStorageChange);
+    logger.sidepanel.debug(`useTokenTracking: Added storage listener for session ${chatSessionId}.`);
+    
     return () => {
-      chrome.storage.onChanged.removeListener(handleStorageChange);
+      chrome.storage.onChanged.removeListener(handleTokenStatsStorageChange);
+      logger.sidepanel.debug(`useTokenTracking: Removed storage listener for session ${chatSessionId}.`);
     };
-  }, [chatSessionId]);
+    // Dependencies: chatSessionId (for loadData & listener registration) and the stable callback.
+  }, [chatSessionId, handleTokenStatsStorageChange]);
 
   /**
    * Calculate context window status based on current token stats
