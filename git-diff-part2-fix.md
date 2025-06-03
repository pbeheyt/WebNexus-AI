diff --git a/src/sidepanel/contexts/SidePanelChatContext.jsx b/src/sidepanel/contexts/SidePanelChatContext.jsx
index 0cbea22..9284b85 100644
--- a/src/sidepanel/contexts/SidePanelChatContext.jsx
+++ b/src/sidepanel/contexts/SidePanelChatContext.jsx
@@ -59,6 +59,8 @@ export function SidePanelChatProvider({ children }) {
   );
   const [isRefreshing, setIsRefreshing] = useState(false);
   const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);
+  const [currentChatSessionId, setCurrentChatSessionId] = useState(null);
+  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'history'
 
   // Refs remain in the context as they are shared between hooks/context logic
   const batchedStreamingContentRef = useRef('');
@@ -67,7 +69,7 @@ export function SidePanelChatProvider({ children }) {
 
   // Use the token tracking hook
   const { tokenStats, calculateContextStatus, clearTokenData, calculateStats } =
-    useTokenTracking(tabId);
+    useTokenTracking(currentChatSessionId);
 
   // Use the content processing hook
   const {
@@ -131,9 +133,9 @@ export function SidePanelChatProvider({ children }) {
           };
           const finalMessages = [...messagesOnError, systemMessage];
           setMessages(finalMessages);
-          if (options.tabId) {
+          if (options.chatSessionId) {
             await ChatHistoryService.saveHistory(
-              options.tabId,
+              options.chatSessionId,
               finalMessages,
               modelConfigData
             );
@@ -178,7 +180,7 @@ export function SidePanelChatProvider({ children }) {
         const finalErrorMessages = [...messagesOnError, systemErrorMessage];
         setMessages(finalErrorMessages);
 
-        if (options.tabId) {
+        if (options.chatSessionId) {
           const savedStats = localRerunStatsRef?.current;
           const historyOptions = savedStats
             ? {
@@ -187,7 +189,7 @@ export function SidePanelChatProvider({ children }) {
               }
             : {};
           await ChatHistoryService.saveHistory(
-            options.tabId,
+            options.chatSessionId,
             finalErrorMessages,
             modelConfigData,
             historyOptions
@@ -217,7 +219,8 @@ export function SidePanelChatProvider({ children }) {
 
   // --- Instantiate Hooks (Pass _initiateApiCall) ---
   const { cancelStream } = useChatStreaming({
-    tabId,
+    tabId, // Kept for potential other uses, core logic shifts to chatSessionId
+    chatSessionId: currentChatSessionId,
     setMessages,
     messages,
     modelConfigData,
@@ -240,7 +243,8 @@ export function SidePanelChatProvider({ children }) {
 
   const { rerunMessage, editAndRerunMessage, rerunAssistantMessage } =
     useMessageActions({
-      tabId,
+      tabId, // Kept for context extraction, core logic shifts to chatSessionId
+      chatSessionId: currentChatSessionId,
       setMessages,
       messages,
       selectedPlatformId,
@@ -321,32 +325,66 @@ export function SidePanelChatProvider({ children }) {
     }
   }, [tokenStats, isPlatformLoading]);
 
-  // Load chat history for current tab & set initial content extraction toggle state
+  // Comprehensive Initialization Logic
   useEffect(() => {
-    const loadChatHistoryAndSetToggle = async () => {
-      if (!tabId) return;
-      try {
-        const history = await ChatHistoryService.getHistory(tabId);
-        setMessages(history);
+    const initializeContext = async () => {
+      if (!tabId || !selectedPlatformId) { // selectedModel might not be ready immediately
+        // Don't clear messages here, wait for valid context or new session
+        return;
+      }
 
-        // Set initial state of isContentExtractionEnabled based on history
-        if (history.length === 0) {
-          setIsContentExtractionEnabled(true); // ON for new chat
+      logger.sidepanel.info(`SidePanelChatContext: Initializing for tabId: ${tabId}`);
+      try {
+        const tabUIState = await SidePanelStateManager.getTabUIState(tabId);
+        let activeSessionId = tabUIState.activeChatSessionId;
+        let sessionMessages = [];
+
+        if (!activeSessionId) {
+          logger.sidepanel.info(`No active session for tab ${tabId}. Creating new one.`);
+          const newSession = await ChatHistoryService.createNewChatSession({
+            platformId: selectedPlatformId,
+            modelId: selectedModel, // selectedModel might be null initially, ChatHistoryService handles null
+            initialTabUrl: currentTab?.url,
+            initialTabTitle: currentTab?.title,
+          });
+          if (newSession && newSession.metadata) {
+            activeSessionId = newSession.metadata.id;
+            await SidePanelStateManager.setTabUIVisibility(tabId, true);
+            await SidePanelStateManager.setActiveChatSessionForTab(tabId, activeSessionId);
+            await SidePanelStateManager.setTabViewMode(tabId, 'chat');
+            logger.sidepanel.info(`New session ${activeSessionId} created and set for tab ${tabId}.`);
+            // New session means empty messages and cleared token data for this session
+            setMessages([]); // Handled by useTokenTracking based on session ID change
+            if (typeof clearTokenData === 'function') await clearTokenData(activeSessionId); // Pass session ID
+          } else {
+            logger.sidepanel.error('Failed to create a new chat session.');
+            setMessages([]); // Fallback to empty messages
+            setCurrentChatSessionId(null);
+            setCurrentView('chat');
+            return;
+          }
         } else {
-          setIsContentExtractionEnabled(false); // OFF if history exists
+          logger.sidepanel.info(`Loading existing session ${activeSessionId} for tab ${tabId}.`);
+          sessionMessages = await ChatHistoryService.getHistory(activeSessionId);
         }
 
-        if (history.length > 0 && modelConfigData) {
-          await calculateStats(history, modelConfigData);
-        }
+        setCurrentChatSessionId(activeSessionId);
+        setCurrentView(tabUIState.currentView || 'chat');
+        setMessages(sessionMessages);
+
+        // Token stats loading is handled by useTokenTracking hook via currentChatSessionId change
+
       } catch (error) {
-        logger.sidepanel.error('Error loading tab chat history:', error);
-        setIsContentExtractionEnabled(true); // Default to ON on error
+        logger.sidepanel.error('Error initializing SidePanelChatContext:', error);
+        setMessages([]); // Fallback
+        setCurrentChatSessionId(null);
+        setCurrentView('chat');
       }
     };
-    loadChatHistoryAndSetToggle();
-    // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [tabId]); // modelConfigData removed to prevent toggle reset on model change
+
+    initializeContext();
+  // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [tabId, selectedPlatformId, selectedModel, currentTab?.url, currentTab?.title]); // Dependencies for re-initialization
 
   // Get visible messages (filtering out extracted content - this might be removed if extracted content is no longer a separate message type)
   const visibleMessages = useMemo(() => {
@@ -393,6 +431,84 @@ export function SidePanelChatProvider({ children }) {
     loadPreference();
   }, [selectedPlatformId, selectedModel, tabId, modelConfigData]);
 
+  const createNewChat = useCallback(async () => {
+    if (!tabId || !selectedPlatformId ) return; // selectedModel can be null initially
+    logger.sidepanel.info(`SidePanelChatContext: createNewChat called for tab ${tabId}`);
+    try {
+      const newSession = await ChatHistoryService.createNewChatSession({
+        platformId: selectedPlatformId,
+        modelId: selectedModel,
+        initialTabUrl: currentTab?.url,
+        initialTabTitle: currentTab?.title,
+      });
+      if (newSession && newSession.metadata) {
+        const newChatSessionId = newSession.metadata.id;
+        await SidePanelStateManager.setTabUIVisibility(tabId, true);
+        await SidePanelStateManager.setActiveChatSessionForTab(tabId, newChatSessionId);
+        await SidePanelStateManager.setTabViewMode(tabId, 'chat');
+        setCurrentChatSessionId(newChatSessionId);
+        setMessages([]);
+        setCurrentView('chat');
+        if (typeof clearTokenData === 'function') await clearTokenData(newChatSessionId);
+        logger.sidepanel.info(`Successfully created and switched to new session ${newChatSessionId} for tab ${tabId}.`);
+      } else {
+         logger.sidepanel.error('Failed to create new chat session in createNewChat.');
+      }
+    } catch (error) {
+      logger.sidepanel.error('Error in createNewChat:', error);
+    }
+  }, [tabId, selectedPlatformId, selectedModel, currentTab, clearTokenData]);
+
+  const selectChatSession = useCallback(async (chatSessionIdToSelect) => {
+    if (!tabId || !chatSessionIdToSelect) return;
+    logger.sidepanel.info(`SidePanelChatContext: selectChatSession called for tab ${tabId}, session ${chatSessionIdToSelect}`);
+    try {
+      await SidePanelStateManager.setTabUIVisibility(tabId, true);
+      await SidePanelStateManager.setActiveChatSessionForTab(tabId, chatSessionIdToSelect);
+      await SidePanelStateManager.setTabViewMode(tabId, 'chat');
+      setCurrentChatSessionId(chatSessionIdToSelect);
+      const history = await ChatHistoryService.getHistory(chatSessionIdToSelect);
+      setMessages(history);
+      setCurrentView('chat');
+      // Token stats will be reloaded by useTokenTracking due to currentChatSessionId change
+      logger.sidepanel.info(`Successfully selected session ${chatSessionIdToSelect} for tab ${tabId}.`);
+    } catch (error) {
+      logger.sidepanel.error('Error in selectChatSession:', error);
+    }
+  }, [tabId]);
+
+  const switchToHistoryView = useCallback(async () => {
+    if (!tabId) return;
+    await SidePanelStateManager.setTabViewMode(tabId, 'history');
+    setCurrentView('history');
+  }, [tabId]);
+
+  const switchToChatView = useCallback(async () => {
+    if (!tabId) return;
+    await SidePanelStateManager.setTabViewMode(tabId, 'chat');
+    setCurrentView('chat');
+  }, [tabId]);
+
+  const deleteSelectedChatSession = useCallback(async (chatSessionIdToDelete) => {
+    if (!tabId || !chatSessionIdToDelete) return;
+    logger.sidepanel.info(`SidePanelChatContext: deleteSelectedChatSession called for session ${chatSessionIdToDelete}, current tab ${tabId}`);
+    try {
+      await ChatHistoryService.deleteChatSession(chatSessionIdToDelete);
+      // If the deleted session was active in the current tab, create a new one.
+      if (chatSessionIdToDelete === currentChatSessionId) {
+        logger.sidepanel.info(`Deleted session ${chatSessionIdToDelete} was active. Creating a new one for tab ${tabId}.`);
+        await createNewChat(); // This will set a new active session and switch view to 'chat'
+      } else {
+        // If a different session was deleted, and we are in history view, stay there.
+        // The history view component will need to refresh its list.
+        // If we were in chat view for a *different* session, that remains active.
+      }
+      // The ChatHistoryListView component will be responsible for re-fetching its list.
+    } catch (error) {
+      logger.sidepanel.error('Error in deleteSelectedChatSession:', error);
+    }
+  }, [tabId, currentChatSessionId, createNewChat]);
+
   // --- Send Message Logic ---
   const sendMessage = async (text = inputValue) => {
     const currentPlatformId = selectedPlatformId;
@@ -500,7 +616,8 @@ export function SidePanelChatProvider({ children }) {
       isContentExtractionEnabled: effectiveContentExtractionEnabled,
       isThinkingModeEnabled: localIsThinkingModeEnabled,
       options: {
-        tabId,
+        tabId, // Keep tabId for other potential uses (e.g. source, logging)
+        chatSessionId: currentChatSessionId, // Add this
         source: INTERFACE_SOURCES.SIDEPANEL,
         ...(rerunStatsRef.current && {
           preTruncationCost: rerunStatsRef.current.preTruncationCost,
@@ -534,12 +651,76 @@ export function SidePanelChatProvider({ children }) {
   };
 
   // --- Utility Functions (Remain in Context) ---
-  const clearChat = async () => {
-    if (!tabId) return;
-    setMessages([]);
-    await ChatHistoryService.clearHistory(tabId);
-    await clearTokenData();
-  };
+  const resetCurrentTabData = useCallback(async () => {
+    if (tabId === null || tabId === undefined) {
+      logger.sidepanel.warn('resetCurrentTabData called without a valid tabId.');
+      return;
+    }
+    if (isRefreshing) {
+      logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
+      return;
+    }
+
+    // Confirmation dialog
+    if (!window.confirm('Are you sure you want to start a new chat for this tab? The current chat session will remain in your history.')) {
+      return;
+    }
+
+    setIsRefreshing(true);
+    logger.sidepanel.info(`SidePanelChatContext: resetCurrentTabData (starting new chat) for tab ${tabId}`);
+    try {
+      if (streamingMessageId && isProcessing && !isCanceling) {
+        logger.sidepanel.info('Refresh requested: Cancelling ongoing stream first...');
+        await cancelStream(); // cancelStream is from useChatStreaming
+        logger.sidepanel.info('Stream cancellation attempted.');
+      }
+
+      // This now means "start a new chat for this tab"
+      await createNewChat(); 
+      
+      // The original 'clearTabData' message to background is no longer directly relevant here
+      // for deleting global history. It might be repurposed if specific tab-UI-state needs resetting beyond new chat.
+      // For now, createNewChat handles associating the tab with a new session.
+
+      logger.sidepanel.info('Local sidepanel state reset for new chat complete.');
+    } catch (error) {
+      logger.sidepanel.error('Error during resetCurrentTabData (starting new chat):', error);
+      // Fallback: try to ensure a clean state even on error
+      setMessages([]);
+      setInputValue('');
+      setStreamingMessageId(null);
+      setIsCanceling(false);
+      if (typeof clearTokenData === 'function' && currentChatSessionId) await clearTokenData(currentChatSessionId);
+      setIsContentExtractionEnabled(true);
+    } finally {
+      setIsRefreshing(false);
+    }
+  }, [tabId, isRefreshing, streamingMessageId, isProcessing, isCanceling, createNewChat, cancelStream, clearTokenData, currentChatSessionId]);
+  
+  const clearChat = useCallback(async () => {
+    if (!currentChatSessionId) {
+      logger.sidepanel.warn('clearChat called without an active chat session.');
+      return;
+    }
+    if (!window.confirm('Are you sure you want to clear all messages from the current chat session? This action cannot be undone.')) {
+      return;
+    }
+    logger.sidepanel.info(`SidePanelChatContext: Clearing messages for session ${currentChatSessionId}`);
+    try {
+      setMessages([]); // Clear UI immediately
+      // Save empty messages to the service. Pass necessary params.
+      // modelConfigData might be needed by saveHistory for token stats.
+      await ChatHistoryService.saveHistory(currentChatSessionId, [], modelConfigData, {}, isThinkingModeEnabled, null);
+      if (typeof clearTokenData === 'function') await clearTokenData(currentChatSessionId); // Clear associated token stats
+      // The session itself (metadata) still exists.
+      logger.sidepanel.info(`Messages cleared for session ${currentChatSessionId}.`);
+    } catch (error) {
+      logger.sidepanel.error(`Error clearing chat for session ${currentChatSessionId}:`, error);
+      // Potentially reload history to revert UI if save failed.
+      const history = await ChatHistoryService.getHistory(currentChatSessionId);
+      setMessages(history);
+    }
+  }, [currentChatSessionId, modelConfigData, isThinkingModeEnabled, clearTokenData]);
 
   // This function is now less relevant as content is always re-extracted if toggle is ON.
   // Keeping it for now in case it's used elsewhere, but its direct utility for sidepanel context might be diminished.
@@ -566,101 +747,6 @@ export function SidePanelChatProvider({ children }) {
     }
   }, [tabId]);
 
-  const resetCurrentTabData = useCallback(async () => {
-    if (tabId === null || tabId === undefined) {
-      logger.sidepanel.warn(
-        'resetCurrentTabData called without a valid tabId.'
-      );
-      return;
-    }
-    if (isRefreshing) {
-      logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
-      return;
-    }
-
-    if (
-      window.confirm(
-        'Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.'
-      )
-    ) {
-      setIsRefreshing(true);
-      try {
-        if (streamingMessageId && isProcessing && !isCanceling) {
-          logger.sidepanel.info(
-            'Refresh requested: Cancelling ongoing stream first...'
-          );
-          await cancelStream();
-          logger.sidepanel.info('Stream cancellation attempted.');
-        }
-
-        logger.sidepanel.info(
-          `Requesting background to clear data for tab ${tabId}`
-        );
-        try {
-          const clearResponse = await robustSendMessage({
-            action: 'clearTabData',
-            tabId: tabId,
-          });
-          if (clearResponse && clearResponse.success) {
-            logger.sidepanel.info(
-              `Background confirmed clearing data for tab ${tabId}`
-            );
-          } else {
-            logger.sidepanel.error(
-              'Background failed to confirm tab data clear:',
-              clearResponse?.error
-            );
-          }
-        } catch (sendError) {
-          logger.sidepanel.error(
-            'Error sending clearTabData message to background:',
-            sendError
-          );
-        }
-
-        logger.sidepanel.info('Resetting local sidepanel state...');
-        setMessages([]);
-        setInputValue('');
-        setStreamingMessageId(null);
-        setIsCanceling(false);
-        await clearTokenData();
-        setIsContentExtractionEnabled(true); // Reset toggle to ON after refresh
-        logger.sidepanel.info('Local sidepanel state reset complete.');
-      } catch (error) {
-        logger.sidepanel.error(
-          'Error during the refresh process (excluding background communication):',
-          error
-        );
-        try {
-          setMessages([]);
-          setInputValue('');
-          setStreamingMessageId(null);
-          setIsCanceling(false);
-          await clearTokenData();
-          setIsContentExtractionEnabled(true); // Reset toggle to ON even on error
-        } catch (resetError) {
-          logger.sidepanel.error(
-            'Error during fallback state reset:',
-            resetError
-          );
-        }
-      } finally {
-        logger.sidepanel.info(
-          'Setting isRefreshing to false in finally block.'
-        );
-        setIsRefreshing(false);
-      }
-    }
-  }, [
-    tabId,
-    isRefreshing,
-    clearTokenData,
-    cancelStream,
-    streamingMessageId,
-    isProcessing,
-    isCanceling,
-  ]);
-
   const toggleThinkingMode = useCallback(
     async (newState) => {
       if (!selectedPlatformId || !selectedModel) return;
@@ -691,8 +777,9 @@ export function SidePanelChatProvider({ children }) {
   return (
     <SidePanelChatContext.Provider
       value={{
-        messages: visibleMessages,
-        allMessages: messages,
+        messages: visibleMessages, // These are now for the currentChatSessionId
+        currentChatSessionId,
+        currentView,
         inputValue,
         contextStatus: stableContextStatus,
         isContentExtractionEnabled,
@@ -710,11 +797,17 @@ export function SidePanelChatProvider({ children }) {
         sendMessage,
         cancelStream,
         clearChat,
-        resetCurrentTabData,
-        clearFormattedContentForTab,
+        resetCurrentTabData, // This now means "start new chat for this tab"
+        clearFormattedContentForTab, // Purpose might need review, kept for now
         rerunMessage,
         editAndRerunMessage,
         rerunAssistantMessage,
+        // New functions and state
+        createNewChat,
+        selectChatSession,
+        switchToHistoryView,
+        switchToChatView,
+        deleteSelectedChatSession,
       }}
     >
       {children}
