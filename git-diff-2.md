diff --git a/src/sidepanel/components/Header.jsx b/src/sidepanel/components/Header.jsx
index dd768d6..3f754e3 100644
--- a/src/sidepanel/components/Header.jsx
+++ b/src/sidepanel/components/Header.jsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useRef, createContext } from 'react';
+import React, { useEffect, useState, useRef, createContext, useCallback } from 'react';
 
 import { useSidePanelPlatform } from '../../contexts/platform';
 import { useSidePanelChat } from '../contexts/SidePanelChatContext';
@@ -8,8 +8,11 @@ import {
   Toggle,
   InfoIcon,
   Tooltip,
+  SettingsIcon,
 } from '../../components';
+import { logger } from '../../shared/logger';
 
+import SidePanelModelParametersEditor from './SidePanelModelParametersEditor';
 import ModelSelector from './ModelSelector';
 
 // Create a context for dropdown state coordination
@@ -31,11 +34,47 @@ function Header() {
   const [tooltipVisible, setTooltipVisible] = useState(false);
   const infoIconRef = useRef(null);
   const [openDropdown, setOpenDropdown] = useState(null);
-  const [displayPlatformId, setDisplayPlatformId] =
-    useState(selectedPlatformId);
+  const [displayPlatformId, setDisplayPlatformId] = useState(selectedPlatformId);
   const dropdownRef = useRef(null);
   const triggerRef = useRef(null);
 
+  // State for Parameter Editor
+  const [isParamsEditorOpen, setIsParamsEditorOpen] = useState(false);
+  const [fullSelectedPlatformConfig, setFullSelectedPlatformConfig] = useState(null);
+  const [isParamsEditorReady, setIsParamsEditorReady] = useState(false); 
+
+  const handleParamsEditorReady = useCallback(() => { 
+    setIsParamsEditorReady(true);
+  }, []);
+
+  // Fetch full platform config when selectedPlatformId changes
+  useEffect(() => {
+    const fetchFullConfig = async () => {
+      if (selectedPlatformId && useSidePanelPlatform.getPlatformApiConfig) {
+        try {
+          const config = await useSidePanelPlatform.getPlatformApiConfig(selectedPlatformId);
+          const platformDisplayConfig = platforms.find(p => p.id === selectedPlatformId);
+          if (config && platformDisplayConfig) {
+            setFullSelectedPlatformConfig({
+              id: selectedPlatformId,
+              name: platformDisplayConfig.name,
+              iconUrl: platformDisplayConfig.iconUrl,
+              apiConfig: config, 
+            });
+          } else {
+            setFullSelectedPlatformConfig(null);
+          }
+        } catch (error) {
+          logger.sidepanel.error(`Error fetching full platform config for ${selectedPlatformId}:`, error);
+          setFullSelectedPlatformConfig(null);
+        }
+      } else {
+        setFullSelectedPlatformConfig(null);
+      }
+    };
+    fetchFullConfig();
+  }, [selectedPlatformId, platforms]);
+
   // Update display platform ID only when loading is finished
   useEffect(() => {
     if (!isLoading) {
@@ -106,7 +145,8 @@ function Header() {
 
   return (
     <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
-      <div className='flex items-center px-5'>
+      <div className='flex flex-col'>
+        <div className='flex items-center px-5'></div>
         <div className='flex items-center w-full min-w-0'>
           {hasAnyPlatformCredentials ? (
             <>
@@ -213,11 +253,17 @@ function Header() {
                 </div>
               )}
 
-              {/* 3. Spacer Element */}
-              <div
-                className='flex-grow'
-                style={{ pointerEvents: 'none' }}
-              ></div>
+              {/* Parameter Editor Toggle Button */}
+              <button
+                  onClick={() => setIsParamsEditorOpen(prev => !prev)}
+                  className={`ml-2 p-1 rounded-full text-theme-secondary hover:text-primary hover:bg-theme-active ${isParamsEditorOpen ? 'bg-theme-active text-primary' : ''}`}
+                  title='Model Parameters'
+                  aria-expanded={isParamsEditorOpen}
+                  disabled={!selectedPlatformId || !modelConfigData || isLoading}
+              >
+                  <SettingsIcon className='w-5 h-5' />
+              </button>
+              <div className='flex-grow' style={{ pointerEvents: 'none' }}></div>
             </>
           ) : (
             // When no credentials, show message
@@ -228,6 +274,23 @@ function Header() {
             </div>
           )}
         </div>
+        
+        {/* Parameter Editor Container */}
+        <div 
+            className={`transition-all duration-300 ease-in-out overflow-hidden ${isParamsEditorOpen && isParamsEditorReady ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
+            aria-hidden={!isParamsEditorOpen || !isParamsEditorReady}
+        >
+             {fullSelectedPlatformConfig && modelConfigData && (
+                 <SidePanelModelParametersEditor
+                    platform={fullSelectedPlatformConfig} 
+                    selectedModelId={useSidePanelPlatform.selectedModel}
+                    currentEditingMode={useSidePanelChat.currentEditingMode}
+                    modelConfigData={modelConfigData} 
+                    isVisible={isParamsEditorOpen} 
+                    onReady={handleParamsEditorReady} 
+                />
+            )}
+        </div>
       </div>
     </DropdownContext.Provider>
   );
diff --git a/src/styles/index.css b/src/styles/index.css
index e724c52..f2809d4 100644
--- a/src/styles/index.css
+++ b/src/styles/index.css
@@ -118,6 +118,10 @@
 
 /* Utility classes */
 @layer utilities {
+  .text-xxs {
+    font-size: 0.65rem; /* approx 10.4px if base is 16px */
+    line-height: 0.85rem; /* approx 13.6px */
+  }
   .prompt-content-scrollable {
     max-height: 300px;
     overflow-y: auto;
