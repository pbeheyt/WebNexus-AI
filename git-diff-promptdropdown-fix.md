diff --git a/src/components/input/PromptDropdown.jsx b/src/components/input/PromptDropdown.jsx
index 68a0a67..aa66f8b 100644
--- a/src/components/input/PromptDropdown.jsx
+++ b/src/components/input/PromptDropdown.jsx
@@ -2,6 +2,12 @@ import React, { useState, useEffect, useRef } from 'react';
 import PropTypes from 'prop-types';
 
 import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
+import { StarFilledIcon } from '../icons/StarFilledIcon';
+import { StarOutlineIcon } from '../icons/StarOutlineIcon';
+import { setDefaultPromptForContentType } from '../../shared/utils/prompt-utils.js';
+import { IconButton } from '../core/IconButton';
+import { STORAGE_KEYS, CONTENT_TYPE_LABELS } from '../../shared/constants'; // For onDefaultSet callback
+import { useNotification } from '../feedback/NotificationContext'; // For potential error feedback
 import { logger } from '../../shared/logger';
 
 /**
@@ -15,9 +21,17 @@ export function PromptDropdown({
   contentType,
   anchorRef,
   className = '',
+  onDefaultSet, // Destructure new prop
 }) {
   const [prompts, setPrompts] = useState([]);
   const [error, setError] = useState(null);
+  const [currentDefaultPromptId, setCurrentDefaultPromptId] = useState(null);
+  const [settingDefaultInProgress, setSettingDefaultInProgress] = useState(null); // Tracks ID of prompt being set as default
+  const notificationContext = useNotification();
+  const showNotificationError = notificationContext ? notificationContext.error : (message) => {
+    logger.popup.error(`NotificationContext not available. Error: ${message}`); // Or logger.sidepanel.error
+    console.error(`NotificationContext not available. Error: ${message}`);
+  };
   const [isVisible, setIsVisible] = useState(false);
   const dropdownRef = useRef(null);
 
@@ -37,24 +51,39 @@ export function PromptDropdown({
     return () => clearTimeout(timer);
   }, [isOpen]);
 
-  // Fetch relevant prompts when the dropdown opens
+  // Fetch relevant prompts and current default when the dropdown opens or content type changes
   useEffect(() => {
     if (isOpen && contentType) {
       setError(null);
-      loadRelevantPrompts(contentType)
-        .then((loadedPrompts) => {
+      setCurrentDefaultPromptId(null); // Reset while loading
+      setSettingDefaultInProgress(null); // Reset in-progress state
+
+      const fetchPromptsAndDefault = async () => {
+        try {
+          const loadedPrompts = await loadRelevantPrompts(contentType);
           setPrompts(loadedPrompts);
-        })
-        .catch((err) => {
-          logger.popup.error('Error loading prompts in dropdown:', err);
-          setError('Failed to load prompts.');
-        });
+
+          const storageResult = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
+          const customPromptsByType = storageResult[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
+          const defaultId = customPromptsByType[contentType]?.['_defaultPromptId_'];
+          setCurrentDefaultPromptId(defaultId || null);
+
+        } catch (err) {
+          logger.popup.error('Error loading prompts or default in dropdown:', err);
+          setError('Failed to load prompts or default setting.');
+          showNotificationError('Failed to load prompts or default setting.');
+        }
+      };
+      fetchPromptsAndDefault();
     } else {
-      // Reset state when closed
+      // Reset state when closed or contentType is null
       setPrompts([]);
       setError(null);
+      setCurrentDefaultPromptId(null);
+      setSettingDefaultInProgress(null);
     }
-  }, [isOpen, contentType]);
+  // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [isOpen, contentType, notificationContext]); // Depend on the context itself
 
   // Handle clicks outside the dropdown
   useEffect(() => {
@@ -77,6 +106,31 @@ export function PromptDropdown({
     };
   }, [isOpen, onClose, anchorRef]);
 
+  const handleSetAsDefault = async (promptToSet) => {
+    if (!promptToSet || settingDefaultInProgress) return;
+
+    setSettingDefaultInProgress(promptToSet.id);
+    try {
+      const success = await setDefaultPromptForContentType(promptToSet.contentType, promptToSet.id);
+      if (success) {
+        setCurrentDefaultPromptId(promptToSet.id);
+        if (onDefaultSet) {
+          const contentTypeLabel = CONTENT_TYPE_LABELS[promptToSet.contentType] || promptToSet.contentType;
+          onDefaultSet(promptToSet.name, contentTypeLabel);
+        }
+        // Do not call onClose() here, let the user see the change.
+        // Dropdown will close if they click outside or select a prompt to use.
+      } else {
+        showNotificationError(`Failed to set "${promptToSet.name}" as default.`);
+      }
+    } catch (err) {
+      logger.popup.error('Error setting default prompt:', err);
+      showNotificationError('An error occurred while setting the default prompt.');
+    } finally {
+      setSettingDefaultInProgress(null);
+    }
+  };
+
   if (!isOpen) {
     return null;
   }
@@ -94,17 +148,50 @@ export function PromptDropdown({
             No prompts available.
           </div>
       )}
-      {!error && prompts.length > 0 && prompts.map((prompt) => (
-        <button
-          key={prompt.id}
-          onClick={() => onSelectPrompt(prompt)}
-          className={`block w-full text-left px-3 py-1.5 ${className} text-theme-base hover:bg-theme-hover rounded cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis`}
-          role='option'
-          aria-selected='false'
-        >
-          {prompt.name}
-        </button>
-      ))}
+      {!error &&
+        prompts.length > 0 &&
+        prompts.map((promptItem) => {
+          const isCurrentDefault = promptItem.id === currentDefaultPromptId;
+          const isBeingSetAsDefault = settingDefaultInProgress === promptItem.id;
+
+          return (
+            <div
+              key={promptItem.id}
+              className={`flex items-center justify-between px-3 py-1.5 text-theme-base rounded cursor-pointer group ${className} ${promptItem.id === settingDefaultInProgress ? 'opacity-70' : 'hover:bg-theme-hover'}`}
+              role='option'
+              aria-selected='false' // This might need adjustment if the item itself is selectable vs. just the action button
+            >
+              <button
+                onClick={() => {
+                    if (!isBeingSetAsDefault) onSelectPrompt(promptItem);
+                }}
+                className="flex-grow text-left whitespace-nowrap overflow-hidden text-ellipsis mr-2 disabled:cursor-not-allowed"
+                disabled={isBeingSetAsDefault}
+              >
+                {promptItem.name}
+              </button>
+              
+              <div className="flex-shrink-0">
+                {isCurrentDefault ? (
+                  <StarFilledIcon
+                    className={`w-4 h-4 text-amber-500 ${isBeingSetAsDefault ? 'opacity-50' : ''}`}
+                    title="Current default prompt"
+                  />
+                ) : (
+                  <IconButton
+                    icon={StarOutlineIcon}
+                    onClick={() => handleSetAsDefault(promptItem)}
+                    disabled={isBeingSetAsDefault || !!settingDefaultInProgress} // Disable if any set operation is in progress
+                    className={`p-0.5 rounded text-theme-secondary group-hover:text-amber-500 group-hover:opacity-100 ${isBeingSetAsDefault ? 'animate-pulse' : 'opacity-0 focus:opacity-100'}`}
+                    iconClassName="w-4 h-4"
+                    aria-label={`Set "${promptItem.name}" as default prompt`}
+                    title={`Set as default`}
+                  />
+                )}
+              </div>
+            </div>
+          );
+        })}
     </div>
   );
 }
@@ -116,4 +203,5 @@ PromptDropdown.propTypes = {
   contentType: PropTypes.string,
   anchorRef: PropTypes.object,
   className: PropTypes.string,
+  onDefaultSet: PropTypes.func, // Callback when a default is set
 };
