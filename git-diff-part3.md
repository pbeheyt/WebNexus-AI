diff --git a/src/sidepanel/SidePanelApp.jsx b/src/sidepanel/SidePanelApp.jsx
index 448145a..ddcb495 100644
--- a/src/sidepanel/SidePanelApp.jsx
+++ b/src/sidepanel/SidePanelApp.jsx
@@ -25,6 +25,7 @@ import Header from './components/Header';
 import ChatArea from './components/ChatArea';
 import { UserInput } from './components/UserInput';
 import { useSidePanelChat } from './contexts/SidePanelChatContext';
+import ChatHistoryListView from './components/ChatHistoryListView.jsx';
 
 export default function SidePanelApp() {
   const { tabId, setTabId, hasAnyPlatformCredentials } = useSidePanelPlatform();
@@ -334,22 +335,7 @@ export default function SidePanelApp() {
               </div>
             </>
           ) : currentView === 'history' ? (
-            <div className="flex-1 overflow-y-auto p-4"> {/* Placeholder for ChatHistoryListView */}
-              <h2 className="text-lg font-semibold mb-2 text-theme-primary">Chat History</h2>
-              <button 
-                onClick={createNewChat} 
-                className="px-4 py-2 mb-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
-              >
-                New Chat
-              </button>
-              <p className="text-theme-secondary">History list will be here (Part 3).</p>
-              <button 
-                onClick={switchToChatView} 
-                className="px-4 py-2 mt-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
-              >
-                Back to Active Chat
-              </button>
-            </div>
+            <ChatHistoryListView />
           ) : (
             <div className="flex-1 flex items-center justify-center">
               {/* Loading or error state if currentChatSessionId is null even in 'chat' view (should be handled by context init) */}
