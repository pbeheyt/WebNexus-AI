diff --git a/src/components/layout/AppHeader.jsx b/src/components/layout/AppHeader.jsx
index 3fe65cc..97ad0a2 100644
--- a/src/components/layout/AppHeader.jsx
+++ b/src/components/layout/AppHeader.jsx
@@ -13,6 +13,7 @@ import {
   RefreshIcon,
   ChevronDownIcon,
   XIcon,
+  ArrowUpIcon, // Added for history button
 } from '../';
 
 export function AppHeader({
@@ -34,6 +35,10 @@ export function AppHeader({
   onInfoFocus,
   onInfoBlur,
   infoButtonAriaLabel,
+  // New props for history view toggle
+  showHistoryButton = false,
+  onToggleHistoryView,
+  currentView = 'chat',
 }) {
   const { theme, toggleTheme, textSize, toggleTextSize } = useUI();
 
@@ -129,6 +134,19 @@ export function AppHeader({
           </button>
         )}
 
+        {/* History Toggle Button */}
+        {showHistoryButton && (
+          <button
+            onClick={onToggleHistoryView}
+            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
+            title={currentView === 'chat' ? 'View Chat History' : 'Back to Active Chat'}
+            aria-label={currentView === 'chat' ? 'View Chat History' : 'Back to Active Chat'}
+          >
+            {/* Replace with a proper HistoryIcon eventually */}
+            {currentView === 'chat' ? <span>H</span> : <ArrowUpIcon className="w-4 h-4 transform rotate-[-90deg]" />} 
+          </button>
+        )}
+
         {/* Render any custom buttons passed as children */}
         {children}
 
@@ -204,4 +222,8 @@ AppHeader.propTypes = {
   onInfoFocus: PropTypes.func,
   onInfoBlur: PropTypes.func,
   infoButtonAriaLabel: PropTypes.string,
+  // New prop types
+  showHistoryButton: PropTypes.bool,
+  onToggleHistoryView: PropTypes.func,
+  currentView: PropTypes.oneOf(['chat', 'history']),
 };
diff --git a/src/sidepanel/SidePanelApp.jsx b/src/sidepanel/SidePanelApp.jsx
index c23cde5..448145a 100644
--- a/src/sidepanel/SidePanelApp.jsx
+++ b/src/sidepanel/SidePanelApp.jsx
@@ -29,12 +29,18 @@ import { useSidePanelChat } from './contexts/SidePanelChatContext';
 export default function SidePanelApp() {
   const { tabId, setTabId, hasAnyPlatformCredentials } = useSidePanelPlatform();
   const {
-    resetCurrentTabData,
+    resetCurrentTabData, // This now means "start new chat for this tab"
     isRefreshing,
     tokenStats,
     contextStatus,
     isContentExtractionEnabled,
     setIsContentExtractionEnabled,
+    // New context values
+    currentView,
+    currentChatSessionId,
+    switchToHistoryView,
+    switchToChatView,
+    createNewChat,
   } = useSidePanelChat();
   const { contentType, currentTab, updateContentContext } = useContent();
   const { textSize } = useUI();
@@ -42,6 +48,9 @@ export default function SidePanelApp() {
   const [headerExpanded, setHeaderExpanded] = useState(true);
   const portRef = useRef(null);
 
+  // Placeholder for HistoryIcon, replace with actual icon later
+  const HistoryIcon = () => <span>H</span>; 
+
   const handleCloseShortcut = useCallback(async () => {
     if (!tabId) {
       logger.sidepanel.warn(
@@ -270,9 +279,12 @@ export default function SidePanelApp() {
           <div ref={appHeaderRef} className='flex-shrink-0'>
             <AppHeader
               showRefreshButton={true}
-              onRefreshClick={resetCurrentTabData}
+              onRefreshClick={resetCurrentTabData} // This now calls the context's resetCurrentTabData
               isRefreshing={isRefreshing}
               isExpanded={headerExpanded}
+              onToggleHistoryView={() => currentView === 'chat' ? switchToHistoryView() : switchToChatView()}
+              showHistoryButton={true}
+              currentView={currentView} // To determine icon/tooltip for history button
               onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
               showExpandToggle={true}
               showBorder={!headerExpanded}
@@ -280,22 +292,24 @@ export default function SidePanelApp() {
             />
           </div>
 
-          {/* Interactive Header Section */}
-          <div
-            ref={collapsibleHeaderRef} // Ref for height calculation
-            className='relative flex-shrink-0 z-10'
-          >
-            <Header
-              isExpanded={headerExpanded}
-              tokenStats={tokenStats}
-              contextStatus={contextStatus}
-              contentType={contentType}
-              isPageInjectable={isPageInjectable}
-              isContentExtractionEnabled={isContentExtractionEnabled}
-              setIsContentExtractionEnabled={setIsContentExtractionEnabled}
-              hasAnyPlatformCredentials={hasAnyPlatformCredentials}
-            />
-          </div>
+          {/* Interactive Header Section - Conditionally rendered if in chat view */}
+          {currentView === 'chat' && (
+            <div
+              ref={collapsibleHeaderRef} // Ref for height calculation
+              className='relative flex-shrink-0 z-10'
+            >
+              <Header
+                isExpanded={headerExpanded}
+                tokenStats={tokenStats}
+                contextStatus={contextStatus}
+                contentType={contentType}
+                isPageInjectable={isPageInjectable}
+                isContentExtractionEnabled={isContentExtractionEnabled}
+                setIsContentExtractionEnabled={setIsContentExtractionEnabled}
+                hasAnyPlatformCredentials={hasAnyPlatformCredentials}
+              />
+            </div>
+          )}
 
           {isReady && tabId && isRefreshing && (
             <div className='absolute inset-0 bg-theme-primary/75 dark:bg-theme-primary/75 z-20 flex items-center justify-center pointer-events-auto'>
@@ -304,21 +318,44 @@ export default function SidePanelApp() {
             </div>
           )}
 
-          <ChatArea
-            className='flex-1 min-h-0 relative z-0'
-            otherUIHeight={otherUIHeight}
-            requestHeightRecalculation={debouncedCalculateHeight}
-          />
-
-          <div
-            ref={userInputRef}
-            className='flex-shrink-0 relative z-10 border-t border-theme select-none'
-          >
-            <UserInput
-              className=''
-              requestHeightRecalculation={debouncedCalculateHeight}
-            />
-          </div>
+          {/* Main Content Area: Chat or History View */}
+          {currentView === 'chat' && currentChatSessionId ? (
+            <>
+              <ChatArea
+                className='flex-1 min-h-0 relative z-0'
+                otherUIHeight={otherUIHeight}
+                requestHeightRecalculation={debouncedCalculateHeight}
+              />
+              <div ref={userInputRef} className='flex-shrink-0 relative z-10 border-t border-theme select-none'>
+                <UserInput
+                  className=''
+                  requestHeightRecalculation={debouncedCalculateHeight}
+                />
+              </div>
+            </>
+          ) : currentView === 'history' ? (
+            <div className="flex-1 overflow-y-auto p-4"> {/* Placeholder for ChatHistoryListView */}
+              <h2 className="text-lg font-semibold mb-2 text-theme-primary">Chat History</h2>
+              <button 
+                onClick={createNewChat} 
+                className="px-4 py-2 mb-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
+              >
+                New Chat
+              </button>
+              <p className="text-theme-secondary">History list will be here (Part 3).</p>
+              <button 
+                onClick={switchToChatView} 
+                className="px-4 py-2 mt-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
+              >
+                Back to Active Chat
+              </button>
+            </div>
+          ) : (
+            <div className="flex-1 flex items-center justify-center">
+              {/* Loading or error state if currentChatSessionId is null even in 'chat' view (should be handled by context init) */}
+              <SpinnerIcon className="w-8 h-8 text-theme-secondary" />
+            </div>
+          )}
         </>
       ) : (
         <div className='flex flex-col h-full w-full items-center justify-center p-4'>
@@ -338,4 +375,4 @@ export default function SidePanelApp() {
 
 SidePanelApp.propTypes = {
   // tabId is managed internally
-};
\ No newline at end of file
+};
diff --git a/src/sidepanel/components/ChatArea.jsx b/src/sidepanel/components/ChatArea.jsx
index 0d4c68e..01fb097 100644
--- a/src/sidepanel/components/ChatArea.jsx
+++ b/src/sidepanel/components/ChatArea.jsx
@@ -391,6 +391,8 @@ function ChatArea({
     ? isInjectablePage(currentTab.url)
     : false;
 
+  const { currentChatSessionId } = useSidePanelChat(); // Get currentChatSessionId
+
   const renderInitialView = () => {
     if (!hasAnyPlatformCredentials) {
       return (
@@ -582,10 +584,10 @@ function ChatArea({
           </div>
           <div className='flex flex-col items-center py-3 w-full'>
             <h3 className='text-base font-semibold mb-2'>
-              Start a conversation
+              {currentChatSessionId ? "New chat started" : "Start a conversation"}
             </h3>
             <p className='text-xs max-w-xs mx-auto'>
-              {getWelcomeMessage(contentType, isPageInjectableValue)}
+              {currentChatSessionId ? "Ask me anything!" : getWelcomeMessage(contentType, isPageInjectableValue)}
             </p>
           </div>
         </div>
diff --git a/src/sidepanel/contexts/SidePanelChatContext.jsx b/src/sidepanel/contexts/SidePanelChatContext.jsx
index 0cbea22..e590542 100644
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
@@ -321,32 +325,68 @@ export function SidePanelChatProvider({ children }) {
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
+            await SidePanelStateManager.setTabUIState(tabId, {
+              isVisible: true, // Assuming panel is visible if we're initializing context
+              activeChatSessionId: activeSessionId,
+              currentView: 'chat',
+            });
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
@@ -393,6 +433,88 @@ export function SidePanelChatProvider({ children }) {
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
+        await SidePanelStateManager.setTabUIState(tabId, {
+          isVisible: true, // Assume visible
+          activeChatSessionId: newChatSessionId,
+          currentView: 'chat',
+        });
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
+      await SidePanelStateManager.setTabUIState(tabId, {
+        isVisible: true, // Assume visible
+        activeChatSessionId: chatSessionIdToSelect,
+        currentView: 'chat',
+      });
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
@@ -500,7 +622,8 @@ export function SidePanelChatProvider({ children }) {
       isContentExtractionEnabled: effectiveContentExtractionEnabled,
       isThinkingModeEnabled: localIsThinkingModeEnabled,
       options: {
-        tabId,
+        tabId, // Keep tabId for other potential uses (e.g. source, logging)
+        chatSessionId: currentChatSessionId, // Add this
         source: INTERFACE_SOURCES.SIDEPANEL,
         ...(rerunStatsRef.current && {
           preTruncationCost: rerunStatsRef.current.preTruncationCost,
@@ -534,12 +657,76 @@ export function SidePanelChatProvider({ children }) {
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
@@ -566,101 +753,6 @@ export function SidePanelChatProvider({ children }) {
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
@@ -691,8 +783,9 @@ export function SidePanelChatProvider({ children }) {
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
@@ -710,11 +803,17 @@ export function SidePanelChatProvider({ children }) {
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
diff --git a/src/sidepanel/hooks/useChatStreaming.js b/src/sidepanel/hooks/useChatStreaming.js
index 011fde0..e5d4273 100644
--- a/src/sidepanel/hooks/useChatStreaming.js
+++ b/src/sidepanel/hooks/useChatStreaming.js
@@ -9,7 +9,8 @@ import { MESSAGE_ROLES, STORAGE_KEYS } from '../../shared/constants';
  * updating UI, handling completion/errors/cancellation, and managing cancellation requests.
  *
  * @param {object} args - Dependencies passed from the parent context.
- * @param {number} args.tabId - The current tab ID.
+ * @param {number} [args.tabId] - The current tab ID (optional, for logging or specific tab interactions).
+ * @param {string} args.chatSessionId - The current chat session ID.
  * @param {function} args.setMessages - State setter for the messages array.
  * @param {Array} args.messages - Current messages array (read-only).
  * @param {object} args.modelConfigData - Configuration for the selected model.
@@ -31,7 +32,8 @@ import { MESSAGE_ROLES, STORAGE_KEYS } from '../../shared/constants';
  * @returns {object} - Object containing the cancelStream function.
  */
 export function useChatStreaming({
-  tabId,
+  tabId, // Kept if needed for logging or other tab-specific interactions not related to history/stats
+  chatSessionId,
   setMessages,
   modelConfigData,
   selectedModel,
@@ -156,7 +158,7 @@ export function useChatStreaming({
           });
 
           // --- API Cost Calculation and History Saving ---
-          if (tabId) {
+          if (chatSessionId) { // Use chatSessionId here
             const finalUpdatedMessagesForStateAndHistory = updatedMessagesArray.map(msg => {
                 if (msg.id === messageId && !isError) { // Only try to add cost if not an error
                     let tempApiCost = null;
@@ -180,7 +182,7 @@ export function useChatStreaming({
             });
 
             ChatHistoryService.saveHistory(
-                tabId,
+                chatSessionId, // Use chatSessionId here
                 finalUpdatedMessagesForStateAndHistory,
                 modelConfigData, // Use modelConfigData from the hook's closure
                 {
@@ -208,7 +210,7 @@ export function useChatStreaming({
     },
     [
       selectedModel,
-      tabId,
+      chatSessionId, // Use chatSessionId here
       modelConfigData,
       rerunStatsRef,
       batchedStreamingContentRef,
@@ -217,6 +219,8 @@ export function useChatStreaming({
       ChatHistoryService,
       TokenManagementService,
       isThinkingModeEnabled,
+      // tabId is implicitly included if it's part of the dependencies for other reasons,
+      // but the core logic here now depends on chatSessionId for history.
     ]
   );
 
diff --git a/src/sidepanel/hooks/useMessageActions.js b/src/sidepanel/hooks/useMessageActions.js
index 7dbfbb0..b530e79 100644
--- a/src/sidepanel/hooks/useMessageActions.js
+++ b/src/sidepanel/hooks/useMessageActions.js
@@ -24,7 +24,8 @@ import { createStructuredPromptString } from '../../shared/utils/prompt-formatti
  * @param {string} args.selectedModel - Current selected model ID.
  * @param {object} args.selectedPlatform - Current selected platform details.
  * @param {string} args.selectedPlatformId - Current selected platform ID.
- * @param {number} args.tabId - Current tab ID.
+ * @param {number} [args.tabId] - Current tab ID (kept for context extraction options).
+ * @param {string} args.chatSessionId - Current chat session ID.
  * @param {object} args.rerunStatsRef - Ref containing pre-truncation stats.
  * @param {function} args.processContentViaApi - API processing function.
  * @param {function} args.resetContentProcessing - Function to reset API state.
@@ -42,7 +43,8 @@ const _initiateRerunSequence = async ({
   batchedStreamingContentRef,
   selectedModel,
   selectedPlatformId,
-  tabId,
+  tabId, // Kept for context extraction options
+  chatSessionId, // Added
   currentTab,
   rerunStatsRef,
   isContentExtractionEnabled,
@@ -100,7 +102,8 @@ const _initiateRerunSequence = async ({
     isContentExtractionEnabled: effectiveExtractionEnabledForRerun,
     isThinkingModeEnabled: isThinkingModeEnabled,
     options: {
-      tabId,
+      tabId, // Kept for context extraction options
+      chatSessionId, // Added
       source: INTERFACE_SOURCES.SIDEPANEL,
       ...(rerunStatsRef.current && {
         preTruncationCost: rerunStatsRef.current.preTruncationCost,
@@ -114,7 +117,7 @@ const _initiateRerunSequence = async ({
     resetContentProcessing,
     ChatHistoryService,
     modelConfigData,
-    tabId,
+    // tabId is already in options if needed by _initiateApiCall for other reasons
     assistantMessageIdOnError: assistantPlaceholderId,
     messagesOnError: truncatedMessages,
     rerunStatsRef,
@@ -142,7 +145,8 @@ const _initiateRerunSequence = async ({
  * Custom hook to manage message actions like rerun, edit & rerun.
  *
  * @param {object} args - Dependencies passed from the parent context.
- * @param {number} args.tabId - The current tab ID.
+ * @param {number} [args.tabId] - The current tab ID (kept for context extraction options).
+ * @param {string} args.chatSessionId - The current chat session ID.
  * @param {function} args.setMessages - State setter for the messages array.
  * @param {Array} args.messages - Current messages array (read-only).
  * @param {string} args.selectedPlatformId - ID of the selected platform.
@@ -162,7 +166,8 @@ const _initiateRerunSequence = async ({
  * @returns {object} - Object containing action functions: { rerunMessage, editAndRerunMessage, rerunAssistantMessage }.
  */
 export function useMessageActions({
-  tabId,
+  tabId, // Kept for context extraction options
+  chatSessionId, // Added
   setMessages,
   messages,
   selectedPlatformId,
@@ -185,7 +190,7 @@ export function useMessageActions({
   const rerunMessage = useCallback(
     async (messageId) => {
       // --- Guards ---
-      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
+      if (!chatSessionId || !selectedPlatformId || !selectedModel || isProcessing) // Use chatSessionId
         return;
       const index = messages.findIndex((msg) => msg.id === messageId);
       if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
@@ -229,7 +234,8 @@ export function useMessageActions({
         batchedStreamingContentRef,
         selectedModel,
         selectedPlatformId,
-        tabId,
+        tabId, // Kept for context extraction options
+        chatSessionId, // Added
         currentTab: currentTab,
         rerunStatsRef,
         isContentExtractionEnabled,
@@ -248,7 +254,8 @@ export function useMessageActions({
       selectedPlatformId,
       selectedModel,
       setStreamingMessageId,
-      tabId,
+      tabId, // Kept for context extraction options
+      chatSessionId, // Added
       isProcessing,
       resetContentProcessing,
       modelConfigData,
@@ -267,7 +274,7 @@ export function useMessageActions({
     async (messageId, newContent) => {
       // --- Guards ---
       if (
-        !tabId ||
+        !chatSessionId || // Use chatSessionId
         !selectedPlatformId ||
         !selectedModel ||
         isProcessing ||
@@ -328,7 +335,8 @@ export function useMessageActions({
         batchedStreamingContentRef,
         selectedModel,
         selectedPlatformId,
-        tabId,
+        tabId, // Kept for context extraction options
+        chatSessionId, // Added
         currentTab: currentTab,
         rerunStatsRef,
         isContentExtractionEnabled,
@@ -347,7 +355,8 @@ export function useMessageActions({
       selectedPlatformId,
       selectedModel,
       setStreamingMessageId,
-      tabId,
+      tabId, // Kept for context extraction options
+      chatSessionId, // Added
       isProcessing,
       resetContentProcessing,
       modelConfigData,
@@ -366,7 +375,7 @@ export function useMessageActions({
   const rerunAssistantMessage = useCallback(
     async (assistantMessageId) => {
       // --- Guards ---
-      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
+      if (!chatSessionId || !selectedPlatformId || !selectedModel || isProcessing) // Use chatSessionId
         return;
       const assistantIndex = messages.findIndex(
         (msg) => msg.id === assistantMessageId
@@ -418,7 +427,8 @@ export function useMessageActions({
         batchedStreamingContentRef,
         selectedModel,
         selectedPlatformId,
-        tabId,
+        tabId, // Kept for context extraction options
+        chatSessionId, // Added
         currentTab: currentTab,
         rerunStatsRef,
         isContentExtractionEnabled,
@@ -431,7 +441,8 @@ export function useMessageActions({
       });
     },
     [
-      tabId,
+      tabId, // Kept for context extraction options
+      chatSessionId, // Added
       selectedPlatformId,
       selectedModel,
       isProcessing,
diff --git a/src/sidepanel/hooks/useTokenTracking.js b/src/sidepanel/hooks/useTokenTracking.js
index 3d46897..af738e0 100644
--- a/src/sidepanel/hooks/useTokenTracking.js
+++ b/src/sidepanel/hooks/useTokenTracking.js
@@ -10,20 +10,21 @@ import { STORAGE_KEYS } from '../../shared/constants';
  * Hook for tracking token usage and providing token statistics in React components
  * Thin wrapper around TokenManagementService for React state management
  *
- * @param {number} tabId - Tab ID
+ * @param {string} chatSessionId - Chat Session ID
  * @returns {Object} - Token tracking capabilities and statistics
  */
-export function useTokenTracking(tabId) {
+export function useTokenTracking(chatSessionId) {
   // Initialize state using the updated structure from TokenManagementService
   const [tokenStats, setTokenStats] = useState(
     TokenManagementService._getEmptyStats()
   );
   const [isLoading, setIsLoading] = useState(true);
 
-  // Load token data for the tab on mount and when tab changes
+  // Load token data for the session on mount and when session changes
   useEffect(() => {
     const loadData = async () => {
-      if (!tabId) {
+      if (!chatSessionId) {
+        setTokenStats(TokenManagementService._getEmptyStats()); // Reset stats if no session ID
         setIsLoading(false);
         return;
       }
@@ -31,10 +32,10 @@ export function useTokenTracking(tabId) {
       setIsLoading(true);
       try {
         // Load token stats using service
-        const stats = await TokenManagementService.getTokenStatistics(tabId);
+        const stats = await TokenManagementService.getTokenStatistics(chatSessionId);
         setTokenStats(stats);
       } catch (error) {
-        logger.sidepanel.error('Error loading token data:', error);
+        logger.sidepanel.error('Error loading token data for session:', chatSessionId, error);
       } finally {
         setIsLoading(false);
       }
@@ -44,23 +45,26 @@ export function useTokenTracking(tabId) {
 
     // Set up a listener for storage changes to keep state in sync
     const handleStorageChange = (changes, area) => {
-      if (area !== 'local' || !tabId) return;
+      if (area !== 'local' || !chatSessionId) return;
 
-      // Check if token statistics were updated directly in storage
+      // Check if global chat token statistics were updated
+      // Assuming TokenManagementService now stores stats under a global key, keyed by chatSessionId
       if (
-        changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS] &&
-        changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue
+        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] &&
+        changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue
       ) {
-        const allTokenStats =
-          changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue;
-        const tabStats = allTokenStats[tabId];
-        if (tabStats) {
-          // Ensure all fields, including new ones, are updated
+        const allChatTokenStats =
+          changes[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS].newValue;
+        const sessionStats = allChatTokenStats[chatSessionId];
+        if (sessionStats) {
           setTokenStats((_prevStats) => ({
-            ...TokenManagementService._getEmptyStats(), // Start with default empty stats
-            ...tabStats, // Overwrite with values from storage
-            isCalculated: true, // Mark as calculated
+            ...TokenManagementService._getEmptyStats(),
+            ...sessionStats,
+            isCalculated: true,
           }));
+        } else {
+          // If the current session's stats are not in the new value (e.g., cleared), reset them
+          setTokenStats(TokenManagementService._getEmptyStats());
         }
       }
     };
@@ -72,7 +76,7 @@ export function useTokenTracking(tabId) {
     return () => {
       chrome.storage.onChanged.removeListener(handleStorageChange);
     };
-  }, [tabId]);
+  }, [chatSessionId]);
 
   /**
    * Calculate context window status based on current token stats
@@ -81,7 +85,8 @@ export function useTokenTracking(tabId) {
    */
   const calculateContextStatus = useCallback(
     async (modelConfig) => {
-      if (!tabId || !modelConfig || !modelConfig.tokens.contextWindow) {
+      // Now relies on tokenStats which are for the current chatSessionId
+      if (!modelConfig || !modelConfig.tokens || !modelConfig.tokens.contextWindow) {
         return {
           warningLevel: 'none',
           percentage: 0,
@@ -92,7 +97,7 @@ export function useTokenTracking(tabId) {
       }
 
       try {
-        // Use direct service call with current token stats
+        // Use direct service call with current token stats (already for the correct chatSessionId)
         const status = await TokenManagementService.calculateContextStatus(
           tokenStats,
           modelConfig
@@ -110,7 +115,7 @@ export function useTokenTracking(tabId) {
         );
       } catch (error) {
         logger.sidepanel.error(
-          `[DIAG_LOG: useTokenTracking:calculateContextStatus] Caught error before/during static call for tabId: ${tabId}`,
+          `[DIAG_LOG: useTokenTracking:calculateContextStatus] Caught error for chatSessionId: ${chatSessionId}`,
           error
         );
         return {
@@ -122,44 +127,46 @@ export function useTokenTracking(tabId) {
         };
       }
     },
-    [tabId, tokenStats]
+    [chatSessionId, tokenStats] // chatSessionId for logging, tokenStats for calculation
   );
 
   /**
-   * Clear all token data for the current tab
+   * Clear all token data for the current chat session
+   * @param {string} sessionIdToClear - Optional: if provided, clears for this specific session. Defaults to current chatSessionId.
    * @returns {Promise<boolean>} - Success indicator
    */
-  const clearTokenData = useCallback(async () => {
-    if (!tabId) return false;
+  const clearTokenData = useCallback(async (sessionIdToClear) => {
+    const targetSessionId = sessionIdToClear || chatSessionId;
+    if (!targetSessionId) return false;
 
     try {
-      const success = await TokenManagementService.clearTokenStatistics(tabId);
+      const success = await TokenManagementService.clearTokenStatistics(targetSessionId);
 
-      if (success) {
-        // Reset state to empty stats
+      if (success && targetSessionId === chatSessionId) {
+        // Reset state to empty stats only if the cleared session is the current one
         setTokenStats(TokenManagementService._getEmptyStats());
       }
 
       return success;
     } catch (error) {
-      logger.sidepanel.error('Error clearing token data:', error);
+      logger.sidepanel.error('Error clearing token data for session:', targetSessionId, error);
       return false;
     }
-  }, [tabId]);
+  }, [chatSessionId]);
 
   /**
-   * Calculate and update token statistics for the current tab
+   * Calculate and update token statistics for the current chat session
    * @param {Array} messages - Chat messages
    * @param {Object} modelConfig - Model configuration
    * @returns {Promise<Object>} - Updated token statistics
    */
   const calculateStats = useCallback(
     async (messages, modelConfig = null) => {
-      if (!tabId) return tokenStats;
+      if (!chatSessionId) return tokenStats; // Return current (likely empty) stats if no session
 
       try {
         const stats = await TokenManagementService.calculateAndUpdateStatistics(
-          tabId,
+          chatSessionId,
           messages,
           modelConfig
         );
@@ -167,11 +174,11 @@ export function useTokenTracking(tabId) {
         setTokenStats(stats);
         return stats;
       } catch (error) {
-        logger.sidepanel.error('Error calculating token statistics:', error);
-        return tokenStats;
+        logger.sidepanel.error('Error calculating token statistics for session:', chatSessionId, error);
+        return tokenStats; // Return existing stats on error
       }
     },
-    [tabId, tokenStats]
+    [chatSessionId, tokenStats] // Depend on chatSessionId and tokenStats
   );
 
   return {
