diff --git a/src/background/index.js b/src/background/index.js
index 118b145..54b4175 100644
--- a/src/background/index.js
+++ b/src/background/index.js
@@ -164,7 +164,7 @@ function setupConnectionListener() {
         logger.background.info(`Side panel connected for tab ${tabId}`);
 
         // Mark sidepanel as visible upon connection
-        SidePanelStateManager.setSidePanelVisibilityForTab(tabId, true)
+        SidePanelStateManager.setTabUIVisibility(tabId, true)
           .then(() => {
             logger.background.info(
               `Set sidepanel visibility to true for tab ${tabId}`
@@ -187,7 +187,7 @@ function setupConnectionListener() {
             );
           }
           // Mark sidepanel as not visible upon disconnection
-          SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false)
+          SidePanelStateManager.setTabUIVisibility(tabId, false)
             .then(() => {
               logger.background.info(
                 `Set sidepanel visibility to false for tab ${tabId}`
