diff --git a/cjs-to-esm-relative.js b/cjs-to-esm-relative.js
deleted file mode 100644
index 861a1a6..0000000
--- a/cjs-to-esm-relative.js
+++ /dev/null
@@ -1,217 +0,0 @@
-// cjs-to-esm-relative.js
-
-/**
- * This transform converts CommonJS modules (`require`, `module.exports`, `exports.name`)
- * to ES6 Modules (`import`, `export default`, `export const/let/var/function`).
- *
- * Key Features:
- * - Handles `const foo = require('bar')` -> `import foo from 'bar'`
- * - Handles `const { a, b } = require('bar')` -> `import { a, b } from 'bar'`
- * - Handles `require('bar')` (side effects) -> `import 'bar'`
- * - Handles `module.exports = foo` -> `export default foo`
- * - Handles `exports.foo = bar` -> `export const foo = bar` (or function/let/var)
- * - **Adds '.js' extension to relative import paths** (e.g., './utils' -> './utils.js')
- *   - Skips adding extension if one already exists (.js, .jsx, .ts, .tsx, .json, etc.)
- *   - Skips adding extension for node_modules imports.
- */
-export default function transformer(file, api) {
-  const j = api.jscodeshift;
-  const root = j(file.source);
-
-  const usedImportNames = new Set(); // Keep track of generated import names to avoid conflicts
-
-  // Helper to check if a path is relative
-  const isRelativePath = (p) => p.startsWith('.');
-
-  // Helper to check if a path already has a common extension
-  const hasExtension = (p) =>
-    /\.(js|jsx|ts|tsx|mjs|cjs|json|css|scss|less|sass|vue|svelte)$/i.test(p);
-
-  // Helper to add .js extension if relative and doesn't have one
-  const ensureJSExtension = (originalPath) => {
-    if (isRelativePath(originalPath) && !hasExtension(originalPath)) {
-      return `${originalPath}.js`;
-    }
-    return originalPath;
-  };
-
-  // --- 1. Convert `require` to `import` ---
-  root
-    .find(j.VariableDeclaration, {
-      declarations: [
-        {
-          init: {
-            type: 'CallExpression',
-            callee: { name: 'require' },
-          },
-        },
-      ],
-    })
-    .forEach((path) => {
-      const declaration = path.value.declarations[0];
-      const requireArg = declaration.init.arguments[0];
-
-      if (requireArg && requireArg.type === 'Literal') {
-        const sourcePath = ensureJSExtension(requireArg.value);
-        let importSpecifiers = [];
-        let importKind = 'value'; // Default import kind
-
-        if (declaration.id.type === 'Identifier') {
-          // const foo = require('bar'); -> import foo from 'bar';
-          importSpecifiers.push(j.importDefaultSpecifier(j.identifier(declaration.id.name)));
-          usedImportNames.add(declaration.id.name);
-        } else if (declaration.id.type === 'ObjectPattern') {
-          // const { a, b } = require('bar'); -> import { a, b } from 'bar';
-          declaration.id.properties.forEach((prop) => {
-            if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
-              // Handle potential renaming: { originalName: localName }
-              if (prop.key.name === prop.value.name) {
-                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name)));
-              } else {
-                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name), j.identifier(prop.value.name)));
-              }
-              usedImportNames.add(prop.value.name);
-            } else if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
-              // Handle potential renaming: { originalName: localName } (alternative AST structure)
-              if (prop.key.name === prop.value.name) {
-                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name)));
-              } else {
-                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name), j.identifier(prop.value.name)));
-              }
-               usedImportNames.add(prop.value.name);
-            }
-             // Add handling for other property types if needed (e.g., SpreadElement)
-          });
-        } else {
-          // Skip complex destructuring for simplicity
-          console.warn(`Skipping complex require declaration in ${file.path}`);
-          return;
-        }
-
-        const importDeclaration = j.importDeclaration(importSpecifiers, j.literal(sourcePath), importKind);
-        // Add comments from the original declaration to the new import
-        importDeclaration.comments = path.value.comments;
-        j(path).replaceWith(importDeclaration);
-      }
-    });
-
-  // Handle side-effect imports: require('foo');
-  root
-    .find(j.ExpressionStatement, {
-      expression: {
-        type: 'CallExpression',
-        callee: { name: 'require' },
-      },
-    })
-    .forEach((path) => {
-      const requireArg = path.value.expression.arguments[0];
-      if (requireArg && requireArg.type === 'Literal') {
-        const sourcePath = ensureJSExtension(requireArg.value);
-        const importDeclaration = j.importDeclaration([], j.literal(sourcePath));
-        importDeclaration.comments = path.value.comments;
-        j(path).replaceWith(importDeclaration);
-      }
-    });
-
-  // --- 2. Convert `module.exports` to `export default` ---
-  root
-    .find(j.ExpressionStatement, {
-      expression: {
-        type: 'AssignmentExpression',
-        operator: '=',
-        left: {
-          type: 'MemberExpression',
-          object: { name: 'module' },
-          property: { name: 'exports' },
-        },
-      },
-    })
-    .forEach((path) => {
-      const exportDeclaration = j.exportDefaultDeclaration(path.value.expression.right);
-      exportDeclaration.comments = path.value.comments;
-      j(path).replaceWith(exportDeclaration);
-    });
-
-  // --- 3. Convert `exports.foo = bar` to `export const foo = bar` (or function/let/var) ---
-  root
-    .find(j.ExpressionStatement, {
-      expression: {
-        type: 'AssignmentExpression',
-        operator: '=',
-        left: {
-          type: 'MemberExpression',
-          object: { name: 'exports' },
-        },
-      },
-    })
-    .forEach((path) => {
-      const assignment = path.value.expression;
-      const exportName = assignment.left.property.name;
-      const exportValue = assignment.right;
-
-      let declaration;
-
-      // Check if the value being assigned is a function expression
-      if (exportValue.type === 'FunctionExpression' || exportValue.type === 'ArrowFunctionExpression') {
-        // Convert to an export function declaration
-        declaration = j.functionDeclaration(
-          j.identifier(exportName),
-          exportValue.params,
-          exportValue.body,
-          exportValue.generator,
-          exportValue.async
-        );
-        // Copy comments from the function expression if they exist
-         if (exportValue.comments) {
-           declaration.comments = exportValue.comments;
-         }
-      } else {
-        // Default to exporting a const variable declaration
-        declaration = j.variableDeclaration('const', [
-          j.variableDeclarator(j.identifier(exportName), exportValue),
-        ]);
-         // Copy comments from the original statement if they exist
-         if (path.value.comments) {
-           declaration.comments = path.value.comments;
-         }
-      }
-
-
-      const exportNamedDeclaration = j.exportNamedDeclaration(declaration);
-      // Preserve comments from the original ExpressionStatement onto the new ExportNamedDeclaration
-       if (path.value.comments && !declaration.comments) { // Avoid duplicating comments
-         exportNamedDeclaration.comments = path.value.comments;
-       }
-
-      j(path).replaceWith(exportNamedDeclaration);
-    });
-
-  // --- 4. Convert simple `exports = module.exports = ...` (often seen in older UMD patterns) ---
-  // This is a basic attempt and might need refinement for complex UMD
-  root
-    .find(j.ExpressionStatement, {
-      expression: {
-        type: 'AssignmentExpression',
-        operator: '=',
-        left: { name: 'exports' },
-        right: {
-          type: 'AssignmentExpression',
-          operator: '=',
-          left: {
-            type: 'MemberExpression',
-            object: { name: 'module' },
-            property: { name: 'exports' },
-          },
-        },
-      },
-    })
-    .forEach((path) => {
-      const exportValue = path.value.expression.right.right;
-      const exportDeclaration = j.exportDefaultDeclaration(exportValue);
-      exportDeclaration.comments = path.value.comments;
-      j(path).replaceWith(exportDeclaration);
-    });
-
-
-  return root.toSource({ quote: 'single' }); // Use single quotes for consistency
-}
\ No newline at end of file
diff --git a/sidepanel.html b/sidepanel.html
index 28bac77..423496c 100644
--- a/sidepanel.html
+++ b/sidepanel.html
@@ -6,7 +6,7 @@
     <title>AI Content Assistant</title>
   </head>
   <body>
-    <div id="sidebar-root"></div>
-    <script src="dist/sidebar.bundle.js"></script>
+    <div id="sidepanel-root"></div>
+    <script src="dist/sidepanel.bundle.js"></script>
   </body>
 </html>
diff --git a/sidepanel_loader.html b/sidepanel_loader.html
deleted file mode 100644
index bd2ddd5..0000000
--- a/sidepanel_loader.html
+++ /dev/null
@@ -1,40 +0,0 @@
-<!DOCTYPE html>
-<html>
-<head>
-  <meta charset="utf-8">
-  <title>Loading Sidebar...</title>
-  <style>
-    body {
-      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
-      display: flex;
-      align-items: center;
-      justify-content: center;
-      height: 100vh;
-      margin: 0;
-      background-color: #ffffff; /* Light mode default */
-      color: #333333;
-      font-size: 14px;
-      text-align: center;
-    }
-    @media (prefers-color-scheme: dark) {
-      body {
-        background-color: #1e1e1e; /* Dark mode background */
-        color: #e0e0e0; /* Dark mode text */
-      }
-    }
-    /* Style for when dark class is explicitly set by JS */
-    html.dark body {
-        background-color: #1e1e1e;
-        color: #e0e0e0;
-    }
-    p {
-        padding: 20px;
-    }
-  </style>
-</head>
-<body>
-  <p>Loading sidebar...</p>
-  <!-- Assuming sidepanel_loader.js is in the same directory or correctly pathed by webpack -->
-  <script src="sidepanel_loader.js"></script>
-</body>
-</html>
diff --git a/sidepanel_loader.js b/sidepanel_loader.js
deleted file mode 100644
index 15f7e41..0000000
--- a/sidepanel_loader.js
+++ /dev/null
@@ -1,97 +0,0 @@
-// sidepanel_loader.js
-(async function() {
-  console.log('[Sidepanel Loader] Script started.');
-
-  // Attempt to apply dark mode based on system preference immediately
-  // This also handles the case where documentElement might not be fully ready for classList
-  try {
-      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
-          document.documentElement.classList.add('dark');
-      }
-  } catch (e) {
-      console.warn('[Sidepanel Loader] Could not apply initial dark mode via matchMedia:', e);
-  }
-
-
-  // Function to get tabId and current URL for the main page this panel is attached to.
-  async function getLoaderContext() {
-    return new Promise((resolve, reject) => {
-      // A script in a side panel can message the background to get its tab context.
-      // However, chrome.tabs.getCurrent() is not available in side panels.
-      // The most reliable way is for the background to tell it, or for the
-      // side panel to be opened with its tabId in the URL.
-      // Since the global command just calls open({tabId}), the loader's URL
-      // won't have query params from that initial open.
-      // We rely on the background to know which tab the global command was for.
-      // The background command handler should have passed tabId and currentUrl when opening this loader.
-      // Let's try to get it from URL params first, assuming background set it.
-      // If not, we have a problem as the loader won't know its context.
-      // For this plan, we assume the background's handleGlobalOpenOrToggleCommand
-      // will open sidepanel_loader.html?tabId=X&currentUrl=Y
-
-      const urlParams = new URLSearchParams(window.location.search);
-      const tabIdStr = urlParams.get('tabId');
-      const currentUrl = urlParams.get('currentUrl'); // URL of the main page
-
-      if (tabIdStr && currentUrl) {
-        const tabId = parseInt(tabIdStr, 10);
-        if (!isNaN(tabId)) {
-          console.log(`[Sidepanel Loader] Context from URL params: tabId=${tabId}, currentUrl=${currentUrl}`);
-          resolve({ tabId, currentUrl });
-          return;
-        }
-      }
-
-      // Fallback: if not in URL, ask background. This is less ideal as it's another async step.
-      // This part is tricky because the loader needs to identify itself.
-      // For now, we will strongly rely on the background command handler to open the loader with context in URL.
-      // If it's not there, it's an issue with the calling logic.
-      console.error('[Sidepanel Loader] CRITICAL: tabId or currentUrl not found in loader URL query parameters.');
-      reject(new Error('Loader context (tabId, currentUrl) not found in URL.'));
-    });
-  }
-
-  try {
-    const { tabId, currentUrl } = await getLoaderContext();
-
-    if (!tabId || isNaN(tabId) || !currentUrl) {
-      console.error('[Sidepanel Loader] Failed to get valid context (tabId, currentUrl).');
-      document.body.textContent = 'Error: Could not initialize sidebar context.';
-      return;
-    }
-
-    console.log(`[Sidepanel Loader] Context: tabId=${tabId}, currentUrl=${currentUrl}. Requesting final state.`);
-
-    chrome.runtime.sendMessage(
-      {
-        action: 'resolveSidePanelStateAndFinalize',
-        tabId: tabId,
-        currentUrl: currentUrl
-      },
-      (response) => {
-        if (chrome.runtime.lastError) {
-          console.error('[Sidepanel Loader] Error sending/receiving resolveSidePanelStateAndFinalize:', chrome.runtime.lastError.message);
-          document.body.textContent = 'Error: ' + chrome.runtime.lastError.message;
-          return;
-        }
-        if (response && response.error) {
-          console.error('[Sidepanel Loader] Error from background:', response.error);
-          document.body.textContent = 'Error: ' + response.error;
-        } else if (response && response.status) {
-          console.log('[Sidepanel Loader] Background status:', response.status);
-          // If the panel was closed by the background, this loader instance will become defunct.
-          // If navigated, this loader page will be replaced.
-          if (response.status === 'closed_not_allowed' || response.status === 'closed_on_toggle') {
-            // Optional: change text or do nothing as panel will be closed by background.
-            document.body.textContent = 'Sidebar closed.';
-          }
-        } else {
-            console.warn('[Sidepanel Loader] Unexpected response from background:', response);
-        }
-      }
-    );
-  } catch (e) {
-    console.error('[Sidepanel Loader] Initialization error:', e);
-    document.body.textContent = 'Error: Sidebar failed to load. ' + e.message;
-  }
-})();
diff --git a/src/background/api/api-coordinator.js b/src/background/api/api-coordinator.js
index 8a5f8d6..cdb8b10 100644
--- a/src/background/api/api-coordinator.js
+++ b/src/background/api/api-coordinator.js
@@ -135,11 +135,11 @@ export async function processContentViaApi(params) {
     promptId = null,
     platformId,
     modelId,
-    source = INTERFACE_SOURCES.POPUP,
+    source = INTERFACE_SOURCES.POPUP, // Default to POPUP if source not specified
     customPrompt = null,
     conversationHistory = [],
-          isContentExtractionEnabled,
-          isThinkingModeEnabled,
+    isContentExtractionEnabled,
+    isThinkingModeEnabled,
   } = params;
 
   if (!platformId || !modelId) {
@@ -164,20 +164,17 @@ export async function processContentViaApi(params) {
     let extractedContent = null;
     let newlyFormattedContent = null; // To hold content formatted in this run
     const contentType = determineContentType(url);
-    const isFirstUserMessage = conversationHistory.length === 0;
-    logger.background.info(
-      `Is this the first user message (history empty)? ${isFirstUserMessage}`
-    );
-
-    // 1. Decide whether to extract content based on existence, user request, and message history
-    const initialFormattedContentExists =
-      await hasFormattedContentForTab(tabId);
-    // Extraction depends on toggle state, content existence, and injectability.
-    const canInject = isInjectablePage(url); // Check if page allows injection
+    // const isFirstUserMessage = conversationHistory.length === 0; // Not used directly here, but good for context
+    // logger.background.info(
+    //   `Is this the first user message (history empty)? ${isFirstUserMessage}`
+    // );
+
+    // 1. Decide whether to extract content based on existence, user request, and injectability
+    const initialFormattedContentExists = await hasFormattedContentForTab(tabId);
+    const canInject = isInjectablePage(url);
     const shouldExtract =
       isContentExtractionEnabled && !initialFormattedContentExists && canInject;
 
-    // Log if extraction is skipped specifically due to non-injectable URL (even if toggle is on)
     if (
       isContentExtractionEnabled &&
       !initialFormattedContentExists &&
@@ -186,39 +183,30 @@ export async function processContentViaApi(params) {
       logger.background.info(
         `First message: Skipping extraction for tab ${tabId} because URL (${url}) is not injectable.`
       );
-      // Return immediately indicating context was skipped, preventing further processing for this message
       return {
-        success: true, // The operation itself didn't fail, it just skipped context
+        success: true,
         skippedContext: true,
         reason: 'Content extraction not supported on this page type.',
-        contentType: contentType, // Pass content type back if needed by UI
+        contentType: contentType,
       };
     }
 
-    // Example log update:
     if (shouldExtract) {
       logger.background.info(
         `Extraction enabled and content needed: Extraction will proceed for tab ${tabId} (injectable: ${canInject}, exists: ${initialFormattedContentExists}).`
       );
-      // Reset previous extraction state (ensure this happens ONLY if extracting)
       await resetExtractionState();
-
-      // Extract content
       logger.background.info(`Content type determined: ${contentType}`);
-      await extractContent(tabId, url); // url should be available here
-      extractedContent = await getExtractedContent(); // Assign to the outer scope variable
+      await extractContent(tabId, url);
+      extractedContent = await getExtractedContent();
 
       if (!extractedContent) {
         logger.background.warn(
           `Failed to extract content for tab ${tabId}, proceeding without it.`
         );
-        newlyFormattedContent = null; // Ensure null if extraction failed
+        newlyFormattedContent = null;
       } else {
         logger.background.info('Content extraction completed.');
-        // Format and Store Content
-        logger.background.info(
-          `Formatting extracted content (type: ${contentType})...`
-        );
         newlyFormattedContent = ContentFormatter.formatContent(
           extractedContent,
           contentType
@@ -228,12 +216,10 @@ export async function processContentViaApi(params) {
           `Formatted and stored content for tab ${tabId}.`
         );
       }
-      // Ensure these are null if extraction happened but failed
       if (!newlyFormattedContent) {
         extractedContent = null;
       }
     } else {
-      // Log the reason why extraction was skipped based on the new logic
       if (!isContentExtractionEnabled) {
         logger.background.info(
           `Extraction skipped for tab ${tabId}: Toggle is OFF.`
@@ -246,26 +232,18 @@ export async function processContentViaApi(params) {
         logger.background.info(
           `Extraction skipped for tab ${tabId}: Page is not injectable (${url}).`
         );
-      } else {
-        logger.background.warn(
-          `Extraction skipped for tab ${tabId} for unknown reason. Conditions: enabled=${isContentExtractionEnabled}, exists=${initialFormattedContentExists}, canInject=${canInject}`
-        );
       }
-      // Ensure these are null if extraction didn't happen
       extractedContent = null;
       newlyFormattedContent = null;
     }
 
-    // 4. Get the prompt
     let promptContent;
-
     if (customPrompt) {
       promptContent = customPrompt;
     } else {
       throw new Error('No prompt content provided');
     }
 
-    // 5. Parameter Resolution (Centralized) - Use platformId and modelId from params
     let resolvedParams = await ModelParameterService.resolveParameters(
       platformId,
       modelId,
@@ -274,26 +252,19 @@ export async function processContentViaApi(params) {
     resolvedParams.conversationHistory = conversationHistory;
     logger.background.info(`Resolved parameters:`, resolvedParams);
 
-    // 6. Generate a unique stream ID for this request
     const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
+    await initializeStreamResponse(streamId, platformId, resolvedParams.model);
 
-    // 7. Initialize streaming response (using platformId from params)
-    await initializeStreamResponse(streamId, platformId, resolvedParams.model); // Include model
-
-    // 8. Determine the formatted content to include in the request
     let formattedContentForRequest = null;
     const contextAlreadySent = await getTabContextSentFlag(tabId);
 
     if (!isContentExtractionEnabled) {
       logger.background.info(`Content inclusion skipped: Toggle is OFF.`);
-      formattedContentForRequest = null;
     } else if (contextAlreadySent) {
       logger.background.info(
         `Content inclusion skipped: Context already sent for tab ${tabId}.`
       );
-      formattedContentForRequest = null;
     } else {
-      // Toggle is ON and context not sent yet
       if (shouldExtract && newlyFormattedContent) {
         formattedContentForRequest = newlyFormattedContent;
         logger.background.info(
@@ -308,10 +279,9 @@ export async function processContentViaApi(params) {
         logger.background.info(
           `Content inclusion skipped: Toggle is ON, but no content available for tab ${tabId}.`
         );
-        formattedContentForRequest = null;
       }
     }
-
+    
     if (tabId) {
       try {
         const promptToStoreOrClear = resolvedParams.systemPrompt;
@@ -327,18 +297,16 @@ export async function processContentViaApi(params) {
       }
     }
 
-    // Set the flag *before* the API call if context is being included in this request
     if (formattedContentForRequest !== null) {
-        await setTabContextSentFlag(tabId, true);
-        logger.background.info(`Context included in this request. Set context sent flag for tab ${tabId}.`);
+      await setTabContextSentFlag(tabId, true);
+      logger.background.info(`Context included in this request. Set context sent flag for tab ${tabId}.`);
     }
 
-    // 10. Create unified request configuration
     const requestConfig = {
       prompt: promptContent,
-      resolvedParams: resolvedParams, // Pass the whole resolved params object ( includes history)
-      formattedContent: formattedContentForRequest, // Pass the formatted content string or null
-      streaming: true, // Always true for this function
+      resolvedParams: resolvedParams,
+      formattedContent: formattedContentForRequest,
+      streaming: true,
       onChunk: createStreamHandler(
         streamId,
         source,
@@ -348,40 +316,34 @@ export async function processContentViaApi(params) {
       ),
     };
 
-    // 11. Process with API (using platformId from params)
     const controller = new AbortController();
     activeAbortControllers.set(streamId, controller);
-    requestConfig.abortSignal = controller.signal; // Add signal to request config
+    requestConfig.abortSignal = controller.signal;
 
     try {
       logger.background.info(
         'Calling ApiServiceManager.processWithUnifiedConfig with config:',
         requestConfig
       );
-      // Pass platformId from params directly
       const apiResponse = await ApiServiceManager.processWithUnifiedConfig(
         platformId,
         requestConfig
       );
 
-      // If we get here without an error, streaming completed successfully
-
       return {
         success: true,
         streamId,
         response: apiResponse,
-        contentType: contentType, // Use the variable determined earlier
+        contentType: contentType,
       };
     } catch (processingError) {
-      // Handle API processing errors
       await setApiProcessingError(processingError.message);
-      throw processingError; // Re-throw to be caught by the outer catch
+      throw processingError;
     } finally {
       activeAbortControllers.delete(streamId);
       logger.background.info(`Removed AbortController for stream: ${streamId}`);
     }
   } catch (error) {
-    // This outer catch handles errors from setup (extraction, param resolution) AND re-thrown processing errors
     logger.background.error('API content processing error:', error);
     await setApiProcessingError(error.message);
     return {
@@ -395,7 +357,7 @@ export async function processContentViaApi(params) {
  * Create a stream handler function
  * @param {string} streamId - Stream identifier
  * @param {string} source - Interface source
- * @param {number} tabId - Tab ID for sidebar integration
+ * @param {number} tabId - Tab ID for sidepanel integration
  * @param {string} platformId - Platform identifier
  * @param {Object} resolvedParams - Resolved parameters including the model
  * @returns {Function} Chunk handler function
@@ -408,69 +370,58 @@ function createStreamHandler(
   resolvedParams
 ) {
   let fullContent = '';
-  // Use the resolved model from the start
   const modelToUse = resolvedParams.model;
 
   return async function handleChunk(chunkData) {
     if (!chunkData) return;
 
-    // Extract potential chunks
     const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
-    const thinkingChunk = typeof chunkData.thinkingChunk === 'string' ? chunkData.thinkingChunk : ''; // Get thinking chunk
+    const thinkingChunk = typeof chunkData.thinkingChunk === 'string' ? chunkData.thinkingChunk : '';
     const done = !!chunkData.done;
 
-    // Model should be consistent, but log if chunkData provides a different one
     if (chunkData.model && chunkData.model !== modelToUse) {
       logger.background.warn(
         `Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`
       );
     }
 
-    // Process intermediate chunks (regular or thinking)
-    if (!done && (chunk || thinkingChunk)) { // Send if not done and either chunk exists
-      fullContent += chunk; // Only accumulate regular content
+    if (!done && (chunk || thinkingChunk)) {
+      fullContent += chunk;
 
-      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
+      if (source === INTERFACE_SOURCES.SIDEPANEL && tabId) {
         try {
-          // **Explicitly construct the inner chunkData object**
           const chunkDataPayload = {
-              done: false,
-              model: modelToUse,
+            done: false,
+            model: modelToUse,
           };
           if (chunk) {
-              chunkDataPayload.chunk = chunk;
+            chunkDataPayload.chunk = chunk;
           }
           if (thinkingChunk) {
-              chunkDataPayload.thinkingChunk = thinkingChunk;
+            chunkDataPayload.thinkingChunk = thinkingChunk;
           }
 
-          // Prepare the full message payload for the sidebar
           const messagePayload = {
             action: 'streamChunk',
             streamId,
-            chunkData: chunkDataPayload, // Use the explicitly constructed object
+            chunkData: chunkDataPayload,
           };
-
-          // Send the payload
           chrome.runtime.sendMessage(messagePayload);
-
         } catch (err) {
           logger.background.warn('Error sending stream chunk:', err);
         }
       }
     }
 
-    // Handle stream completion or error
     if (done) {
       const finalChunkData = {
-        chunk: '', // Final message doesn't need the 'chunk' prop itself
+        chunk: '',
         done: true,
         model: modelToUse,
         fullContent: chunkData.fullContent || fullContent,
-        thinkingChunk: null, // Explicitly nullify thinkingChunk in final message
+        thinkingChunk: null,
       };
 
-      // Check for user cancellation first
       if (
         chunkData.error === 'Cancelled by user' ||
         (chunkData.error instanceof Error &&
@@ -479,17 +430,12 @@ function createStreamHandler(
         logger.background.info(
           `Stream ${streamId} cancelled by user. Processing partial content.`
         );
-        // Complete successfully to save partial state, but mark as cancelled for UI
-        await completeStreamResponse(fullContent, modelToUse, platformId); // No error passed
-        finalChunkData.cancelled = true; // Add cancellation flag
-        // Do NOT add finalChunkData.error
+        await completeStreamResponse(fullContent, modelToUse, platformId);
+        finalChunkData.cancelled = true;
       } else if (chunkData.error) {
-        // Handle other errors
-        // chunkData.error should now be the pre-formatted string from extractApiErrorMessage or similar
         const errorMessage = chunkData.error;
         logger.background.error(`Stream ended with error: ${errorMessage}`);
         await setApiProcessingError(errorMessage);
-        // Pass modelToUse and error to completeStreamResponse
         await completeStreamResponse(
           fullContent,
           modelToUse,
@@ -498,21 +444,17 @@ function createStreamHandler(
         );
         finalChunkData.error = errorMessage;
       } else {
-        // Handle successful completion
         logger.background.info(`Stream ${streamId} completed successfully.`);
-        // Pass modelToUse to completeStreamResponse
         await completeStreamResponse(fullContent, modelToUse, platformId);
       }
 
-      // Ensure the final message (success, error, or cancelled) is sent for sidebar
-      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
+      if (source === INTERFACE_SOURCES.SIDEPANEL && tabId) {
         try {
           const finalMessagePayload = {
             action: 'streamChunk',
             streamId,
-            chunkData: finalChunkData, // Send the final chunk data object
+            chunkData: finalChunkData,
           };
-          // Use runtime API for sidebar communication
           chrome.runtime.sendMessage(finalMessagePayload);
         } catch (err) {
           logger.background.warn(
@@ -523,4 +465,4 @@ function createStreamHandler(
       }
     }
   };
-}
\ No newline at end of file
+}
diff --git a/src/background/core/message-router.js b/src/background/core/message-router.js
index 6f60eff..83895da 100644
--- a/src/background/core/message-router.js
+++ b/src/background/core/message-router.js
@@ -12,7 +12,7 @@ import {
   handleProcessContentRequest,
   handleProcessContentViaApiRequest,
 } from '../services/content-processing.js';
-import { handleToggleNativeSidePanelAction, handleCloseCurrentSidePanelRequest } from '../services/sidebar-manager.js';
+import { handleToggleNativeSidePanelAction, handleCloseCurrentSidePanelRequest } from '../services/sidepanel-manager.js';
 import { handleThemeOperation } from '../services/theme-service.js';
 import { handleClearTabDataRequest } from '../listeners/tab-state-listener.js';
 
@@ -51,7 +51,7 @@ export function setupMessageRouter() {
       return false;
     }
 
-    // Handle getCurrentTabId for tab-specific sidebar functionality
+    // Handle getCurrentTabId for tab-specific sidepanel functionality
     if (message.action === 'getCurrentTabId') {
       sendResponse({ tabId: sender.tab ? sender.tab.id : null });
       return false;
@@ -171,7 +171,7 @@ function registerServiceHandlers() {
     return true; // Keep channel open for async response
   });
 
-  // Clear specific tab data (for sidebar refresh)
+  // Clear specific tab data (for sidepanel refresh)
   messageHandlers.set('clearTabData', handleClearTabDataRequest);
 
   // Handle requests to toggle the native side panel
diff --git a/src/background/index.js b/src/background/index.js
index 030828e..e9b5b06 100644
--- a/src/background/index.js
+++ b/src/background/index.js
@@ -1,6 +1,6 @@
 // src/background/index.js - Entry point for background service worker
 
-import SidebarStateManager from '../services/SidebarStateManager.js';
+import SidePanelStateManager from '../services/SidePanelStateManager.js';
 import { logger } from '../shared/logger.js';
 
 import { initializeExtension, populateInitialPromptsAndSetDefaults } from './initialization.js';
@@ -139,16 +139,16 @@ function setupConnectionListener() {
       if (!isNaN(tabId)) {
         logger.background.info(`Side panel connected for tab ${tabId}`);
 
-        // Mark sidebar as visible upon connection
-        SidebarStateManager.setSidebarVisibilityForTab(tabId, true)
+        // Mark sidepanel as visible upon connection
+        SidePanelStateManager.setSidePanelVisibilityForTab(tabId, true)
           .then(() => {
             logger.background.info(
-              `Set sidebar visibility to true for tab ${tabId}`
+              `Set sidepanel visibility to true for tab ${tabId}`
             );
           })
           .catch((error) => {
             logger.background.error(
-              `Error setting sidebar visibility to true for tab ${tabId}:`,
+              `Error setting sidepanel visibility to true for tab ${tabId}:`,
               error
             );
           });
@@ -162,16 +162,16 @@ function setupConnectionListener() {
               `Port disconnect error for tab ${tabId}: ${chrome.runtime.lastError.message}`
             );
           }
-          // Mark sidebar as not visible upon disconnection
-          SidebarStateManager.setSidebarVisibilityForTab(tabId, false)
+          // Mark sidepanel as not visible upon disconnection
+          SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false)
             .then(() => {
               logger.background.info(
-                `Set sidebar visibility to false for tab ${tabId}`
+                `Set sidepanel visibility to false for tab ${tabId}`
               );
             })
             .catch((error) => {
               logger.background.error(
-                `Error setting sidebar visibility to false for tab ${tabId}:`,
+                `Error setting sidepanel visibility to false for tab ${tabId}:`,
                 error
               );
             });
diff --git a/src/background/initialization.js b/src/background/initialization.js
index e72d8ee..afa1698 100644
--- a/src/background/initialization.js
+++ b/src/background/initialization.js
@@ -51,21 +51,21 @@ async function initializeExtension() {
     await resetState();
     logger.background.info('Volatile state reset complete');
 
-    // Reset all tab sidebar visibility states to false
+    // Reset all tab sidepanel visibility states to false
     logger.background.info(
-      'Resetting all tab sidebar visibility states to false...'
+      'Resetting all tab sidepanel visibility states to false...'
     );
     const tabs = await chrome.tabs.query({});
-    const initialSidebarStates = {};
+    const initialSidepanelStates = {};
     for (const tab of tabs) {
       if (tab.id) {
-        initialSidebarStates[tab.id.toString()] = false;
+        initialSidepanelStates[tab.id.toString()] = false;
       }
     }
     await chrome.storage.local.set({
-      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: initialSidebarStates,
+      [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: initialSidepanelStates,
     });
-    logger.background.info('All tab sidebar visibility states reset.');
+    logger.background.info('All tab sidepanel visibility states reset.');
 
     return true;
   } catch (error) {
diff --git a/src/background/listeners/tab-listener.js b/src/background/listeners/tab-listener.js
index 64c4643..9575e4e 100644
--- a/src/background/listeners/tab-listener.js
+++ b/src/background/listeners/tab-listener.js
@@ -9,7 +9,7 @@ import {
   getPlatformTabInfo,
   updateScriptInjectionStatus,
 } from '../core/state-manager.js';
-import SidebarStateManager from '../../services/SidebarStateManager.js';
+import SidePanelStateManager from '../../services/SidePanelStateManager.js';
 import { logger } from '../../shared/logger.js';
 import { STORAGE_KEYS } from '../../shared/constants.js';
 import {
@@ -41,7 +41,7 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
     try {
       logger.background.info(`Tab ${tabId} finished loading (${tab.url}). Setting final side panel state.`);
       const isAllowed = isSidePanelAllowedPage(tab.url);
-      const isVisible = await SidebarStateManager.getSidebarVisibilityForTab(tabId);
+      const isVisible = await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
 
       if (isAllowed) {
         await chrome.sidePanel.setOptions({
@@ -49,13 +49,13 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
           path: `sidepanel.html?tabId=${tabId}`, // Always set path when allowed
           enabled: isVisible, // Enable based on stored visibility
         });
-        logger.background.info(`Side panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${isVisible}`);
+        logger.background.info(`Side Panel state set for completed tab ${tabId}: Allowed=${isAllowed}, Enabled=${isVisible}`);
       } else {
         await chrome.sidePanel.setOptions({
           tabId: tabId,
           enabled: false, // Force disable if not allowed
         });
-        logger.background.info(`Side panel explicitly disabled for completed tab ${tabId} (URL not allowed).`);
+        logger.background.info(`Side Panel explicitly disabled for completed tab ${tabId} (URL not allowed).`);
       }
     } catch (error) {
       logger.background.error(`Error setting side panel options during onUpdated for tab ${tabId}:`, error);
@@ -131,7 +131,7 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
     try {
       // Check if the side panel is *intended* to be visible for this tab
       const isVisible =
-        await SidebarStateManager.getSidebarVisibilityForTab(tabId);
+        await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
 
       if (isVisible) {
         logger.background.info(
@@ -139,7 +139,7 @@ async function handleTabUpdate(tabId, changeInfo, tab) {
         );
         const newContentType = determineContentType(tab.url);
 
-        // Send message to the runtime (listened to by SidebarApp)
+        // Send message to the runtime (listened to by SidePanelApp)
         chrome.runtime.sendMessage({
           action: 'pageNavigated',
           tabId: tabId,
@@ -193,7 +193,7 @@ async function handleTabActivation(activeInfo) {
 
     // Retrieve the intended visibility state for the activated tab
     const isVisible =
-      await SidebarStateManager.getSidebarVisibilityForTab(tabId);
+      await SidePanelStateManager.getSidePanelVisibilityForTab(tabId);
 
     // Conditionally set side panel options based on stored visibility
     if (isVisible) {
@@ -203,14 +203,14 @@ async function handleTabActivation(activeInfo) {
         path: `sidepanel.html?tabId=${tabId}`,
         enabled: true,
       });
-      logger.background.info(`Side panel enabled for activated tab ${tabId}`);
+      logger.background.info(`Side Panel enabled for activated tab ${tabId}`);
     } else {
       // Disable the panel if it shouldn't be visible
       await chrome.sidePanel.setOptions({
         tabId: tabId,
         enabled: false,
       });
-      logger.background.info(`Side panel disabled for activated tab ${tabId}`);
+      logger.background.info(`Side Panel disabled for activated tab ${tabId}`);
     }
   } catch (error) {
     logger.background.error(
@@ -230,13 +230,13 @@ async function handleTabCreation(newTab) {
   );
   try {
     // Store the initial visibility state (false) without enabling/disabling the panel itself
-    await SidebarStateManager.setSidebarVisibilityForTab(newTab.id, false);
+    await SidePanelStateManager.setSidePanelVisibilityForTab(newTab.id, false);
     logger.background.info(
-      `Initial sidebar state (visible: false) stored for new tab ${newTab.id}`
+      `Initial sidepanel state (visible: false) stored for new tab ${newTab.id}`
     );
   } catch (error) {
     logger.background.error(
-      `Error storing initial side panel state for new tab ${newTab.id}:`,
+      `Error storing initial sidepanel state for new tab ${newTab.id}:`,
       error
     );
   }
diff --git a/src/background/listeners/tab-state-listener.js b/src/background/listeners/tab-state-listener.js
index 149d60c..4101034 100644
--- a/src/background/listeners/tab-state-listener.js
+++ b/src/background/listeners/tab-state-listener.js
@@ -1,10 +1,10 @@
 // src/background/listeners/tab-state-listener.js
 
 import { STORAGE_KEYS } from '../../shared/constants.js';
-import SidebarStateManager from '../../services/SidebarStateManager.js';
+import SidePanelStateManager from '../../services/SidePanelStateManager.js';
 import { logger } from '../../shared/logger.js';
 
-// List of tab-specific storage keys to clear on manual refresh (excluding sidebar visibility)
+// List of tab-specific storage keys to clear on manual refresh (excluding sidepanel visibility)
 const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR = [
   STORAGE_KEYS.TAB_CHAT_HISTORIES,
   STORAGE_KEYS.TAB_TOKEN_STATISTICS,
@@ -13,17 +13,17 @@ const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR = [
   STORAGE_KEYS.TAB_MODEL_PREFERENCES,
   STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
   STORAGE_KEYS.TAB_FORMATTED_CONTENT,
-  // Note: TAB_SIDEBAR_STATES is intentionally excluded to preserve visibility state during manual refresh.
+  // Note: TAB_SIDEPANEL_STATES is intentionally excluded to preserve visibility state during manual refresh.
 ];
 
 // List of all storage keys that are tab-specific and need automatic cleanup (used for onRemoved/periodic cleanup)
-// This includes TAB_SIDEBAR_STATES which is handled by SidebarStateManager.cleanupTabStates
+// This includes TAB_SIDEPANEL_STATES which is handled by SidePanelStateManager.cleanupTabStates
 const ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP = [
   STORAGE_KEYS.TAB_FORMATTED_CONTENT,
   STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG,
   STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
   STORAGE_KEYS.TAB_MODEL_PREFERENCES,
-  STORAGE_KEYS.TAB_SIDEBAR_STATES, // Included for the loop, but handled separately
+  STORAGE_KEYS.TAB_SIDEPANEL_STATES, // Included for the loop, but handled separately
   STORAGE_KEYS.TAB_CHAT_HISTORIES,
   STORAGE_KEYS.TAB_TOKEN_STATISTICS,
   STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
@@ -76,7 +76,7 @@ export async function clearSingleTabData(tabId) {
 }
 
 /**
- * Handles the 'clearTabData' message request from the UI (e.g., sidebar refresh button).
+ * Handles the 'clearTabData' message request from the UI (e.g., sidepanel refresh button).
  * @param {object} message - The message object containing the tabId.
  * @param {chrome.runtime.MessageSender} sender - The sender of the message.
  * @param {function} sendResponse - Function to call to send the response.
@@ -216,8 +216,8 @@ export function setupTabStateListener() {
       try {
         // Clean up all general tab-specific storage keys
         for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
-          // Skip sidebar state in this loop; handled separately below.
-          if (storageKey !== STORAGE_KEYS.TAB_SIDEBAR_STATES) {
+          // Skip sidepanel state in this loop; handled separately below.
+          if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
             await cleanupTabStorage(storageKey, tabId, null); // Pass tabId for single removal, validTabIds=null
           }
         }
@@ -225,10 +225,10 @@ export function setupTabStateListener() {
           `General tab data cleanup completed for closed tab ${tabId}.`
         );
 
-        // Use SidebarStateManager to specifically clean its state for the removed tab
-        await SidebarStateManager.cleanupTabStates([tabId], null); // Pass removed tabId for targeted cleanup
+        // Use SidePanelStateManager to specifically clean its state for the removed tab
+        await SidePanelStateManager.cleanupTabStates([tabId], null); // Pass removed tabId for targeted cleanup
         logger.background.info(
-          `Sidebar state cleanup completed for closed tab ${tabId}.`
+          `Sidepanel state cleanup completed for closed tab ${tabId}.`
         );
       } catch (error) {
         logger.background.error(
@@ -275,8 +275,8 @@ export async function performStaleTabCleanup() {
 
     // Clean up all general tab-specific storage keys based on the valid IDs
     for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
-      // Skip sidebar state in this loop; handled separately below.
-      if (storageKey !== STORAGE_KEYS.TAB_SIDEBAR_STATES) {
+      // Skip sidepanel state in this loop; handled separately below.
+      if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
         await cleanupTabStorage(storageKey, null, validTabIds); // Pass validTabIds for periodic removal, tabId=null
       }
     }
@@ -284,9 +284,9 @@ export async function performStaleTabCleanup() {
       `General stale tab data cleanup processing completed.`
     );
 
-    // Use SidebarStateManager to clean its state based on valid IDs
-    await SidebarStateManager.cleanupTabStates(null, validTabIds); // Pass validTabIds for periodic cleanup
-    logger.background.info(`Sidebar stale state cleanup completed.`);
+    // Use SidePanelStateManager to clean its state based on valid IDs
+    await SidePanelStateManager.cleanupTabStates(null, validTabIds); // Pass validTabIds for periodic cleanup
+    logger.background.info(`Sidepanel stale state cleanup completed.`);
 
     logger.background.info('Stale tab data cleanup finished successfully.');
   } catch (error) {
diff --git a/src/background/services/sidebar-manager.js b/src/background/services/sidepanel-manager.js
similarity index 77%
rename from src/background/services/sidebar-manager.js
rename to src/background/services/sidepanel-manager.js
index f54da38..66cdc77 100644
--- a/src/background/services/sidebar-manager.js
+++ b/src/background/services/sidepanel-manager.js
@@ -1,6 +1,6 @@
-// src/background/services/sidebar-manager.js - Tab-specific native side panel management
+// src/background/services/sidepanel-manager.js - Tab-specific native side panel management
 
-import SidebarStateManager from '../../services/SidebarStateManager.js';
+import SidePanelStateManager from '../../services/SidePanelStateManager.js';
 import { logger } from '../../shared/logger.js';
 import { isSidePanelAllowedPage } from '../../shared/utils/content-utils.js';
 
@@ -15,7 +15,7 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
   let newState; // To store the final state (true for open, false for closed)
   try {
     logger.background.info(
-      'Handling native side panel toggle request (Refactored)'
+      'Handling native sidepanel toggle request (Refactored)'
     );
 
     // Determine the target tab ID
@@ -46,16 +46,16 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
     const isAllowed = isSidePanelAllowedPage(targetTab.url);
     if (!isAllowed) {
       logger.background.warn(
-        `Attempted to toggle sidebar on restricted page: ${targetTab.url}`
+        `Attempted to toggle sidepanel on restricted page: ${targetTab.url}`
       );
       // Force state to closed and disable panel
       newState = false;
-      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, false);
+      await SidePanelStateManager.setSidePanelVisibilityForTab(targetTabId, false);
       await chrome.sidePanel.setOptions({ tabId: targetTabId, enabled: false });
 
       sendResponse({
         success: false,
-        error: 'Sidebar cannot be opened on this page.',
+        error: 'Side Panel cannot be opened on this page.',
         tabId: targetTabId,
         visible: false,
         code: 'RESTRICTED_PAGE',
@@ -65,7 +65,7 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
 
     // Read the current *intended* state from storage
     const currentState =
-      await SidebarStateManager.getSidebarVisibilityForTab(targetTabId);
+      await SidePanelStateManager.getSidePanelVisibilityForTab(targetTabId);
     logger.background.info(
       `Current stored visibility for tab ${targetTabId}: ${currentState}`
     );
@@ -75,40 +75,40 @@ export async function toggleNativeSidePanel(message, sender, sendResponse) {
       // Current state is closed, so we intend to open (enable) it
       newState = true;
       logger.background.info(
-        `Action: Enable side panel for tab ${targetTabId}`
+        `Action: Enable sidepanel for tab ${targetTabId}`
       );
-      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, true);
+      await SidePanelStateManager.setSidepanelVisibilityForTab(targetTabId, true);
       await chrome.sidePanel.setOptions({
         tabId: targetTabId,
         path: `sidepanel.html?tabId=${targetTabId}`, // Pass tabId via URL
         enabled: true,
       });
       logger.background.info(
-        `Side panel enabled and path set for tab ${targetTabId}.`
+        `Sidepanel enabled and path set for tab ${targetTabId}.`
       );
     } else {
       // Current state is open, so we intend to close (disable) it
       newState = false;
       logger.background.info(
-        `Action: Disable side panel for tab ${targetTabId}`
+        `Action: Disable sidepanel for tab ${targetTabId}`
       );
-      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, false);
+      await SidePanelStateManager.setSidepanelVisibilityForTab(targetTabId, false);
       await chrome.sidePanel.setOptions({
         tabId: targetTabId,
         enabled: false,
       });
-      logger.background.info(`Side panel disabled for tab ${targetTabId}.`);
+      logger.background.info(`Sidepanel disabled for tab ${targetTabId}.`);
     }
 
     sendResponse({
       success: true,
       visible: newState, // Send back the new intended state
       tabId: targetTabId,
-      message: `Side panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`,
+      message: `Side Panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`,
     });
   } catch (error) {
     logger.background.error(
-      `Error handling native side panel toggle for tab ${targetTabId || 'unknown'}:`,
+      `Error handling native sidepanel toggle for tab ${targetTabId || 'unknown'}:`,
       error
     );
     // If an error occurred, the actual panel state might not match the intended state.
@@ -144,12 +144,12 @@ export function handleToggleNativeSidePanelAction(
 }
 
 /**
- * Get sidebar state for specific tab
+ * Get sidepanel state for specific tab
  * @param {Object} message - Message object
  * @param {Object} sender - Message sender
  * @param {Function} sendResponse - Response function
  */
-export async function getSidebarState(message, sender, sendResponse) {
+export async function getSidePanelState(message, sender, sendResponse) {
   try {
     // Get target tab ID (same logic as toggle)
     const tabId = message.tabId || (sender.tab && sender.tab.id);
@@ -172,7 +172,7 @@ export async function getSidebarState(message, sender, sendResponse) {
       targetTabId = tabId;
     }
 
-    const state = await SidebarStateManager.getSidebarState(targetTabId);
+    const state = await SidePanelStateManager.getSidePanelState(targetTabId);
 
     sendResponse({
       success: true,
@@ -181,7 +181,7 @@ export async function getSidebarState(message, sender, sendResponse) {
     });
   } catch (error) {
     logger.background.error(
-      'Error handling tab-specific sidebar state query:',
+      'Error handling tab-specific sidepanel state query:',
       error
     );
     sendResponse({ success: false, error: error.message });
@@ -198,20 +198,20 @@ export async function handleCloseCurrentSidePanelRequest(message, sender, sendRe
     return false; // Indicate synchronous response for this error path
   }
 
-  logger.background.info(`Closing side panel for tab ${tabId} by direct request from sidebar.`);
+  logger.background.info(`Closing sidepanel for tab ${tabId} by direct request from sidepanel.`);
 
   try {
-    await SidebarStateManager.setSidebarVisibilityForTab(tabId, false);
+    await SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false);
     await chrome.sidePanel.setOptions({ tabId, enabled: false });
-    logger.background.info(`Side panel for tab ${tabId} successfully closed and state updated.`);
+    logger.background.info(`Sidepanel for tab ${tabId} successfully closed and state updated.`);
     sendResponse({
       success: true,
       tabId,
       visible: false,
-      message: 'Side panel closed successfully.',
+      message: 'Side Panel closed successfully.'
     });
   } catch (error) {
-    logger.background.error(`Error closing side panel for tab ${tabId} via direct request:`, error);
+    logger.background.error(`Error closing sidepanel for tab ${tabId} via direct request:`, error);
     sendResponse({
       success: false,
       error: error.message || 'Failed to close side panel.',
diff --git a/src/background/services/theme-service.js b/src/background/services/theme-service.js
index 1be1970..07dd688 100644
--- a/src/background/services/theme-service.js
+++ b/src/background/services/theme-service.js
@@ -32,15 +32,15 @@ export async function handleThemeOperation(message, sendResponse) {
           [STORAGE_KEYS.THEME_PREFERENCE]: theme,
         });
 
-        // Notify only tabs with active sidebars about theme change
-        const sidebarStateResult = await chrome.storage.local.get(
-          STORAGE_KEYS.TAB_SIDEBAR_STATES
+        // Notify only tabs with active sidepanels about theme change
+        const sidepanelStateResult = await chrome.storage.local.get(
+          STORAGE_KEYS.TAB_SIDEPANEL_STATES
         );
-        const sidebarStates =
-          sidebarStateResult[STORAGE_KEYS.TAB_SIDEBAR_STATES] || {};
+        const sidepanelStates =
+          sidepanelStateResult[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
         const targetTabIds = [];
 
-        for (const [tabIdStr, isVisible] of Object.entries(sidebarStates)) {
+        for (const [tabIdStr, isVisible] of Object.entries(sidepanelStates)) {
           if (isVisible) {
             const tabId = parseInt(tabIdStr, 10);
             // Basic check if parsing was successful (tab IDs should always be numbers)
@@ -48,7 +48,7 @@ export async function handleThemeOperation(message, sendResponse) {
               targetTabIds.push(tabId);
             } else {
               logger.background.warn(
-                `Invalid tab ID found in sidebar states: ${tabIdStr}`
+                `Invalid tab ID found in sidepanel states: ${tabIdStr}`
               );
             }
           }
@@ -67,11 +67,11 @@ export async function handleThemeOperation(message, sendResponse) {
                 error.message.includes('Receiving end does not exist'))
             ) {
               logger.background.warn(
-                `Could not send theme update to active sidebar tab ${tabId}: Receiving end does not exist.`
+                `Could not send theme update to active sidepanel tab ${tabId}: Receiving end does not exist.`
               );
             } else {
               logger.background.error(
-                `Failed to send theme update to active sidebar tab ${tabId}:`,
+                `Failed to send theme update to active sidepanel tab ${tabId}:`,
                 error
               );
             }
diff --git a/src/components/icons/SidebarIcon.jsx b/src/components/icons/SidepanelIcon.jsx
similarity index 73%
rename from src/components/icons/SidebarIcon.jsx
rename to src/components/icons/SidepanelIcon.jsx
index 18b15da..b182468 100644
--- a/src/components/icons/SidebarIcon.jsx
+++ b/src/components/icons/SidepanelIcon.jsx
@@ -1,8 +1,8 @@
-// src/components/icons/SidebarIcon.jsx
+// src/components/icons/SidepanelIcon.jsx
 import React from 'react';
 import PropTypes from 'prop-types';
 
-export function SidebarIcon({ className = 'w-4 h-4', ...props }) {
+export function SidepanelIcon({ className = 'w-4 h-4', ...props }) {
   return (
     <svg
       viewBox='0 0 24 24'
@@ -19,8 +19,8 @@ export function SidebarIcon({ className = 'w-4 h-4', ...props }) {
   );
 }
 
-SidebarIcon.propTypes = {
+SidepanelIcon.propTypes = {
   className: PropTypes.string,
 };
 
-export default SidebarIcon;
+export default SidepanelIcon;
diff --git a/src/components/index.js b/src/components/index.js
index 189f837..490c548 100644
--- a/src/components/index.js
+++ b/src/components/index.js
@@ -41,7 +41,7 @@ export { SettingsIcon } from './icons/SettingsIcon';
 export { RefreshIcon } from './icons/RefreshIcon';
 export { ChevronDownIcon } from './icons/ChevronDownIcon';
 export { ChevronUpIcon } from './icons/ChevronUpIcon';
-export { SidebarIcon } from './icons/SidebarIcon';
+export { SidepanelIcon } from './icons/SidepanelIcon';
 export { InputTokenIcon } from './icons/InputTokenIcon';
 export { OutputTokenIcon } from './icons/OutputTokenIcon';
 export { ContextWindowIcon } from './icons/ContextWindowIcon';
@@ -54,4 +54,4 @@ export { KeyIcon } from './icons/KeyIcon';
 
 // Input components
 export { PromptDropdown } from './input/PromptDropdown';
-export { UnifiedInput } from './input/UnifiedInput';
\ No newline at end of file
+export { UnifiedInput } from './input/UnifiedInput';
diff --git a/src/components/input/UnifiedInput.jsx b/src/components/input/UnifiedInput.jsx
index 02299b6..c91e55f 100644
--- a/src/components/input/UnifiedInput.jsx
+++ b/src/components/input/UnifiedInput.jsx
@@ -3,7 +3,7 @@ import React, { useState, useEffect, useRef } from 'react';
 import PropTypes from 'prop-types';
 
 import { TextArea } from '../form/TextArea';
-import TokenCounter from '../../sidebar/components/TokenCounter';
+import TokenCounter from '../../sidepanel/components/TokenCounter';
 import { ArrowUpIcon } from '../icons/ArrowUpIcon';
 import { XIcon } from '../icons/XIcon';
 import { IconButton } from '../core/IconButton';
@@ -11,7 +11,7 @@ import { IconButton } from '../core/IconButton';
 import { PromptDropdown } from './PromptDropdown';
 
 /**
- * Unified input component for both popup and sidebar, supporting direct input
+ * Unified input component for both popup and sidepanel, supporting direct input
  * and custom prompt selection via dropdown. Uses rem units for height to adapt to font size.
  */
 export function UnifiedInput({
@@ -52,7 +52,7 @@ export function UnifiedInput({
   };
 
   const handleSubmit = () => {
-    if (layoutVariant === 'sidebar' && isProcessing && onCancel) {
+    if (layoutVariant === 'sidepanel' && isProcessing && onCancel) {
       onCancel();
     } else if (value.trim() && !disabled && !isProcessing) {
       onSubmit(value);
@@ -80,22 +80,22 @@ export function UnifiedInput({
     }
   };
 
-  // --- Sidebar Specific Button Logic ---
-  const isStreamingActive = layoutVariant === 'sidebar' && isProcessing;
-  const sidebarButtonStyle = isStreamingActive
+  // --- Sidepanel Specific Button Logic ---
+  const isStreamingActive = layoutVariant === 'sidepanel' && isProcessing;
+  const sidepanelButtonStyle = isStreamingActive
     ? 'bg-red-500 hover:bg-red-600 text-white' // Base styles
     : !value.trim() || disabled
       ? 'bg-gray-400 text-white' // Disabled state handled by IconButton, only need bg here
       : 'bg-orange-600 hover:bg-orange-700 text-white'; // Active state
-  const sidebarButtonLabel = isStreamingActive
+  const sidepanelButtonLabel = isStreamingActive
     ? 'Cancel generation'
     : 'Send message';
-  const sidebarButtonDisabled =
+  const sidepanelButtonDisabled =
     (!value.trim() && !isStreamingActive) ||
     disabled ||
     (isStreamingActive && isCanceling);
-  const sidebarIconSize = 'w-4 h-4';
-  const sidebarButtonSize = 'w-6 h-6 rounded';
+  const sidepanelIconSize = 'w-4 h-4';
+  const sidepanelButtonSize = 'w-6 h-6 rounded';
 
   // --- Popup Specific Button Logic ---
   const popupSendButtonDisabled = !value.trim() || disabled || isProcessing;
@@ -106,11 +106,11 @@ export function UnifiedInput({
   const popupButtonSize = 'w-5 h-5 rounded';
 
   // --- Define styles with rem units ---
-  const sidebarStyle = { minHeight: '5rem', maxHeight: '12rem' };
+  const sidepanelStyle = { minHeight: '5rem', maxHeight: '12rem' };
   const popupStyle = { minHeight: '4.5rem', maxHeight: '12rem' };
 
   // --- Render Logic ---
-  if (layoutVariant === 'sidebar') {
+  if (layoutVariant === 'sidepanel') {
     return (
       <div className={`flex flex-col ${className}`}>
         {/* Token Counter */}
@@ -143,7 +143,7 @@ export function UnifiedInput({
                 placeholder='Type a prompt or select one...'
                 disabled={disabled || isProcessing}
                 autoResize={true}
-                style={sidebarStyle}
+                style={sidepanelStyle}
                 className='flex-grow w-full py-3 pl-4 pr-12 bg-transparent resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200 scrollbar-gutter-stable text-sm'
               />
             </div>
@@ -153,12 +153,12 @@ export function UnifiedInput({
               {/* Send/Cancel Button */}
               <IconButton
                 icon={isStreamingActive ? XIcon : ArrowUpIcon}
-                iconClassName={`${sidebarIconSize} select-none`}
-                className={`${sidebarButtonStyle} ${sidebarButtonSize} ${isCanceling ? 'opacity-70' : ''}`}
+                iconClassName={`${sidepanelIconSize} select-none`}
+                className={`${sidepanelButtonStyle} ${sidepanelButtonSize} ${isCanceling ? 'opacity-70' : ''}`}
                 onClick={handleSubmit}
-                disabled={sidebarButtonDisabled}
-                ariaLabel={sidebarButtonLabel}
-                title={sidebarButtonLabel}
+                disabled={sidepanelButtonDisabled}
+                ariaLabel={sidepanelButtonLabel}
+                title={sidepanelButtonLabel}
               />
 
               {/* Prompt Selection Button */}
@@ -168,7 +168,7 @@ export function UnifiedInput({
                   type='button'
                   onClick={() => setIsDropdownOpen((prev) => !prev)}
                   disabled={disabled || isProcessing}
-                  className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 ${sidebarButtonSize} ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
+                  className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 ${sidepanelButtonSize} ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                   aria-label='Select prompt'
                   title='Select a custom prompt'
                 >
@@ -280,6 +280,6 @@ UnifiedInput.propTypes = {
   showTokenInfo: PropTypes.bool,
   tokenStats: PropTypes.object,
   contextStatus: PropTypes.object,
-  layoutVariant: PropTypes.oneOf(['popup', 'sidebar']).isRequired,
+  layoutVariant: PropTypes.oneOf(['popup', 'sidepanel']).isRequired,
   className: PropTypes.string,
 };
diff --git a/src/contexts/platform/SidePanelPlatformContext.jsx b/src/contexts/platform/SidePanelPlatformContext.jsx
new file mode 100644
index 0000000..7118925
--- /dev/null
+++ b/src/contexts/platform/SidePanelPlatformContext.jsx
@@ -0,0 +1,14 @@
+// src/contexts/platform/SidepanelPlatformContext.jsx
+import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';
+
+import { createTabAwarePlatformContext } from './TabAwarePlatformContext';
+
+const {
+  TabAwarePlatformProvider: SidePanelPlatformProvider,
+  useTabAwarePlatform: useSidePanelPlatform,
+} = createTabAwarePlatformContext({
+  interfaceType: INTERFACE_SOURCES.SIDEPANEL,
+  globalStorageKey: STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID,
+});
+
+export { SidePanelPlatformProvider, useSidePanelPlatform };
diff --git a/src/contexts/platform/SidebarPlatformContext.jsx b/src/contexts/platform/SidebarPlatformContext.jsx
deleted file mode 100644
index 4ec1641..0000000
--- a/src/contexts/platform/SidebarPlatformContext.jsx
+++ /dev/null
@@ -1,14 +0,0 @@
-// src/contexts/platform/SidebarPlatformContext.jsx
-import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';
-
-import { createTabAwarePlatformContext } from './TabAwarePlatformContext';
-
-const {
-  TabAwarePlatformProvider: SidebarPlatformProvider,
-  useTabAwarePlatform: useSidebarPlatform,
-} = createTabAwarePlatformContext({
-  interfaceType: INTERFACE_SOURCES.SIDEBAR,
-  globalStorageKey: STORAGE_KEYS.SIDEBAR_DEFAULT_PLATFORM_ID,
-});
-
-export { SidebarPlatformProvider, useSidebarPlatform };
diff --git a/src/contexts/platform/TabAwarePlatformContext.jsx b/src/contexts/platform/TabAwarePlatformContext.jsx
index b9294cd..d97c813 100644
--- a/src/contexts/platform/TabAwarePlatformContext.jsx
+++ b/src/contexts/platform/TabAwarePlatformContext.jsx
@@ -26,7 +26,7 @@ import {
  * now refactored to use internal hooks for logic separation and includes error handling.
  *
  * @param {Object} options - Configuration options
- * @param {string} options.interfaceType - Interface type (popup or sidebar)
+ * @param {string} options.interfaceType - Interface type (popup or sidepanel)
  * @param {string} options.globalStorageKey - Key for global preference storage
  * @param {Function} [options.onStatusUpdate=()=>{}] - Optional callback for status updates
  * @returns {Object} Context provider and hook
@@ -143,7 +143,7 @@ export function createTabAwarePlatformContext(options = {}) {
         url: config.url || null,
         iconUrl: config.iconUrl,
         hasCredentials:
-          interfaceType === INTERFACE_SOURCES.SIDEBAR
+          interfaceType === INTERFACE_SOURCES.SIDEPANEL
             ? credentialStatus[config.id] || false
             : true, // Popups don't check/need creds here
       }));
@@ -163,7 +163,7 @@ export function createTabAwarePlatformContext(options = {}) {
         setTabId,
       };
 
-      if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
+      if (interfaceType === INTERFACE_SOURCES.SIDEPANEL) {
         return {
           ...baseValue,
           models: modelError ? [] : models, // Return empty models if model loading failed
diff --git a/src/contexts/platform/hooks/useCredentialStatus.js b/src/contexts/platform/hooks/useCredentialStatus.js
index 5ee16a1..d48881c 100644
--- a/src/contexts/platform/hooks/useCredentialStatus.js
+++ b/src/contexts/platform/hooks/useCredentialStatus.js
@@ -6,10 +6,10 @@ import { logger } from '../../../shared/logger';
 import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../../shared/constants';
 
 /**
- * Hook to fetch and manage API credential status, specifically for the Sidebar.
+ * Hook to fetch and manage API credential status, specifically for the Sidepanel.
  * Listens for changes in credential storage.
  * @param {Array} platformConfigs - Array of platform configuration objects.
- * @param {string} interfaceType - The type of interface (e.g., 'sidebar', 'popup').
+ * @param {string} interfaceType - The type of interface (e.g., 'sidepanel', 'popup').
  * @returns {{credentialStatus: Object, hasAnyPlatformCredentials: boolean, isLoading: boolean, error: Error|null}}
  */
 export function useCredentialStatus(platformConfigs, interfaceType) {
@@ -17,12 +17,12 @@ export function useCredentialStatus(platformConfigs, interfaceType) {
   const [hasAnyPlatformCredentials, setHasAnyPlatformCredentials] =
     useState(false);
   const [isLoading, setIsLoading] = useState(
-    interfaceType === INTERFACE_SOURCES.SIDEBAR
-  ); // Only loading for sidebar initially
+    interfaceType === INTERFACE_SOURCES.SIDEPANEL
+  ); // Only loading for sidepanel initially
   const [error, setError] = useState(null);
 
   const fetchCredentials = useCallback(async () => {
-    if (interfaceType !== INTERFACE_SOURCES.SIDEBAR || !platformConfigs.length) {
+    if (interfaceType !== INTERFACE_SOURCES.SIDEPANEL || !platformConfigs.length) {
       setIsLoading(false);
       setCredentialStatus({});
       setHasAnyPlatformCredentials(false); // No creds needed/checked for popup
@@ -63,9 +63,9 @@ export function useCredentialStatus(platformConfigs, interfaceType) {
     fetchCredentials();
   }, [fetchCredentials]);
 
-  // Listener for credential changes in storage (only for sidebar)
+  // Listener for credential changes in storage (only for sidepanel)
   useEffect(() => {
-    if (interfaceType !== INTERFACE_SOURCES.SIDEBAR) {
+    if (interfaceType !== INTERFACE_SOURCES.SIDEPANEL) {
       return; // No listener needed for popup
     }
 
diff --git a/src/contexts/platform/hooks/useModelManagement.js b/src/contexts/platform/hooks/useModelManagement.js
index 1faec60..bbbc856 100644
--- a/src/contexts/platform/hooks/useModelManagement.js
+++ b/src/contexts/platform/hooks/useModelManagement.js
@@ -8,10 +8,10 @@ import { INTERFACE_SOURCES } from '../../../shared/constants';
 import ConfigService from '../../../services/ConfigService';
 
 /**
- * Hook to manage fetching available models and selecting the active model (Sidebar only).
+ * Hook to manage fetching available models and selecting the active model (Sidepanel only).
  * @param {string|null} selectedPlatformId - The ID of the currently selected platform.
  * @param {number|null} tabId - The current tab ID.
- * @param {string} interfaceType - The type of interface (e.g., 'sidebar', 'popup').
+ * @param {string} interfaceType - The type of interface (e.g., 'sidepanel', 'popup').
  * @returns {{models: Array, selectedModelId: string|null, selectModel: Function, isLoading: boolean, error: Error|null}}
  */
 export function useModelManagement(selectedPlatformId, tabId, interfaceType) {
@@ -23,7 +23,7 @@ export function useModelManagement(selectedPlatformId, tabId, interfaceType) {
   // Function to load models and determine initial selection
   const loadModelsAndSelect = useCallback(async () => {
     if (
-      interfaceType !== INTERFACE_SOURCES.SIDEBAR ||
+      interfaceType !== INTERFACE_SOURCES.SIDEPANEL ||
       !selectedPlatformId ||
       !tabId
     ) {
@@ -138,7 +138,7 @@ export function useModelManagement(selectedPlatformId, tabId, interfaceType) {
   const selectModel = useCallback(
     async (modelId) => {
       if (
-        interfaceType !== INTERFACE_SOURCES.SIDEBAR ||
+        interfaceType !== INTERFACE_SOURCES.SIDEPANEL ||
         !selectedPlatformId ||
         !tabId ||
         modelId === selectedModelId || // No change needed
diff --git a/src/contexts/platform/hooks/usePlatformSelection.js b/src/contexts/platform/hooks/usePlatformSelection.js
index 935717b..aa1d0e5 100644
--- a/src/contexts/platform/hooks/usePlatformSelection.js
+++ b/src/contexts/platform/hooks/usePlatformSelection.js
@@ -9,8 +9,8 @@ import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../../shared/constants';
  * @param {number|null} tabId - The current tab ID.
  * @param {string} globalStorageKey - The storage key for the global platform preference.
  * @param {Array} platformConfigs - Array of platform configuration objects.
- * @param {Object} credentialStatus - Object mapping platform IDs to credential availability (Sidebar only).
- * @param {string} interfaceType - The type of interface (e.g., 'sidebar', 'popup').
+ * @param {Object} credentialStatus - Object mapping platform IDs to credential availability (Sidepanel only).
+ * @param {string} interfaceType - The type of interface (e.g., 'sidepanel', 'popup').
  * @param {Function} onPlatformSelected - Callback function when platform selection changes.
  * @returns {{selectedPlatformId: string|null, selectPlatform: Function, isLoading: boolean}}
  */
@@ -37,9 +37,9 @@ export function usePlatformSelection(
       setIsLoading(true);
     const determineInitialPlatform = async () => {
       try {
-        // Construct available platforms based on credentials (for sidebar)
+        // Construct available platforms based on credentials (for sidepanel)
         const availablePlatforms = platformConfigs.filter((config) =>
-          interfaceType === INTERFACE_SOURCES.SIDEBAR
+          interfaceType === INTERFACE_SOURCES.SIDEPANEL
             ? credentialStatus[config.id] || false
             : true
         );
@@ -47,7 +47,7 @@ export function usePlatformSelection(
           availablePlatforms.map((p) => p.id)
         );
 
-        if (availablePlatforms.length === 0 && interfaceType === INTERFACE_SOURCES.SIDEBAR) {
+        if (availablePlatforms.length === 0 && interfaceType === INTERFACE_SOURCES.SIDEPANEL) {
            setSelectedPlatformId(null); // No platforms available
            setIsLoading(false);
            return;
@@ -66,9 +66,9 @@ export function usePlatformSelection(
 
         let platformToUse = null;
 
-        // Priority 1: Tab-specific preference (ONLY IF SIDEBAR)
+        // Priority 1: Tab-specific preference (ONLY IF SIDEPANEL)
         if (
-          interfaceType === INTERFACE_SOURCES.SIDEBAR &&
+          interfaceType === INTERFACE_SOURCES.SIDEPANEL &&
           lastUsedTabPlatform &&
           platformConfigs.some((p) => p.id === lastUsedTabPlatform) && // Check if it's a known platform
           availablePlatformIds.has(lastUsedTabPlatform)                // Check if available based on creds
@@ -129,8 +129,8 @@ export function usePlatformSelection(
       try {
         setSelectedPlatformId(platformId); // Update state immediately
 
-        // Update tab-specific preference ONLY IF SIDEBAR
-        if (interfaceType === INTERFACE_SOURCES.SIDEBAR) {
+        // Update tab-specific preference ONLY IF SIDEPANEL
+        if (interfaceType === INTERFACE_SOURCES.SIDEPANEL) {
           const tabPreferences = await chrome.storage.local.get(
             STORAGE_KEYS.TAB_PLATFORM_PREFERENCES
           );
diff --git a/src/contexts/platform/index.js b/src/contexts/platform/index.js
index 6777f3a..461b740 100644
--- a/src/contexts/platform/index.js
+++ b/src/contexts/platform/index.js
@@ -4,6 +4,6 @@ export {
   usePopupPlatform,
 } from './PopupPlatformContext';
 export {
-  SidebarPlatformProvider,
-  useSidebarPlatform,
-} from './SidebarPlatformContext';
+  SidePanelPlatformProvider,
+  useSidePanelPlatform,
+} from './SidePanelPlatformContext';
diff --git a/src/hooks/useContentProcessing.js b/src/hooks/useContentProcessing.js
index 595665f..4687a7a 100644
--- a/src/hooks/useContentProcessing.js
+++ b/src/hooks/useContentProcessing.js
@@ -9,8 +9,8 @@ import { robustSendMessage } from '../shared/utils/message-utils';
 
 /**
  * Hook for content extraction and processing
- * Supports both popup (web interface) and sidebar (API) paths
- * @param {string} source - Source interface (popup or sidebar)
+ * Supports both popup (web interface) and sidepanel (API) paths
+ * @param {string} source - Source interface (popup or sidepanel)
  * @returns {Object} - Methods and state for content extraction and processing
  */
 export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
@@ -125,7 +125,7 @@ export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
 
   /**
    * Process content directly with API (API path)
-   * Used by sidebar for in-extension chat
+   * Used by sidepanel for in-extension chat
    */
   const processContentViaApi = useCallback(
     async (options = {}) => {
@@ -244,7 +244,7 @@ export function useContentProcessing(source = INTERFACE_SOURCES.POPUP) {
   return {
     // Core processing methods
     processContent, // For popup/web interface path
-    processContentViaApi, // For sidebar/API path
+    processContentViaApi, // For sidepanel/API path
 
     // State management
     reset,
diff --git a/src/popup/Popup.jsx b/src/popup/Popup.jsx
index d2341a6..499c32d 100644
--- a/src/popup/Popup.jsx
+++ b/src/popup/Popup.jsx
@@ -7,7 +7,7 @@ import {
   AppHeader,
   StatusMessage,
   Tooltip,
-  SidebarIcon,
+  SidepanelIcon,
   Toggle,
   ContentTypeIcon,
 } from '../components';
@@ -17,7 +17,7 @@ import {
   STORAGE_KEYS, // Updated import
   INTERFACE_SOURCES,
   CONTENT_TYPE_LABELS,
-  DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG, // This remains for the default value
+  DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG, // This remains for the default value
 } from '../shared/constants';
 import { formatShortcutToStringDisplay } from '../shared/utils/shortcut-utils';
 import { useConfigurableShortcut } from '../hooks/useConfigurableShortcut';
@@ -155,7 +155,7 @@ export function Popup() {
     window.close();
   };
 
-  const toggleSidebar = useCallback(async () => {
+  const toggleSidepanel = useCallback(async () => {
     if (!currentTab?.id) {
       updateStatus('Error: No active tab found.');
       return;
@@ -181,11 +181,11 @@ export function Popup() {
     });
 
     if (!isAllowed) {
-      updateStatus('Sidebar cannot be opened on this type of page.', 'warning');
+      updateStatus('Side Panel cannot be opened on this type of page.', 'warning');
       return;
     }
 
-    updateStatus('Toggling sidebar...', true);
+    updateStatus('Toggling Side Panel...', true);
     try {
       const response = await robustSendMessage({
         action: 'toggleNativeSidePanelAction',
@@ -194,39 +194,39 @@ export function Popup() {
 
       if (response?.success) {
         updateStatus(
-          `Sidebar state updated to: ${response.visible ? 'Visible' : 'Hidden'}.`
+          `Side Panel state updated to: ${response.visible ? 'Visible' : 'Hidden'}.`
         );
 
         if (response.visible) {
           try {
             await chrome.sidePanel.open({ tabId: currentTab.id });
-            updateStatus('Sidebar opened successfully.');
+            updateStatus('Side Panel opened successfully.');
             window.close();
           } catch (openError) {
             logger.popup.error('Error opening side panel:', openError);
-            updateStatus(`Error opening sidebar: ${openError.message}`);
+            updateStatus(`Error opening Side Panel: ${openError.message}`);
           }
         } else {
-          updateStatus('Sidebar disabled.');
+          updateStatus('Side Panel disabled.');
           window.close();
         }
       } else {
         throw new Error(
-          response?.error || 'Failed to toggle sidebar state in background.'
+          response?.error || 'Failed to toggle sidepanel state in background.'
         );
       }
     } catch (error) {
-      logger.popup.error('Error in toggleSidebar:', error);
+      logger.popup.error('Error in toggleSidepanel:', error);
       updateStatus(`Error: ${error.message}`, false);
     }
   }, [currentTab, updateStatus]);
 
-  const { currentShortcutConfig: popupSidebarShortcut } = useConfigurableShortcut(
-    STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT,
-    DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG,
-    toggleSidebar,
+  const { currentShortcutConfig: popupSidepanelShortcut } = useConfigurableShortcut(
+    STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT,
+    DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG,
+    toggleSidepanel,
     logger.popup,
-    [toggleSidebar]
+    [toggleSidepanel]
   );
 
   const handleProcessWithText = async (text) => {
@@ -307,12 +307,12 @@ export function Popup() {
         }
       >
         <button
-          onClick={toggleSidebar}
+          onClick={toggleSidepanel}
           className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
-          title={popupSidebarShortcut && popupSidebarShortcut.key ? `Toggle Sidebar (${formatShortcutToStringDisplay(popupSidebarShortcut)})` : 'Toggle Sidebar'}
+          title={popupSidepanelShortcut && popupSidepanelShortcut.key ? `Toggle Side Panel (${formatShortcutToStringDisplay(popupSidepanelShortcut)})` : 'Toggle Side Panel'}
           disabled={!currentTab?.id}
         >
-          <SidebarIcon className='w-4 h-4 select-none' />
+          <SidepanelIcon className='w-4 h-4 select-none' />
         </button>
       </AppHeader>
 
@@ -426,4 +426,4 @@ export function Popup() {
       />
     </div>
   );
-}
\ No newline at end of file
+}
diff --git a/src/services/ModelParameterService.js b/src/services/ModelParameterService.js
index b85d00c..fbe7651 100644
--- a/src/services/ModelParameterService.js
+++ b/src/services/ModelParameterService.js
@@ -17,7 +17,7 @@ class ModelParameterService {
    * @param {string} platformId - Platform ID
    * @param {Object} options - Additional options
    * @param {number} [options.tabId] - Tab ID for tab-specific preferences
-   * @param {string} [options.source] - Interface source (popup or sidebar)
+   * @param {string} [options.source] - Interface source (popup or sidepanel)
    * @returns {Promise<string>} Resolved model ID
    */
   async resolveModel(platformId, options = {}) {
@@ -42,9 +42,9 @@ class ModelParameterService {
       }
     }
 
-    // 2. Try source-specific global preference (Sidebar only)
-    if (source === INTERFACE_SOURCES.SIDEBAR) {
-      const storageKey = STORAGE_KEYS.SIDEBAR_DEFAULT_MODEL_ID_BY_PLATFORM;
+    // 2. Try source-specific global preference (Sidepanel only)
+    if (source === INTERFACE_SOURCES.SIDEPANEL) {
+      const storageKey = STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM;
 
       try {
         const sourcePrefs = await chrome.storage.sync.get(storageKey);
@@ -165,22 +165,22 @@ class ModelParameterService {
 
   /**
    * Save global model preference for a source
-   * @param {string} source - Interface source (popup or sidebar)
+   * @param {string} source - Interface source (popup or sidepanel)
    * @param {string} platformId - Platform ID
    * @param {string} modelId - Model ID to save
    * @returns {Promise<boolean>} Success indicator
    */
   async saveSourceModelPreference(source, platformId, modelId) {
-    // Only save for sidebar, popup uses last selected via settings or default
-    if (source !== INTERFACE_SOURCES.SIDEBAR) {
+    // Only save for sidepanel, popup uses last selected via settings or default
+    if (source !== INTERFACE_SOURCES.SIDEPANEL) {
       logger.service.warn(
-        `Not saving model preference for non-sidebar source: ${source}`
+        `Not saving model preference for non-sidepanel source: ${source}`
       );
       return false;
     }
 
     try {
-      const storageKey = STORAGE_KEYS.SIDEBAR_DEFAULT_MODEL_ID_BY_PLATFORM;
+      const storageKey = STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM;
 
       // Get current preferences
       const prefs = await chrome.storage.sync.get(storageKey);
@@ -208,7 +208,7 @@ class ModelParameterService {
    * @param {string} modelId - The specific model ID to use.
    * @param {Object} options - Additional options
    * @param {number} [options.tabId] - Tab ID for context (e.g., token tracking)
-   * @param {string} [options.source] - Interface source (popup or sidebar)
+   * @param {string} [options.source] - Interface source (popup or sidepanel)
    * @param {Array} [options.conversationHistory] - Optional conversation history for context
    * @returns {Promise<Object>} Resolved parameters object for API calls
    */
diff --git a/src/services/SidebarStateManager.js b/src/services/SidePanelStateManager.js
similarity index 57%
rename from src/services/SidebarStateManager.js
rename to src/services/SidePanelStateManager.js
index 84a4c6e..d34483e 100644
--- a/src/services/SidebarStateManager.js
+++ b/src/services/SidePanelStateManager.js
@@ -2,19 +2,19 @@ import { logger } from '../shared/logger.js';
 import { STORAGE_KEYS } from '../shared/constants.js';
 
 /**
- * Service for managing tab-specific sidebar state
+ * Service for managing tab-specific sidepanel state
  */
-class SidebarStateManager {
+class SidePanelStateManager {
   /**
-   * Toggle sidebar visibility for a specific tab
+   * Toggle sidepanel visibility for a specific tab
    * @private
    * @param {number} tabId - Tab ID
    * @param {boolean|undefined} visible - Visibility state (undefined to toggle)
    */
   async _toggleForTab(tabId, visible) {
     // Get current tab states
-    const { [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {} } =
-      await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);
+    const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
+      await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
 
     // Convert tabId to string for use as object key
     const tabIdStr = tabId.toString();
@@ -33,41 +33,41 @@ class SidebarStateManager {
 
     // Save updated states
     await chrome.storage.local.set({
-      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: updatedStates,
+      [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: updatedStates,
     });
 
-    logger.service.info(`Tab ${tabId} sidebar visibility set to ${visible}`);
+    logger.service.info(`Tab ${tabId} sidepanel visibility set to ${visible}`);
   }
 
   /**
   /**
-   * Get sidebar state for a specific tab
+   * Get sidepanel state for a specific tab
    * @private
    * @param {number} tabId - Tab ID
-   * @returns {Promise<Object>} Tab-specific sidebar state
+   * @returns {Promise<Object>} Tab-specific sidepanel state
    */
   async _getStateForTab(tabId) {
     const result = await chrome.storage.local.get([
-      STORAGE_KEYS.TAB_SIDEBAR_STATES,
-      STORAGE_KEYS.SIDEBAR_DEFAULT_PLATFORM_ID,
-      STORAGE_KEYS.SIDEBAR_DEFAULT_MODEL_ID_BY_PLATFORM,
+      STORAGE_KEYS.TAB_SIDEPANEL_STATES,
+      STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID,
+      STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM,
     ]);
 
-    const tabStates = result[STORAGE_KEYS.TAB_SIDEBAR_STATES] || {};
+    const tabStates = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
 
     return {
       visible: tabStates[tabId.toString()] === true,
-      platform: result[STORAGE_KEYS.SIDEBAR_DEFAULT_PLATFORM_ID] || null,
-      model: result[STORAGE_KEYS.SIDEBAR_DEFAULT_MODEL_ID_BY_PLATFORM] || null,
+      platform: result[STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID] || null,
+      model: result[STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM] || null,
     };
   }
 
   /**
-   * Get current sidebar state for specific tab
+   * Get current sidepanel state for specific tab
    * @param {number} tabId - Tab ID
-   * @returns {Promise<Object>} Tab-specific sidebar state
+   * @returns {Promise<Object>} Tab-specific sidepanel state
    */
-  async getSidebarState(tabId) {
+  async getSidePanelState(tabId) {
     try {
       if (!tabId) {
         // Get active tab if no tab ID specified
@@ -78,7 +78,7 @@ class SidebarStateManager {
         const activeTab = tabs[0];
 
         if (!activeTab || !activeTab.id) {
-          logger.service.warn('No active tab found for getSidebarState');
+          logger.service.warn('No active tab found for getSidepanelState');
           return {
             visible: false,
             platform: null,
@@ -91,7 +91,7 @@ class SidebarStateManager {
 
       return this._getStateForTab(tabId);
     } catch (error) {
-      logger.service.error(`Error getting sidebar state for tab ${tabId}:`, error);
+      logger.service.error(`Error getting sidepanel state for tab ${tabId}:`, error);
       return {
         visible: false,
         platform: null,
@@ -101,34 +101,34 @@ class SidebarStateManager {
   }
 
   /**
-   * Get sidebar visibility for specific tab
+   * Get sidepanel visibility for specific tab
    * @param {number} tabId - Tab ID
    * @returns {Promise<boolean>} Visibility state
    */
-  async getSidebarVisibilityForTab(tabId) {
+  async getSidePanelVisibilityForTab(tabId) {
     try {
-      const { [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {} } =
-        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);
+      const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
+        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
 
       return tabStates[tabId.toString()] === true;
     } catch (error) {
-      logger.service.error(`Error getting sidebar visibility for tab ${tabId}:`, error);
+      logger.service.error(`Error getting sidepanel visibility for tab ${tabId}:`, error);
       return false;
     }
   }
 
   /**
-   * Set sidebar visibility for specific tab
+   * Set sidepanel visibility for specific tab
    * @param {number} tabId - Tab ID
    * @param {boolean} visible - Visibility state
    * @returns {Promise<boolean>} Success indicator
    */
-  async setSidebarVisibilityForTab(tabId, visible) {
+  async setSidePanelVisibilityForTab(tabId, visible) {
     try {
       await this._toggleForTab(tabId, visible);
       return true;
     } catch (error) {
-      logger.service.error(`Error setting sidebar visibility for tab ${tabId}:`, error);
+      logger.service.error(`Error setting sidepanel visibility for tab ${tabId}:`, error);
       return false;
     }
   }
@@ -145,8 +145,8 @@ class SidebarStateManager {
       const activeTabIds = new Set(tabs.map((tab) => tab.id.toString()));
 
       // Get current tab states
-      const { [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {} } =
-        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);
+      const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
+        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
 
       // Filter out closed tabs
       const updatedStates = {};
@@ -157,21 +157,21 @@ class SidebarStateManager {
           updatedStates[tabId] = state;
         } else {
           stateChanged = true;
-          logger.service.info(`Removing sidebar state for closed tab ${tabId}`);
+          logger.service.info(`Removing sidepanel state for closed tab ${tabId}`);
         }
       });
 
       // Save updated states if changed
       if (stateChanged) {
         await chrome.storage.local.set({
-          [STORAGE_KEYS.TAB_SIDEBAR_STATES]: updatedStates,
+          [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: updatedStates,
         });
-        logger.service.info('Tab sidebar states cleaned up');
+        logger.service.info('Tab sidepanel states cleaned up');
       }
     } catch (error) {
-      logger.service.error('Error cleaning up tab sidebar states:', error);
+      logger.service.error('Error cleaning up tab sidepanel states:', error);
     }
   }
 }
 
-export default new SidebarStateManager();
+export default new SidePanelStateManager();
diff --git a/src/settings/components/tabs/KeyboardShortcutsTab.jsx b/src/settings/components/tabs/KeyboardShortcutsTab.jsx
index 63e3899..5ad58f8 100644
--- a/src/settings/components/tabs/KeyboardShortcutsTab.jsx
+++ b/src/settings/components/tabs/KeyboardShortcutsTab.jsx
@@ -4,14 +4,14 @@ import React, { useState, useEffect, useCallback } from 'react';
 import { Button, useNotification, Modal } from '../../../components';
 import { SettingsCard } from '../ui/common/SettingsCard';
 import { ShortcutCaptureInput } from '../ui/ShortcutCaptureInput';
-import { STORAGE_KEYS, DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG } from '../../../shared/constants'; // Updated import
+import { STORAGE_KEYS, DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG } from '../../../shared/constants'; // Updated import
 import { logger } from '../../../shared/logger';
 import { formatShortcutToStringDisplay } from '../../../shared/utils/shortcut-utils';
 
 export function KeyboardShortcutsTab() {
   const [globalCommands, setGlobalCommands] = useState([]);
-  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
-  const [editableCustomShortcut, setEditableCustomShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
+  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG);
+  const [editableCustomShortcut, setEditableCustomShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG);
   const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
   const [isLoadingCommands, setIsLoadingCommands] = useState(true);
   const [isSavingShortcut, setIsSavingShortcut] = useState(false);
@@ -40,8 +40,8 @@ export function KeyboardShortcutsTab() {
 
     const loadCustomShortcut = async () => {
       try {
-        const result = await chrome.storage.sync.get([STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT]);
-        const loadedShortcut = result[STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT] || DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG;
+        const result = await chrome.storage.sync.get([STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT]);
+        const loadedShortcut = result[STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT] || DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG;
         setCustomPopupShortcut(loadedShortcut);
         setEditableCustomShortcut(loadedShortcut);
       } catch (error) {
@@ -99,9 +99,9 @@ export function KeyboardShortcutsTab() {
 
       showInfoNotification('Saving shortcut...'); 
 
-      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT]: editableCustomShortcut });
+      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT]: editableCustomShortcut });
       setCustomPopupShortcut(editableCustomShortcut);
-      showSuccessNotification('Sidebar toggle shortcut saved successfully!');
+      showSuccessNotification('Side Panel toggle shortcut saved successfully!');
       setIsShortcutModalOpen(false); 
     } catch (error) {
       logger.settings.error('Error saving custom popup shortcut:', error);
@@ -117,7 +117,7 @@ export function KeyboardShortcutsTab() {
         Keyboard Shortcuts
       </h2>
       <p className='section-description text-sm text-theme-secondary mb-6'>
-        Manage your extension&apos;s keyboard shortcuts. Global shortcuts are configured in Chrome&apos;s settings, while the sidebar toggle shortcut can be customized here.
+        Manage your extension&apos;s keyboard shortcuts. Global shortcuts are configured in Chrome&apos;s settings, while the sidepanel toggle shortcut can be customized here.
       </p>
       <div className="flex flex-col md:flex-row md:gap-6">
         {/* Left Column: Registered Extension Shortcuts */}
@@ -156,12 +156,12 @@ export function KeyboardShortcutsTab() {
           </SettingsCard>
         </div>
 
-        {/* Right Column: Sidebar Toggle Shortcut */}
+        {/* Right Column: Sidepanel Toggle Shortcut */}
         <div className="w-full md:w-1/2">
           <SettingsCard>
             <h3 className="text-base font-semibold text-theme-primary mb-2">Side Panel Toggle Shortcut</h3>
             <p className="text-sm text-theme-secondary mb-6">
-              This shortcut is used within the extension&apos;s popup to open/close the sidebar, and from within the sidebar itself to close it when focused.
+              This shortcut is used within the extension&apos;s popup to open/close the Side Panel, and from within the Side Panel itself to close it when focused.
             </p>
             
             <div 
@@ -182,7 +182,7 @@ export function KeyboardShortcutsTab() {
       <Modal 
         isOpen={isShortcutModalOpen} 
         onClose={handleCloseShortcutModal}
-        title="Update Sidebar Toggle Shortcut"
+        title="Update Side Panel Toggle Shortcut"
         widthClass="max-w-sm"
       >
         <div>
@@ -190,7 +190,7 @@ export function KeyboardShortcutsTab() {
             <ShortcutCaptureInput
               value={editableCustomShortcut}
               onChange={handleEditableShortcutChange}
-              defaultShortcut={DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG}
+              defaultShortcut={DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG}
             />
             <div className="flex-shrink-0 flex gap-2"> 
               <Button 
@@ -222,4 +222,4 @@ export function KeyboardShortcutsTab() {
   );
 }
 
-export default KeyboardShortcutsTab;
\ No newline at end of file
+export default KeyboardShortcutsTab;
diff --git a/src/shared/constants.js b/src/shared/constants.js
index 156aeb0..6bccad0 100644
--- a/src/shared/constants.js
+++ b/src/shared/constants.js
@@ -43,14 +43,14 @@ export const STORAGE_KEYS = {
   TEXT_SIZE_PREFERENCE: 'text_size_preference',
   /** @description ID of the default/last-selected AI platform for the Popup. Synced across devices. */
   POPUP_DEFAULT_PLATFORM_ID: 'popup_default_platform_id',
-  /** @description ID of the default/last-selected AI platform for the Sidebar (global). Synced across devices. */
-  SIDEBAR_DEFAULT_PLATFORM_ID: 'sidebar_default_platform_id',
-  /** @description Map of { platformId: modelId } for default/last-selected models in the Sidebar. Synced. */
-  SIDEBAR_DEFAULT_MODEL_ID_BY_PLATFORM: 'sidebar_default_model_id_by_platform',
-  /** @description User's preference for enabling "thinking mode" in the Sidebar, stored as { platformId: { modelId: boolean } }. Synced. */
-  SIDEBAR_THINKING_MODE_PREFERENCE: 'sidebar_thinking_mode_preference',
-  /** @description User's custom keyboard shortcut configuration for toggling the sidebar. Synced. */
-  CUSTOM_SIDEBAR_TOGGLE_SHORTCUT: 'custom_sidebar_toggle_shortcut_config',
+  /** @description ID of the default/last-selected AI platform for the Sidepanel (global). Synced across devices. */
+  SIDEPANEL_DEFAULT_PLATFORM_ID: 'sidepanel_default_platform_id',
+  /** @description Map of { platformId: modelId } for default/last-selected models in the Sidepanel. Synced. */
+  SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM: 'sidepanel_default_model_id_by_platform',
+  /** @description User's preference for enabling "thinking mode" in the Sidepanel, stored as { platformId: { modelId: boolean } }. Synced. */
+  SIDEPANEL_THINKING_MODE_PREFERENCE: 'sidepanel_thinking_mode_preference',
+  /** @description User's custom keyboard shortcut configuration for toggling the sidepanel. Synced. */
+  CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT: 'custom_sidepanel_toggle_shortcut_config',
 
   // --- Core Settings ---
   /** @description User-configured model parameters (temperature, maxTokens, etc.) for each platform/model. Local. */
@@ -82,7 +82,7 @@ export const STORAGE_KEYS = {
   /** @description The tab ID of the AI platform's website opened for Web UI injection. Local. */
   WEBUI_INJECTION_TARGET_TAB_ID: 'webui_injection_target_tab_id',
 
-  // --- API Processing State (Direct API calls from Sidebar) ---
+  // --- API Processing State (Direct API calls from Sidepanel) ---
   /** @description Current status of API processing (e.g., 'streaming', 'completed', 'error'). Local. */
   API_PROCESSING_STATUS: 'api_processing_status',
   /** @description The response object or content received from the API. Local. */
@@ -94,22 +94,22 @@ export const STORAGE_KEYS = {
   /** @description Unique identifier for an active API stream. Local. */
   API_STREAM_ID: 'api_stream_id',
 
-  // --- Tab-Specific Data (Primarily for Sidebar context persistence per tab) ---
-  /** @description Formatted page content specific to a tab, for Sidebar context. Local. */
+  // --- Tab-Specific Data (Primarily for Sidepanel context persistence per tab) ---
+  /** @description Formatted page content specific to a tab, for Sidepanel context. Local. */
   TAB_FORMATTED_CONTENT: 'tab_formatted_content',
-  /** @description Chat history for each tab's Sidebar instance. Local. */
+  /** @description Chat history for each tab's Sidepanel instance. Local. */
   TAB_CHAT_HISTORIES: 'tab_chat_histories',
-  /** @description System prompt configured for each tab's Sidebar instance. Local. */
+  /** @description System prompt configured for each tab's Sidepanel instance. Local. */
   TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
-  /** @description Token usage statistics for each tab's Sidebar instance. Local. */
+  /** @description Token usage statistics for each tab's Sidepanel instance. Local. */
   TAB_TOKEN_STATISTICS: 'tab_token_statistics',
-  /** @description Last selected/preferred platform for each tab's Sidebar instance. Local. */
+  /** @description Last selected/preferred platform for each tab's Sidepanel instance. Local. */
   TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
-  /** @description Last selected/preferred model (per platform) for each tab's Sidebar instance. Local. */
+  /** @description Last selected/preferred model (per platform) for each tab's Sidepanel instance. Local. */
   TAB_MODEL_PREFERENCES: 'tab_model_preferences',
-  /** @description Visibility state (true/false) of the Sidebar for each tab. Local. */
-  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
-  /** @description Flag indicating if page context has already been sent for a tab's Sidebar. Local. */
+  /** @description Visibility state (true/false) of the Sidepanel for each tab. Local. */
+  TAB_SIDEPANEL_STATES: 'tab_sidepanel_states',
+  /** @description Flag indicating if page context has already been sent for a tab's Sidepanel. Local. */
   TAB_CONTEXT_SENT_FLAG: 'tab_context_sent_flag',
 };
 
@@ -127,7 +127,7 @@ export const MAX_MESSAGES_PER_TAB_HISTORY = 200;
  */
 export const INTERFACE_SOURCES = {
   POPUP: 'popup',
-  SIDEBAR: 'sidebar',
+  SIDEPANEL: 'sidepanel',
 };
 
 /**
@@ -139,11 +139,11 @@ export const MESSAGE_ROLES = {
   SYSTEM: 'system',
 };
 
-// Default value for the custom sidebar toggle shortcut, not the storage key itself
-export const DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG = {
+// Default value for the custom sidepanel toggle shortcut, not the storage key itself
+export const DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG = {
   key: 's',
   altKey: true,
   ctrlKey: false,
   shiftKey: false,
   metaKey: false,
-};
\ No newline at end of file
+};
diff --git a/src/shared/logger.js b/src/shared/logger.js
index 2d2f3cb..824fae1 100644
--- a/src/shared/logger.js
+++ b/src/shared/logger.js
@@ -114,10 +114,10 @@ export const logger = {
     warn: (message, data) => log('settings', 'warn', message, data),
     error: (message, data) => log('settings', 'error', message, data),
   },
-  sidebar: {
-    debug: (message, data) => log('sidebar', 'debug', message, data),
-    info: (message, data) => log('sidebar', 'info', message, data),
-    warn: (message, data) => log('sidebar', 'warn', message, data),
-    error: (message, data) => log('sidebar', 'error', message, data),
+  sidepanel: {
+    debug: (message, data) => log('sidepanel', 'debug', message, data),
+    info: (message, data) => log('sidepanel', 'info', message, data),
+    warn: (message, data) => log('sidepanel', 'warn', message, data),
+    error: (message, data) => log('sidepanel', 'error', message, data),
   },
-};
\ No newline at end of file
+};
diff --git a/src/sidebar/index.jsx b/src/sidebar/index.jsx
deleted file mode 100644
index 78c6ac2..0000000
--- a/src/sidebar/index.jsx
+++ /dev/null
@@ -1,36 +0,0 @@
-import React from 'react';
-import { createRoot } from 'react-dom/client';
-
-import { UIProvider } from '../contexts/UIContext';
-import { SidebarPlatformProvider } from '../contexts/platform';
-import { ContentProvider } from '../contexts/ContentContext';
-
-import { SidebarChatProvider } from './contexts/SidebarChatContext';
-import SidebarApp from './SidebarApp';
-import '../styles/index.css';
-
-document.addEventListener('DOMContentLoaded', () => {
-  const container = document.getElementById('sidebar-root');
-  const root = createRoot(container);
-
-  const urlParams = new URLSearchParams(window.location.search);
-  const tabId = parseInt(urlParams.get('tabId'), 10);
-
-  if (isNaN(tabId)) {
-    console.error('[Sidebar Index] Invalid or missing tabId in URL.');
-    // Optionally render an error message in the sidebar
-    root.render(<div>Error: Missing Tab ID. Cannot initialize sidebar.</div>);
-  } else {
-    root.render(
-      <UIProvider>
-        <ContentProvider>
-          <SidebarPlatformProvider tabId={tabId}>
-            <SidebarChatProvider tabId={tabId}>
-              <SidebarApp tabId={tabId} /> {/* Ensure tabId is passed here */}
-            </SidebarChatProvider>
-          </SidebarPlatformProvider>
-        </ContentProvider>
-      </UIProvider>
-    );
-  }
-});
diff --git a/src/sidebar/SidebarApp.jsx b/src/sidepanel/SidePanelApp.jsx
similarity index 81%
rename from src/sidebar/SidebarApp.jsx
rename to src/sidepanel/SidePanelApp.jsx
index 0024a80..73b9253 100644
--- a/src/sidebar/SidebarApp.jsx
+++ b/src/sidepanel/SidePanelApp.jsx
@@ -1,4 +1,4 @@
-// src/sidebar/SidebarApp.jsx
+// src/sidepanel/SidePanelApp.jsx
 import React, {
   useEffect,
   useState,
@@ -7,11 +7,11 @@ import React, {
   useMemo,
 } from 'react';
 
-import { STORAGE_KEYS, DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG } from '../shared/constants'; // Updated import
+import { STORAGE_KEYS, DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG } from '../shared/constants';
 import { logger } from '../shared/logger';
 import { robustSendMessage } from '../shared/utils/message-utils';
 import { useConfigurableShortcut } from '../hooks/useConfigurableShortcut';
-import { useSidebarPlatform } from '../contexts/platform';
+import { useSidePanelPlatform } from '../contexts/platform';
 import { useContent } from '../contexts/ContentContext';
 import { useUI } from '../contexts/UIContext';
 import { AppHeader, ErrorIcon } from '../components';
@@ -20,11 +20,11 @@ import { debounce } from '../shared/utils/debounce';
 import Header from './components/Header';
 import ChatArea from './components/ChatArea';
 import { UserInput } from './components/UserInput';
-import { useSidebarChat } from './contexts/SidebarChatContext';
+import { useSidePanelChat } from './contexts/SidePanelChatContext';
 
-export default function SidebarApp() {
-  const { tabId, setTabId } = useSidebarPlatform();
-  const { resetCurrentTabData, isRefreshing } = useSidebarChat();
+export default function SidePanelApp() {
+  const { tabId, setTabId } = useSidePanelPlatform();
+  const { resetCurrentTabData, isRefreshing } = useSidePanelChat();
   const { updateContentContext } = useContent();
   const { textSize } = useUI();
   const [isReady, setIsReady] = useState(false);
@@ -34,31 +34,31 @@ export default function SidebarApp() {
   // Use the custom hook for shortcut handling
   const handleCloseShortcut = useCallback(async () => {
     if (!tabId) {
-      logger.sidebar.warn('SidebarApp: tabId prop is missing, cannot handle close shortcut.');
+      logger.sidepanel.warn('SidepanelApp: tabId prop is missing, cannot handle close shortcut.');
       return;
     }
-    logger.sidebar.info(`Shortcut pressed in sidebar (tabId: ${tabId}), attempting to close.`);
+    logger.sidepanel.info(`Shortcut pressed in sidepanel (tabId: ${tabId}), attempting to close.`);
     try {
       const response = await robustSendMessage({
         action: 'closeCurrentSidePanel',
         tabId: tabId,
       });
       if (response && response.success) {
-        logger.sidebar.info(`Side panel close command acknowledged for tab ${tabId}.`);
+        logger.sidepanel.info(`Side panel close command acknowledged for tab ${tabId}.`);
       } else {
-        logger.sidebar.error(`Failed to close side panel for tab ${tabId}:`, response?.error);
+        logger.sidepanel.error(`Failed to close side panel for tab ${tabId}:`, response?.error);
       }
     } catch (err) {
-      logger.sidebar.error(`Error sending closeCurrentSidePanel message for tab ${tabId}:`, err);
+      logger.sidepanel.error(`Error sending closeCurrentSidePanel message for tab ${tabId}:`, err);
     }
   }, [tabId]);
 
-  // currentShortcutConfig is returned but not directly used for display in SidebarApp
+  // currentShortcutConfig is returned but not directly used for display in SidePanelApp
   useConfigurableShortcut(
-    STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT,
-    DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG,
+    STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT,
+    DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG,
     handleCloseShortcut,
-    logger.sidebar,
+    logger.sidepanel,
     [handleCloseShortcut]
   );
 
@@ -71,8 +71,8 @@ export default function SidebarApp() {
 
   // --- Effect to determine Tab ID ---
   useEffect(() => {
-    logger.sidebar.info(
-      'SidebarApp mounted, attempting to determine tab context...'
+    logger.sidepanel.info(
+      'SidepanelApp mounted, attempting to determine tab context...'
     );
     let foundTabId = NaN;
 
@@ -82,15 +82,15 @@ export default function SidebarApp() {
       const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;
 
       if (tabIdFromUrl && !isNaN(parsedTabId)) {
-        logger.sidebar.info(`Found valid tabId ${parsedTabId} in URL.`);
+        logger.sidepanel.info(`Found valid tabId ${parsedTabId} in URL.`);
         foundTabId = parsedTabId;
       } else {
-        logger.sidebar.error(
-          'FATAL: Sidebar loaded without a valid tabId in URL. Cannot initialize.'
+        logger.sidepanel.error(
+          'FATAL: Sidepanel loaded without a valid tabId in URL. Cannot initialize.'
         );
       }
     } catch (error) {
-      logger.sidebar.error('Error parsing tabId from URL:', error);
+      logger.sidepanel.error('Error parsing tabId from URL:', error);
     }
 
     if (!isNaN(foundTabId)) {
@@ -99,8 +99,8 @@ export default function SidebarApp() {
 
     const timer = setTimeout(() => {
       setIsReady(!isNaN(foundTabId));
-      logger.sidebar.info(
-        `Sidebar initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`
+      logger.sidepanel.info(
+        `Sidepanel initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`
       );
     }, 50);
 
@@ -110,7 +110,7 @@ export default function SidebarApp() {
   // --- Effect for Page Navigation Listener ---
   useEffect(() => {
     if (!isReady || !tabId) {
-      logger.sidebar.info(
+      logger.sidepanel.info(
         `Skipping pageNavigated listener setup (isReady: ${isReady}, tabId: ${tabId})`
       );
       return;
@@ -118,17 +118,17 @@ export default function SidebarApp() {
 
     const messageListener = (message, _sender, _sendResponse) => {
       if (message.action === 'pageNavigated' && message.tabId === tabId) {
-        logger.sidebar.info(
+        logger.sidepanel.info(
           `Received pageNavigated event for current tab ${tabId}:`,
           message
         );
         try {
           updateContentContext(message.newUrl, message.newContentType);
-          logger.sidebar.info(
+          logger.sidepanel.info(
             `Content context updated for tab ${tabId} to URL: ${message.newUrl}, Type: ${message.newContentType}`
           );
         } catch (error) {
-          logger.sidebar.error(
+          logger.sidepanel.error(
             `Error handling pageNavigated event for tab ${tabId}:`,
             error
           );
@@ -138,11 +138,11 @@ export default function SidebarApp() {
 
     if (chrome && chrome.runtime && chrome.runtime.onMessage) {
       chrome.runtime.onMessage.addListener(messageListener);
-      logger.sidebar.info(
+      logger.sidepanel.info(
         `Added runtime message listener for pageNavigated events (tabId: ${tabId})`
       );
     } else {
-      logger.sidebar.warn(
+      logger.sidepanel.warn(
         'Chrome runtime API not available for message listener.'
       );
     }
@@ -150,7 +150,7 @@ export default function SidebarApp() {
     return () => {
       if (chrome && chrome.runtime && chrome.runtime.onMessage) {
         chrome.runtime.onMessage.removeListener(messageListener);
-        logger.sidebar.info(
+        logger.sidepanel.info(
           `Removed runtime message listener for pageNavigated events (tabId: ${tabId})`
         );
       }
@@ -160,7 +160,7 @@ export default function SidebarApp() {
   // --- Effect for Background Connection Port ---
   useEffect(() => {
     if (!isReady || !tabId) {
-      logger.sidebar.info(
+      logger.sidepanel.info(
         `Skipping background port connection (isReady: ${isReady}, tabId: ${tabId})`
       );
       return;
@@ -171,7 +171,7 @@ export default function SidebarApp() {
     }
 
     if (!(chrome && chrome.runtime && chrome.runtime.connect)) {
-      logger.sidebar.warn(
+      logger.sidepanel.warn(
         'Chrome runtime connect API not available.'
       );
       return;
@@ -182,9 +182,9 @@ export default function SidebarApp() {
       portRef.current = chrome.runtime.connect({ name: portName });
 
       portRef.current.onDisconnect.addListener(() => {
-        logger.sidebar.info(`Port disconnected for tab ${tabId}.`);
+        logger.sidepanel.info(`Port disconnected for tab ${tabId}.`);
         if (chrome.runtime.lastError) {
-          logger.sidebar.error(
+          logger.sidepanel.error(
             `Disconnect error for tab ${tabId}:`,
             chrome.runtime.lastError.message
           );
@@ -192,7 +192,7 @@ export default function SidebarApp() {
         portRef.current = null;
       });
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         `Error connecting to background for tab ${tabId}:`,
         error
       );
@@ -324,7 +324,7 @@ export default function SidebarApp() {
           <div className='text-center text-error'>
             <ErrorIcon className='h-10 w-10 mx-auto mb-2 text-error' />
             <p className='font-semibold'>Initialization Error</p>
-            <p className='text-sm'>Sidebar context could not be determined.</p>
+            <p className='text-sm'>Side Panel context could not be determined.</p>
             <p className='text-xs mt-2'>(Missing or invalid tabId)</p>
           </div>
         </div>
@@ -333,6 +333,6 @@ export default function SidebarApp() {
   );
 }
 
-SidebarApp.propTypes = {
+SidePanelApp.propTypes = {
   // tabId is managed internally
-};
\ No newline at end of file
+};
diff --git a/src/sidebar/components/ChatArea.jsx b/src/sidepanel/components/ChatArea.jsx
similarity index 98%
rename from src/sidebar/components/ChatArea.jsx
rename to src/sidepanel/components/ChatArea.jsx
index ae374f0..32ebad0 100644
--- a/src/sidebar/components/ChatArea.jsx
+++ b/src/sidepanel/components/ChatArea.jsx
@@ -1,4 +1,4 @@
-// src/sidebar/components/ChatArea.jsx ---
+// src/sidepanel/components/ChatArea.jsx ---
 import React, {
   useEffect,
   useRef,
@@ -10,8 +10,8 @@ import React, {
 import PropTypes from 'prop-types';
 
 import { debounce } from '../../shared/utils/debounce';
-import { useSidebarChat } from '../contexts/SidebarChatContext';
-import { useSidebarPlatform } from '../../contexts/platform';
+import { useSidePanelChat } from '../contexts/SidePanelChatContext';
+import { useSidePanelPlatform } from '../../contexts/platform';
 import { useUI } from '../../contexts/UIContext';
 import { Toggle } from '../../components/core/Toggle';
 import { Tooltip } from '../../components';
@@ -59,7 +59,7 @@ function ChatArea({
     setIsContentExtractionEnabled,
     modelConfigData,
     isThinkingModeEnabled,
-  } = useSidebarChat();
+  } = useSidePanelChat();
   const { contentType, currentTab } = useContent();
   const { textSize } = useUI();
   const messagesEndRef = useRef(null);
@@ -74,7 +74,7 @@ function ChatArea({
     selectedPlatformId,
     selectedModel,
     hasAnyPlatformCredentials,
-  } = useSidebarPlatform();
+  } = useSidePanelPlatform();
 
   // --- State ---
   const [isIncludeTooltipVisible, setIsIncludeTooltipVisible] = useState(false);
@@ -294,7 +294,7 @@ const checkScrollPosition = useCallback(() => {
               });
               setInitialScrollCompletedForResponse(true); // Mark as completed after scroll starts
             } else {
-              logger.sidebar.warn(
+              logger.sidepanel.warn(
                 `[ChatArea Scrolling Effect] Element or container not found inside *nested* rAF for ID ${userMessageElementId}.`
               );
               setInitialScrollCompletedForResponse(true); // Still mark as complete
@@ -302,7 +302,7 @@ const checkScrollPosition = useCallback(() => {
           }); // End nested rAF
         }); // End outer rAF
       } else {
-        logger.sidebar.warn(
+        logger.sidepanel.warn(
           `[ChatArea Scrolling Effect] User message element ID not found. Skipping initial scroll.`
         );
         setInitialScrollCompletedForResponse(true); // Still mark as complete
@@ -441,12 +441,12 @@ const checkScrollPosition = useCallback(() => {
           url: chrome.runtime.getURL('settings.html#api-settings'),
         });
       } else {
-        logger.sidebar.warn(
+        logger.sidepanel.warn(
           'Chrome APIs not available. Cannot open settings tab.'
         );
       }
     } catch (error) {
-      logger.sidebar.error('Could not open API options page:', error);
+      logger.sidepanel.error('Could not open API options page:', error);
     }
   };
 
@@ -646,7 +646,7 @@ const checkScrollPosition = useCallback(() => {
                   onMouseLeave={() => setIsIncludeTooltipVisible(false)}
                   onFocus={() => setIsIncludeTooltipVisible(true)}
                   onBlur={() => setIsIncludeTooltipVisible(false)}
-                  aria-describedby='include-context-tooltip-sidebar'
+                  aria-describedby='include-context-tooltip-sidepanel'
                 >
                   <ContentTypeIcon
                     contentType={contentType}
@@ -672,7 +672,7 @@ const checkScrollPosition = useCallback(() => {
                   targetRef={includeToggleRef}
                   message='Send content along with your prompt.'
                   position='top'
-                  id='include-context-tooltip-sidebar'
+                  id='include-context-tooltip-sidepanel'
                 />
               </>
             ) : (
@@ -743,13 +743,13 @@ const checkScrollPosition = useCallback(() => {
                     getComputedStyle(document.documentElement).fontSize
                   );
                   if (isNaN(rootFontSize) || rootFontSize <= 0) {
-                    logger.sidebar.warn(
+                    logger.sidepanel.warn(
                       `Could not parse root font size, falling back to 16px. Value was: ${getComputedStyle(document.documentElement).fontSize}`
                     );
                     rootFontSize = 16;
                   }
                 } catch (e) {
-                  logger.sidebar.error('Error getting root font size:', e);
+                  logger.sidepanel.error('Error getting root font size:', e);
                   rootFontSize = 16;
                 }
                 const minPixelHeight =
diff --git a/src/sidebar/components/Header.jsx b/src/sidepanel/components/Header.jsx
similarity index 97%
rename from src/sidebar/components/Header.jsx
rename to src/sidepanel/components/Header.jsx
index 92fb248..4c6fa57 100644
--- a/src/sidebar/components/Header.jsx
+++ b/src/sidepanel/components/Header.jsx
@@ -1,7 +1,7 @@
 import React, { useEffect, useState, useRef, createContext } from 'react';
 
-import { useSidebarPlatform } from '../../contexts/platform';
-import { useSidebarChat } from '../contexts/SidebarChatContext';
+import { useSidePanelPlatform } from '../../contexts/platform';
+import { useSidePanelChat } from '../contexts/SidePanelChatContext';
 import { PlatformIcon, ChevronDownIcon, Toggle, InfoIcon, Tooltip } from '../../components';
 
 import ModelSelector from './ModelSelector';
@@ -20,8 +20,8 @@ function Header() {
     selectPlatform,
     hasAnyPlatformCredentials,
     isLoading,
-  } = useSidebarPlatform();
-  const { modelConfigData, isThinkingModeEnabled, toggleThinkingMode } = useSidebarChat();
+  } = useSidePanelPlatform();
+  const { modelConfigData, isThinkingModeEnabled, toggleThinkingMode } = useSidePanelChat();
   const [tooltipVisible, setTooltipVisible] = useState(false);
   const infoIconRef = useRef(null);
   const [openDropdown, setOpenDropdown] = useState(null);
@@ -181,7 +181,7 @@ function Header() {
                     checked={isThinkingModeEnabled}
                     onChange={toggleThinkingMode}
                     aria-label="Toggle Thinking Mode"
-                    id="thinking-mode-toggle-sidebar"
+                    id="thinking-mode-toggle-sidepanel"
                     disabled={!hasAnyPlatformCredentials || isLoading}
                   />
                   {/* Info Icon and Tooltip */}
diff --git a/src/sidebar/components/ModelSelector.jsx b/src/sidepanel/components/ModelSelector.jsx
similarity index 98%
rename from src/sidebar/components/ModelSelector.jsx
rename to src/sidepanel/components/ModelSelector.jsx
index 5d7f29c..f339278 100644
--- a/src/sidebar/components/ModelSelector.jsx
+++ b/src/sidepanel/components/ModelSelector.jsx
@@ -1,7 +1,7 @@
 import React, { useEffect, useState, useContext, useRef } from 'react';
 import PropTypes from 'prop-types';
 
-import { useSidebarPlatform } from '../../contexts/platform';
+import { useSidePanelPlatform } from '../../contexts/platform';
 
 import { DropdownContext } from './Header';
 
@@ -22,7 +22,7 @@ const ChevronIcon = () => (
 );
 
 function ModelSelector({ className = '', selectedPlatformId = null }) {
-  const { models, selectedModel, selectModel, isLoading } = useSidebarPlatform();
+  const { models, selectedModel, selectModel, isLoading } = useSidePanelPlatform();
 
   const [formattedModels, setFormattedModels] = useState([]);
   const [displayModelId, setDisplayModelId] = useState(selectedModel);
diff --git a/src/sidebar/components/TokenCounter.jsx b/src/sidepanel/components/TokenCounter.jsx
similarity index 100%
rename from src/sidebar/components/TokenCounter.jsx
rename to src/sidepanel/components/TokenCounter.jsx
diff --git a/src/sidebar/components/UserInput.jsx b/src/sidepanel/components/UserInput.jsx
similarity index 80%
rename from src/sidebar/components/UserInput.jsx
rename to src/sidepanel/components/UserInput.jsx
index b2d9ba9..a2f2439 100644
--- a/src/sidebar/components/UserInput.jsx
+++ b/src/sidepanel/components/UserInput.jsx
@@ -1,9 +1,9 @@
-// src/sidebar/components/UserInput.jsx
+// src/sidepanel/components/UserInput.jsx
 import React from 'react';
 import PropTypes from 'prop-types';
 
-import { useSidebarPlatform } from '../../contexts/platform';
-import { useSidebarChat } from '../contexts/SidebarChatContext';
+import { useSidePanelPlatform } from '../../contexts/platform';
+import { useSidePanelChat } from '../contexts/SidePanelChatContext';
 import { UnifiedInput } from '../../components/input/UnifiedInput';
 import { useContent } from '../../contexts/ContentContext';
 
@@ -13,7 +13,7 @@ UserInput.propTypes = {
 
 export function UserInput({ className = '' }) {
   const { contentType } = useContent();
-  const { hasAnyPlatformCredentials } = useSidebarPlatform();
+  const { hasAnyPlatformCredentials } = useSidePanelPlatform();
   const {
     inputValue,
     setInputValue,
@@ -24,7 +24,7 @@ export function UserInput({ className = '' }) {
     isRefreshing,
     tokenStats,
     contextStatus,
-  } = useSidebarChat();
+  } = useSidePanelChat();
 
   const handleInputChange = (value) => {
     setInputValue(value);
@@ -52,7 +52,7 @@ export function UserInput({ className = '' }) {
       showTokenInfo={true}
       tokenStats={tokenStats}
       contextStatus={contextStatus}
-      layoutVariant='sidebar'
+      layoutVariant='sidepanel'
       className={className}
     />
   );
diff --git a/src/sidebar/components/messaging/AssistantMessageBubble.jsx b/src/sidepanel/components/messaging/AssistantMessageBubble.jsx
similarity index 98%
rename from src/sidebar/components/messaging/AssistantMessageBubble.jsx
rename to src/sidepanel/components/messaging/AssistantMessageBubble.jsx
index 12cf77e..47efd41 100644
--- a/src/sidebar/components/messaging/AssistantMessageBubble.jsx
+++ b/src/sidepanel/components/messaging/AssistantMessageBubble.jsx
@@ -7,7 +7,7 @@ import 'katex/dist/katex.min.css';
 
 import { logger } from '../../../shared/logger';
 import { IconButton, RerunIcon, PlatformIcon } from '../../../components';
-import { useSidebarChat } from '../../contexts/SidebarChatContext';
+import { useSidePanelChat } from '../../contexts/SidePanelChatContext';
 
 import ThinkingBlock from './ThinkingBlock';
 import EnhancedCodeBlock from './EnhancedCodeBlock';
@@ -41,7 +41,7 @@ export const AssistantMessageBubble = memo(
     ) => {
       // Hooks needed for Assistant functionality
       const { rerunAssistantMessage, isProcessing, isCanceling } =
-        useSidebarChat();
+        useSidePanelChat();
       const {
         copyState: assistantCopyState,
         handleCopy: handleAssistantCopy,
@@ -81,7 +81,7 @@ export const AssistantMessageBubble = memo(
             });
             processed = processedSegments.join('');
           } catch (error) {
-            logger.sidebar.error('Error during math preprocessing:', error);
+            logger.sidepanel.error('Error during math preprocessing:', error);
             processed = content || ''; // Fallback
           }
         } else {
diff --git a/src/sidebar/components/messaging/EnhancedCodeBlock.jsx b/src/sidepanel/components/messaging/EnhancedCodeBlock.jsx
similarity index 100%
rename from src/sidebar/components/messaging/EnhancedCodeBlock.jsx
rename to src/sidepanel/components/messaging/EnhancedCodeBlock.jsx
diff --git a/src/sidebar/components/messaging/MathFormulaBlock.jsx b/src/sidepanel/components/messaging/MathFormulaBlock.jsx
similarity index 97%
rename from src/sidebar/components/messaging/MathFormulaBlock.jsx
rename to src/sidepanel/components/messaging/MathFormulaBlock.jsx
index 458f3a5..cdf775d 100644
--- a/src/sidebar/components/messaging/MathFormulaBlock.jsx
+++ b/src/sidepanel/components/messaging/MathFormulaBlock.jsx
@@ -27,7 +27,7 @@ const MathFormulaBlock = memo(({ content, inline = false }) => {
         <BlockMath math={content} />
       );
     } catch (error) {
-      logger.sidebar.error('Math rendering error:', error);
+      logger.sidepanel.error('Math rendering error:', error);
       setRenderError(true);
       return null;
     }
diff --git a/src/sidebar/components/messaging/MessageBubble.jsx b/src/sidepanel/components/messaging/MessageBubble.jsx
similarity index 92%
rename from src/sidebar/components/messaging/MessageBubble.jsx
rename to src/sidepanel/components/messaging/MessageBubble.jsx
index ad55c6f..084e822 100644
--- a/src/sidebar/components/messaging/MessageBubble.jsx
+++ b/src/sidepanel/components/messaging/MessageBubble.jsx
@@ -1,4 +1,4 @@
-// src/sidebar/components/messaging/MessageBubble.jsx
+// src/sidepanel/components/messaging/MessageBubble.jsx
 import React, { memo, forwardRef } from 'react';
 import PropTypes from 'prop-types';
 
@@ -28,7 +28,7 @@ const MessageBubbleComponent = forwardRef(
       case MESSAGE_ROLES.ASSISTANT:
         return <AssistantMessageBubble ref={ref} role={role} {...props} />;
       default:
-        logger.sidebar.error(`Unknown message role: ${role}`);
+        logger.sidepanel.error(`Unknown message role: ${role}`);
         return null;
     }
   }
diff --git a/src/sidebar/components/messaging/SystemMessageBubble.jsx b/src/sidepanel/components/messaging/SystemMessageBubble.jsx
similarity index 100%
rename from src/sidebar/components/messaging/SystemMessageBubble.jsx
rename to src/sidepanel/components/messaging/SystemMessageBubble.jsx
diff --git a/src/sidebar/components/messaging/ThinkingBlock.jsx b/src/sidepanel/components/messaging/ThinkingBlock.jsx
similarity index 98%
rename from src/sidebar/components/messaging/ThinkingBlock.jsx
rename to src/sidepanel/components/messaging/ThinkingBlock.jsx
index 2945608..69cd1e7 100644
--- a/src/sidebar/components/messaging/ThinkingBlock.jsx
+++ b/src/sidepanel/components/messaging/ThinkingBlock.jsx
@@ -1,4 +1,4 @@
-// src/sidebar/components/messaging/ThinkingBlock.jsx
+// src/sidepanel/components/messaging/ThinkingBlock.jsx
 import React, { useState, useRef, useEffect } from 'react';
 import PropTypes from 'prop-types';
 import ReactMarkdown from 'react-markdown';
diff --git a/src/sidebar/components/messaging/UserMessageBubble.jsx b/src/sidepanel/components/messaging/UserMessageBubble.jsx
similarity index 98%
rename from src/sidebar/components/messaging/UserMessageBubble.jsx
rename to src/sidepanel/components/messaging/UserMessageBubble.jsx
index 7fab8dc..fa69aac 100644
--- a/src/sidebar/components/messaging/UserMessageBubble.jsx
+++ b/src/sidepanel/components/messaging/UserMessageBubble.jsx
@@ -8,7 +8,7 @@ import {
   EditIcon,
   RerunIcon,
 } from '../../../components';
-import { useSidebarChat } from '../../contexts/SidebarChatContext';
+import { useSidePanelChat } from '../../contexts/SidePanelChatContext';
 
 import { useCopyToClipboard } from './hooks/useCopyToClipboard';
 
@@ -34,7 +34,7 @@ export const UserMessageBubble = memo(
       const [isEditing, setIsEditing] = useState(false);
       const [editedContent, setEditedContent] = useState(content);
       const { rerunMessage, editAndRerunMessage, isProcessing, isCanceling } =
-        useSidebarChat();
+        useSidePanelChat();
       const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
         useCopyToClipboard(content);
 
diff --git a/src/sidebar/components/messaging/hooks/useCopyToClipboard.js b/src/sidepanel/components/messaging/hooks/useCopyToClipboard.js
similarity index 97%
rename from src/sidebar/components/messaging/hooks/useCopyToClipboard.js
rename to src/sidepanel/components/messaging/hooks/useCopyToClipboard.js
index 01f8759..3470729 100644
--- a/src/sidebar/components/messaging/hooks/useCopyToClipboard.js
+++ b/src/sidepanel/components/messaging/hooks/useCopyToClipboard.js
@@ -20,7 +20,7 @@ export const useCopyToClipboard = (textToCopy) => {
       setCopyState('copied');
       setDisplayIconState('copied');
     } catch (error) {
-      logger.sidebar.error('Failed to copy text:', error);
+      logger.sidepanel.error('Failed to copy text:', error);
       setCopyState('error');
       setDisplayIconState('error');
     }
diff --git a/src/sidebar/components/messaging/utils/clipboard.js b/src/sidepanel/components/messaging/utils/clipboard.js
similarity index 93%
rename from src/sidebar/components/messaging/utils/clipboard.js
rename to src/sidepanel/components/messaging/utils/clipboard.js
index 46eb323..c17a2e9 100644
--- a/src/sidebar/components/messaging/utils/clipboard.js
+++ b/src/sidepanel/components/messaging/utils/clipboard.js
@@ -13,7 +13,7 @@ export const copyToClipboard = async (text) => {
       await navigator.clipboard.writeText(text);
       return;
     } catch (error) {
-      logger.sidebar.warn(
+      logger.sidepanel.warn(
         'navigator.clipboard.writeText failed, falling back:',
         error
       );
@@ -37,7 +37,7 @@ export const copyToClipboard = async (text) => {
       throw new Error('Fallback copy method (execCommand) failed');
     }
   } catch (error) {
-    logger.sidebar.error('Fallback copy method failed:', error);
+    logger.sidepanel.error('Fallback copy method failed:', error);
     throw error;
   } finally {
     document.body.removeChild(textarea);
diff --git a/src/sidebar/components/messaging/utils/markdownUtils.js b/src/sidepanel/components/messaging/utils/markdownUtils.js
similarity index 99%
rename from src/sidebar/components/messaging/utils/markdownUtils.js
rename to src/sidepanel/components/messaging/utils/markdownUtils.js
index bbdb292..6880181 100644
--- a/src/sidebar/components/messaging/utils/markdownUtils.js
+++ b/src/sidepanel/components/messaging/utils/markdownUtils.js
@@ -61,7 +61,7 @@ export const renderWithPlaceholdersRecursive = (children, mathMap) => {
           );
         } else {
           // Use logger imported at the top
-          logger.sidebar.warn(
+          logger.sidepanel.warn(
             `Math placeholder ${placeholder} not found in map. Rendering fallback marker.`
           );
           const fallbackText =
diff --git a/src/sidebar/components/messaging/utils/parseTextAndMath.js b/src/sidepanel/components/messaging/utils/parseTextAndMath.js
similarity index 98%
rename from src/sidebar/components/messaging/utils/parseTextAndMath.js
rename to src/sidepanel/components/messaging/utils/parseTextAndMath.js
index 0bffcfa..1667c63 100644
--- a/src/sidebar/components/messaging/utils/parseTextAndMath.js
+++ b/src/sidepanel/components/messaging/utils/parseTextAndMath.js
@@ -1,4 +1,4 @@
-// src/sidebar/components/messaging/utils/parseTextAndMath.js
+// src/sidepanel/components/messaging/utils/parseTextAndMath.js
 
 /**
  * Parses text and math expressions from a given string.
diff --git a/src/sidebar/contexts/SidebarChatContext.jsx b/src/sidepanel/contexts/SidePanelChatContext.jsx
similarity index 88%
rename from src/sidebar/contexts/SidebarChatContext.jsx
rename to src/sidepanel/contexts/SidePanelChatContext.jsx
index 4f336db..cb71761 100644
--- a/src/sidebar/contexts/SidebarChatContext.jsx
+++ b/src/sidepanel/contexts/SidePanelChatContext.jsx
@@ -1,4 +1,4 @@
-// src/sidebar/contexts/SidebarChatContext.jsx
+// src/sidepanel/contexts/SidepanelChatContext.jsx
 
 import React, {
   createContext,
@@ -12,7 +12,7 @@ import React, {
 import PropTypes from 'prop-types';
 
 import { logger } from '../../shared/logger';
-import { useSidebarPlatform } from '../../contexts/platform';
+import { useSidePanelPlatform } from '../../contexts/platform';
 import { useContent } from '../../contexts/ContentContext';
 import { useTokenTracking } from '../hooks/useTokenTracking';
 import { useChatStreaming } from '../hooks/useChatStreaming';
@@ -25,13 +25,13 @@ import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
 import { isInjectablePage } from '../../shared/utils/content-utils';
 import { robustSendMessage } from '../../shared/utils/message-utils';
 
-const SidebarChatContext = createContext(null);
+const SidePanelChatContext = createContext(null);
 
-SidebarChatProvider.propTypes = {
+SidePanelChatProvider.propTypes = {
   children: PropTypes.node.isRequired,
 };
 
-export function SidebarChatProvider({ children }) {
+export function SidePanelChatProvider({ children }) {
   const {
     selectedPlatformId,
     selectedModel,
@@ -39,7 +39,7 @@ export function SidebarChatProvider({ children }) {
     tabId,
     platforms,
     getPlatformApiConfig,
-  } = useSidebarPlatform();
+  } = useSidePanelPlatform();
 
   const { contentType, currentTab } = useContent();
   const [messages, setMessages] = useState([]);
@@ -71,7 +71,7 @@ export function SidebarChatProvider({ children }) {
     isProcessing,
     error: processingError,
     reset: resetContentProcessing,
-  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);
+  } = useContentProcessing(INTERFACE_SOURCES.SIDEPANEL);
 
   // Get platform info
   const selectedPlatform = useMemo(
@@ -109,7 +109,7 @@ export function SidebarChatProvider({ children }) {
         });
 
         if (result && result.skippedContext === true) {
-          logger.sidebar.info(
+          logger.sidepanel.info(
             'Context extraction skipped by background:',
             result.reason
           );
@@ -141,7 +141,7 @@ export function SidebarChatProvider({ children }) {
 
         return true; // Indicate stream started successfully
       } catch (error) {
-        logger.sidebar.error('Error initiating API call:', error);
+        logger.sidepanel.error('Error initiating API call:', error);
         const isPortClosedError = error.isPortClosed;
         const systemErrorMessageContent = isPortClosedError
           ? '[System: The connection was interrupted. Please try sending your message again.]'
@@ -247,7 +247,7 @@ export function SidebarChatProvider({ children }) {
       try {
         const config = await getPlatformApiConfig(selectedPlatformId);
         if (!config || !config.models) {
-          logger.sidebar.warn(
+          logger.sidepanel.warn(
             'Platform API configuration missing required structure:',
             {
               platformId: selectedPlatformId,
@@ -261,7 +261,7 @@ export function SidebarChatProvider({ children }) {
         setModelConfigData(modelData);
         setStableModelConfigData(modelData);
       } catch (error) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'Failed to load or process platform API configuration:',
           error
         );
@@ -286,7 +286,7 @@ export function SidebarChatProvider({ children }) {
           setStableContextStatus(status);
         }
       } catch (error) {
-        logger.sidebar.error('Error calculating context status:', error);
+        logger.sidepanel.error('Error calculating context status:', error);
         // Don't update stableContextStatus on error - keep previous valid state
       }
     };
@@ -294,7 +294,7 @@ export function SidebarChatProvider({ children }) {
   }, [tabId, modelConfigData, tokenStats, calculateContextStatus]);
 
   // Stabilize tokenStats for UI consumers
-  const { isLoading: isPlatformLoading } = useSidebarPlatform(); // Get loading state outside effect
+  const { isLoading: isPlatformLoading } = useSidePanelPlatform(); // Get loading state outside effect
 
   useEffect(() => {
     if (!isPlatformLoading) {
@@ -316,7 +316,7 @@ export function SidebarChatProvider({ children }) {
         const hasExtracted = history.some((msg) => msg.isExtractedContent);
         setExtractedContentAdded(hasExtracted);
       } catch (error) {
-        logger.sidebar.error('Error loading tab chat history:', error);
+        logger.sidepanel.error('Error loading tab chat history:', error);
       }
     };
     loadChatHistory();
@@ -347,13 +347,13 @@ export function SidebarChatProvider({ children }) {
       // Check if the loaded model config allows toggling
       if (modelConfigData?.thinking?.toggleable === true) {
         try {
-          const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_THINKING_MODE_PREFERENCE);
-          const prefs = result[STORAGE_KEYS.SIDEBAR_THINKING_MODE_PREFERENCE] || {};
+          const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE);
+          const prefs = result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};
           const modePref = prefs[selectedPlatformId]?.[selectedModel];
           // Set state based on preference, default to false if undefined
           setIsThinkingModeEnabled(modePref === undefined ? false : modePref);
         } catch (err) {
-          logger.sidebar.error("Error loading thinking mode preference:", err);
+          logger.sidepanel.error("Error loading thinking mode preference:", err);
           setIsThinkingModeEnabled(false); // Default to false on error
         }
       } else {
@@ -465,7 +465,7 @@ export function SidebarChatProvider({ children }) {
       isThinkingModeEnabled: isThinkingModeEnabled,
       options: {
         tabId,
-        source: INTERFACE_SOURCES.SIDEBAR,
+        source: INTERFACE_SOURCES.SIDEPANEL,
         ...(rerunStatsRef.current && {
           preTruncationCost: rerunStatsRef.current.preTruncationCost,
           preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
@@ -490,13 +490,13 @@ export function SidebarChatProvider({ children }) {
 
   const clearFormattedContentForTab = useCallback(async () => {
     if (tabId === null || tabId === undefined) {
-      logger.sidebar.warn(
+      logger.sidepanel.warn(
         'clearFormattedContentForTab called without a valid tabId.'
       );
       return;
     }
     const tabIdKey = tabId.toString();
-    logger.sidebar.info(
+    logger.sidepanel.info(
       `Attempting to clear formatted content for tab: ${tabIdKey}`
     );
     try {
@@ -511,21 +511,21 @@ export function SidebarChatProvider({ children }) {
         await chrome.storage.local.set({
           [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: updatedFormattedContent,
         });
-        logger.sidebar.info(
+        logger.sidepanel.info(
           `Successfully cleared formatted content for tab: ${tabIdKey}`
         );
       } else {
-        logger.sidebar.info(
+        logger.sidepanel.info(
           `No formatted content found in storage for tab: ${tabIdKey}. No action needed.`
         );
       }
       // Only reset the flag, don't clear messages here
       setExtractedContentAdded(false);
-      logger.sidebar.info(
+      logger.sidepanel.info(
         `Reset extractedContentAdded flag for tab: ${tabIdKey}`
       );
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         `Error clearing formatted content for tab ${tabIdKey}:`,
         error
       );
@@ -534,12 +534,12 @@ export function SidebarChatProvider({ children }) {
 
   const resetCurrentTabData = useCallback(async () => {
     if (tabId === null || tabId === undefined) {
-      logger.sidebar.warn('resetCurrentTabData called without a valid tabId.');
+      logger.sidepanel.warn('resetCurrentTabData called without a valid tabId.');
       return;
     }
     // Prevent concurrent refreshes
     if (isRefreshing) {
-        logger.sidebar.warn('Refresh already in progress. Ignoring request.');
+        logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
         return;
     }
 
@@ -554,41 +554,41 @@ export function SidebarChatProvider({ children }) {
       try {
         // 1. Cancel any ongoing stream
         if (streamingMessageId && isProcessing && !isCanceling) {
-          logger.sidebar.info(
+          logger.sidepanel.info(
             'Refresh requested: Cancelling ongoing stream first...'
           );
           await cancelStream(); // Wait for cancellation attempt
-          logger.sidebar.info('Stream cancellation attempted.');
+          logger.sidepanel.info('Stream cancellation attempted.');
         }
 
         // 2. Notify background to clear its data (attempt and log, but don't block local reset on failure)
-        logger.sidebar.info(`Requesting background to clear data for tab ${tabId}`);
+        logger.sidepanel.info(`Requesting background to clear data for tab ${tabId}`);
         try {
             const clearResponse = await robustSendMessage({ action: 'clearTabData', tabId: tabId });
             if (clearResponse && clearResponse.success) {
-                logger.sidebar.info(`Background confirmed clearing data for tab ${tabId}`);
+                logger.sidepanel.info(`Background confirmed clearing data for tab ${tabId}`);
             } else {
-                logger.sidebar.error('Background failed to confirm tab data clear:', clearResponse?.error);
+                logger.sidepanel.error('Background failed to confirm tab data clear:', clearResponse?.error);
                 // Proceed with local reset even if background fails
             }
         } catch (sendError) {
-             logger.sidebar.error('Error sending clearTabData message to background:', sendError);
+             logger.sidepanel.error('Error sending clearTabData message to background:', sendError);
              // Proceed with local reset despite background communication failure
         }
 
         // 3. Reset local state *after* attempting background clear
-        logger.sidebar.info('Resetting local sidebar state...');
+        logger.sidepanel.info('Resetting local sidepanel state...');
         setMessages([]);
         setInputValue('');
         setStreamingMessageId(null);
         setExtractedContentAdded(false);
         setIsCanceling(false); // Ensure canceling state is reset if cancellation happened
         await clearTokenData(); // Clear associated tokens and reset local token state
-        logger.sidebar.info('Local sidebar state reset complete.');
+        logger.sidepanel.info('Local sidepanel state reset complete.');
 
       } catch (error) {
         // Catch errors primarily from stream cancellation or clearTokenData
-        logger.sidebar.error('Error during the refresh process (excluding background communication):', error);
+        logger.sidepanel.error('Error during the refresh process (excluding background communication):', error);
         // Attempt to reset local state even on these errors
         try {
             setMessages([]);
@@ -598,11 +598,11 @@ export function SidebarChatProvider({ children }) {
             setIsCanceling(false);
             await clearTokenData();
         } catch (resetError) {
-            logger.sidebar.error('Error during fallback state reset:', resetError);
+            logger.sidepanel.error('Error during fallback state reset:', resetError);
         }
       } finally {
         // 4. ALWAYS turn off refreshing state
-        logger.sidebar.info('Setting isRefreshing to false in finally block.');
+        logger.sidepanel.info('Setting isRefreshing to false in finally block.');
         setIsRefreshing(false);
       }
     }
@@ -631,8 +631,8 @@ export function SidebarChatProvider({ children }) {
     setIsThinkingModeEnabled(newState);
 
     try {
-      const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_THINKING_MODE_PREFERENCE);
-      const prefs = result[STORAGE_KEYS.SIDEBAR_THINKING_MODE_PREFERENCE] || {};
+      const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE);
+      const prefs = result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};
 
       // Ensure platform object exists
       if (!prefs[selectedPlatformId]) {
@@ -643,17 +643,17 @@ export function SidebarChatProvider({ children }) {
       prefs[selectedPlatformId][selectedModel] = newState;
 
       // Save back to storage
-      await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_THINKING_MODE_PREFERENCE]: prefs });
-      logger.sidebar.info(`Thinking mode preference saved for ${selectedPlatformId}/${selectedModel}: ${newState}`);
+      await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE]: prefs });
+      logger.sidepanel.info(`Thinking mode preference saved for ${selectedPlatformId}/${selectedModel}: ${newState}`);
     } catch (err) {
-      logger.sidebar.error("Error saving thinking mode preference:", err);
+      logger.sidepanel.error("Error saving thinking mode preference:", err);
     }
   }, [selectedPlatformId, selectedModel]); // Dependencies for the handler
 
   // --- End Utility Functions ---
 
   return (
-    <SidebarChatContext.Provider
+    <SidePanelChatContext.Provider
       value={{
         // State
         messages: visibleMessages,
@@ -686,8 +686,8 @@ export function SidebarChatProvider({ children }) {
       }}
     >
       {children}
-    </SidebarChatContext.Provider>
+    </SidePanelChatContext.Provider>
   );
 }
 
-export const useSidebarChat = () => useContext(SidebarChatContext);
+export const useSidePanelChat = () => useContext(SidePanelChatContext);
diff --git a/src/sidebar/hooks/useChatStreaming.js b/src/sidepanel/hooks/useChatStreaming.js
similarity index 96%
rename from src/sidebar/hooks/useChatStreaming.js
rename to src/sidepanel/hooks/useChatStreaming.js
index e987ce7..04a6465 100644
--- a/src/sidebar/hooks/useChatStreaming.js
+++ b/src/sidepanel/hooks/useChatStreaming.js
@@ -1,4 +1,4 @@
-// src/sidebar/hooks/useChatStreaming.js ---
+// src/sidepanel/hooks/useChatStreaming.js ---
 import { useEffect, useCallback, useRef } from 'react';
 
 import { logger } from '../../shared/logger';
@@ -147,6 +147,8 @@ export function useChatStreaming({
               isStreaming: false,
               model: model || selectedModel,
               platformIconUrl: msg.platformIconUrl,
+              platformId: msg.platformId,
+              timestamp: new Date().toISOString(),
               outputTokens: finalOutputTokensForMessage, // Use the correctly calculated token count
               role: isError ? MESSAGE_ROLES.SYSTEM : msg.role, // Keep error role handling
             };
@@ -191,7 +193,7 @@ export function useChatStreaming({
               }
             }
           } catch (extractError) {
-            logger.sidebar.error(
+            logger.sidepanel.error(
               'Error adding extracted content:',
               extractError
             );
@@ -219,7 +221,7 @@ export function useChatStreaming({
           );
         }
       } catch (error) {
-        logger.sidebar.error('Error handling stream completion:', error);
+        logger.sidepanel.error('Error handling stream completion:', error);
       } finally {
         // Clear the ref after saving history, regardless of success or error
         rerunStatsRef.current = null;
@@ -256,13 +258,13 @@ export function useChatStreaming({
         const { chunkData } = message;
 
         if (!chunkData) {
-          logger.sidebar.error('Invalid chunk data received:', message);
+          logger.sidepanel.error('Invalid chunk data received:', message);
           return;
         }
 
         if (chunkData.error) {
           const errorMessage = chunkData.error;
-          logger.sidebar.error('Stream error:', errorMessage);
+          logger.sidepanel.error('Stream error:', errorMessage);
           await handleStreamComplete(
             streamingMessageId,
             errorMessage,
@@ -287,7 +289,7 @@ export function useChatStreaming({
           let finalThinkingContent = batchedThinkingContentRef.current;
 
           if (chunkData.cancelled === true) {
-            logger.sidebar.info(
+            logger.sidepanel.info(
               `Stream ${message.streamId} received cancellation signal.`
             );
             await handleStreamComplete(
@@ -300,7 +302,7 @@ export function useChatStreaming({
             );
           } else if (chunkData.error) {
             const errorMessage = chunkData.error;
-            logger.sidebar.error(
+            logger.sidepanel.error(
               `Stream ${message.streamId} error:`,
               errorMessage
             );
@@ -394,7 +396,7 @@ export function useChatStreaming({
         streamId: streamId,
       });
     } catch (error) {
-      logger.sidebar.error('Error cancelling stream:', error);
+      logger.sidepanel.error('Error cancelling stream:', error);
       setStreamingMessageId(null);
     } finally {
       setIsCanceling(false);
@@ -406,7 +408,7 @@ export function useChatStreaming({
     isCanceling,
     setIsCanceling,
     rafIdRef,
-    batchedStreamingContentRef,
+    batchedThinkingContentRef,
     messages, // Need current messages for update
     extractedContentAdded, // Need flag state
     tabId,
diff --git a/src/sidebar/hooks/useMessageActions.js b/src/sidepanel/hooks/useMessageActions.js
similarity index 98%
rename from src/sidebar/hooks/useMessageActions.js
rename to src/sidepanel/hooks/useMessageActions.js
index a28cbcd..3bfafc5 100644
--- a/src/sidebar/hooks/useMessageActions.js
+++ b/src/sidepanel/hooks/useMessageActions.js
@@ -1,4 +1,4 @@
-// src/sidebar/hooks/useMessageActions.js
+// src/sidepanel/hooks/useMessageActions.js
 
 import { useCallback } from 'react';
 
@@ -77,7 +77,7 @@ const _initiateRerunSequence = async ({
   const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;
   // 'isContentExtractionEnabled' below refers to the parameter passed to _initiateRerunSequence (the toggle state)
   const effectiveContentExtractionEnabled = isPageInjectable ? isContentExtractionEnabled : false;
-  logger.sidebar.info(
+  logger.sidepanel.info(
     `[_initiateRerunSequence] Page injectable: ${isPageInjectable}, Toggle state: ${isContentExtractionEnabled}, Effective: ${effectiveContentExtractionEnabled}`
   );
 
@@ -92,7 +92,7 @@ const _initiateRerunSequence = async ({
     isThinkingModeEnabled: isThinkingModeEnabled,
     options: {
       tabId,
-      source: INTERFACE_SOURCES.SIDEBAR,
+      source: INTERFACE_SOURCES.SIDEPANEL,
       ...(rerunStatsRef.current && {
         preTruncationCost: rerunStatsRef.current.preTruncationCost,
         preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
@@ -164,7 +164,7 @@ export function useMessageActions({
         return;
       const index = messages.findIndex((msg) => msg.id === messageId);
       if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'Cannot rerun: Message not found or not a user message.'
         );
         return;
@@ -252,7 +252,7 @@ export function useMessageActions({
         return;
       const index = messages.findIndex((msg) => msg.id === messageId);
       if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'Cannot edit/rerun: Message not found or not a user message.'
         );
         return;
@@ -354,7 +354,7 @@ export function useMessageActions({
         userIndex < 0 ||
         messages[userIndex].role !== MESSAGE_ROLES.USER
       ) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'Cannot rerun assistant message: Invalid message structure or preceding user message not found.',
           { assistantIndex, userIndex }
         );
diff --git a/src/sidebar/hooks/useTokenTracking.js b/src/sidepanel/hooks/useTokenTracking.js
similarity index 92%
rename from src/sidebar/hooks/useTokenTracking.js
rename to src/sidepanel/hooks/useTokenTracking.js
index 1237c5d..b95ba31 100644
--- a/src/sidebar/hooks/useTokenTracking.js
+++ b/src/sidepanel/hooks/useTokenTracking.js
@@ -1,4 +1,4 @@
-// src/sidebar/hooks/useTokenTracking.js
+// src/sidepanel/hooks/useTokenTracking.js
 
 import { useState, useEffect, useCallback } from 'react';
 
@@ -34,7 +34,7 @@ export function useTokenTracking(tabId) {
         const stats = await TokenManagementService.getTokenStatistics(tabId);
         setTokenStats(stats);
       } catch (error) {
-        logger.sidebar.error('Error loading token data:', error);
+        logger.sidepanel.error('Error loading token data:', error);
       } finally {
         setIsLoading(false);
       }
@@ -97,7 +97,7 @@ export function useTokenTracking(tabId) {
           tokenStats,
           modelConfig
         );
-        
+
         // Ensure we always return a valid status object
         return status || {
           warningLevel: 'none',
@@ -107,7 +107,7 @@ export function useTokenTracking(tabId) {
           totalTokens: 0
         };
       } catch (error) {
-        logger.sidebar.error(`[DIAG_LOG: useTokenTracking:calculateContextStatus] Caught error before/during static call for tabId: ${tabId}`, error);
+        logger.sidepanel.error(`[DIAG_LOG: useTokenTracking:calculateContextStatus] Caught error before/during static call for tabId: ${tabId}`, error);
         return {
           warningLevel: 'none',
           percentage: 0,
@@ -137,7 +137,7 @@ export function useTokenTracking(tabId) {
 
       return success;
     } catch (error) {
-      logger.sidebar.error('Error clearing token data:', error);
+      logger.sidepanel.error('Error clearing token data:', error);
       return false;
     }
   }, [tabId]);
@@ -162,7 +162,7 @@ export function useTokenTracking(tabId) {
         setTokenStats(stats);
         return stats;
       } catch (error) {
-        logger.sidebar.error('Error calculating token statistics:', error);
+        logger.sidepanel.error('Error calculating token statistics:', error);
         return tokenStats;
       }
     },
diff --git a/src/sidepanel/index.jsx b/src/sidepanel/index.jsx
new file mode 100644
index 0000000..89cbdd7
--- /dev/null
+++ b/src/sidepanel/index.jsx
@@ -0,0 +1,36 @@
+import React from 'react';
+import { createRoot } from 'react-dom/client';
+
+import { UIProvider } from '../contexts/UIContext';
+import { SidePanelPlatformProvider } from '../contexts/platform';
+import { ContentProvider } from '../contexts/ContentContext';
+
+import { SidePanelChatProvider } from './contexts/SidePanelChatContext';
+import SidePanelApp from './SidePanelApp';
+import '../styles/index.css';
+
+document.addEventListener('DOMContentLoaded', () => {
+  const container = document.getElementById('sidepanel-root');
+  const root = createRoot(container);
+
+  const urlParams = new URLSearchParams(window.location.search);
+  const tabId = parseInt(urlParams.get('tabId'), 10);
+
+  if (isNaN(tabId)) {
+    console.error('[Sidepanel Index] Invalid or missing tabId in URL.');
+    // Optionally render an error message in the sidepanel
+    root.render(<div>Error: Missing Tab ID. Cannot initialize Side Panel.</div>);
+  } else {
+    root.render(
+      <UIProvider>
+        <ContentProvider>
+          <SidePanelPlatformProvider tabId={tabId}>
+            <SidePanelChatProvider tabId={tabId}>
+              <SidePanelApp tabId={tabId} />
+            </SidePanelChatProvider>
+          </SidePanelPlatformProvider>
+        </ContentProvider>
+      </UIProvider>
+    );
+  }
+});
diff --git a/src/sidebar/services/ChatHistoryService.js b/src/sidepanel/services/ChatHistoryService.js
similarity index 94%
rename from src/sidebar/services/ChatHistoryService.js
rename to src/sidepanel/services/ChatHistoryService.js
index d3ddff9..a7a5482 100644
--- a/src/sidebar/services/ChatHistoryService.js
+++ b/src/sidepanel/services/ChatHistoryService.js
@@ -1,4 +1,4 @@
-// src/sidebar/services/ChatHistoryService.js
+// src/sidepanel/services/ChatHistoryService.js
 
 import { logger } from '../../shared/logger';
 import { STORAGE_KEYS, MAX_MESSAGES_PER_TAB_HISTORY } from '../../shared/constants';
@@ -18,7 +18,7 @@ class ChatHistoryService {
   static async getHistory(tabId) {
     try {
       if (!tabId) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'TabChatHistory: No tabId provided for getHistory'
         );
         return [];
@@ -31,7 +31,7 @@ class ChatHistoryService {
       // Return history for this tab or empty array
       return allTabHistories[tabId] || [];
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TabChatHistory: Error getting chat history:',
         error
       );
@@ -47,7 +47,7 @@ class ChatHistoryService {
   static async getSystemPrompt(tabId) {
     try {
       if (!tabId) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'TabChatHistory: No tabId provided for getSystemPrompt'
         );
         return null;
@@ -62,7 +62,7 @@ class ChatHistoryService {
       // Return system prompts for this tab or null
       return allTabSystemPrompts[tabId] || null;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TabChatHistory: Error getting system prompt:',
         error
       );
@@ -84,7 +84,7 @@ class ChatHistoryService {
   static async saveHistory(tabId, messages, modelConfig = null, options = {}, isThinkingModeEnabled = false) {
     try {
       if (!tabId) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'TabChatHistory: No tabId provided for saveHistory'
         );
         return false;
@@ -114,7 +114,7 @@ class ChatHistoryService {
 
       return true;
     } catch (error) {
-      logger.sidebar.error('TabChatHistory: Error saving chat history:', error);
+      logger.sidepanel.error('TabChatHistory: Error saving chat history:', error);
       return false;
     }
   }
@@ -127,7 +127,7 @@ class ChatHistoryService {
   static async clearHistory(tabId) {
     try {
       if (!tabId) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'TabChatHistory: No tabId provided for clearHistory'
         );
         return false;
@@ -148,7 +148,7 @@ class ChatHistoryService {
 
       return true;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TabChatHistory: Error clearing chat history:',
         error
       );
@@ -164,7 +164,7 @@ class ChatHistoryService {
   static async cleanupClosedTabs(activeTabIds) {
     try {
       if (!activeTabIds || !Array.isArray(activeTabIds)) {
-        logger.sidebar.error(
+        logger.sidepanel.error(
           'TabChatHistory: Invalid activeTabIds for cleanup'
         );
         return false;
@@ -194,14 +194,14 @@ class ChatHistoryService {
       // Only update storage if something was removed
       if (needsCleanup) {
         await chrome.storage.local.set({ [STORAGE_KEYS.TAB_CHAT_HISTORIES]: allTabHistories });
-        logger.sidebar.info(
+        logger.sidepanel.info(
           'TabChatHistory: Cleaned up histories for closed tabs'
         );
       }
 
       return true;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TabChatHistory: Error cleaning up closed tabs:',
         error
       );
diff --git a/src/sidebar/services/TokenManagementService.js b/src/sidepanel/services/TokenManagementService.js
similarity index 97%
rename from src/sidebar/services/TokenManagementService.js
rename to src/sidepanel/services/TokenManagementService.js
index 9f29490..2fbae1c 100644
--- a/src/sidebar/services/TokenManagementService.js
+++ b/src/sidepanel/services/TokenManagementService.js
@@ -1,4 +1,4 @@
-// src/sidebar/services/TokenManagementService.js
+// src/sidepanel/services/TokenManagementService.js
 
 import { encode } from 'gpt-tokenizer';
 
@@ -34,7 +34,7 @@ class TokenManagementService {
       const mergedStats = { ...this._getEmptyStats(), ...tabStats };
       return mergedStats;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TokenManagementService: Error getting token statistics:',
         error
       );
@@ -70,7 +70,7 @@ class TokenManagementService {
       });
       return true;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error( // Corrected logger
         'TokenManagementService: Error updating token statistics:',
         error
       );
@@ -221,7 +221,7 @@ class TokenManagementService {
       });
       return true;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error(
         'TokenManagementService: Error clearing token statistics:',
         error
       );
@@ -237,6 +237,7 @@ class TokenManagementService {
    * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
    * @param {number} [options.initialAccumulatedCost=0] - Starting cost for calculation (used in reruns).
    * @param {number} [options.initialOutputTokens=0] - Starting output tokens for calculation (used in reruns).
+   * @param {boolean} [isThinkingModeEnabled=false] - Whether thinking mode is active
    * @returns {Promise<Object>} - Token statistics
    */
   static async calculateAndUpdateStatistics(
@@ -302,13 +303,13 @@ class TokenManagementService {
 
       // 6. Prepare Final Stats Object to Save (Explicitly matching _getEmptyStats structure)
       const finalStatsObject = {
-        // Cumulative stats (use initial output tokens + tokens from this specific call)
+        // Cumulative stats
         outputTokens: isLastError
           ? initialOutputTokens // On error, cumulative output doesn't increase
           : initialOutputTokens + (baseStats.outputTokensInLastApiCall || 0), // On success, add last assistant output
         accumulatedCost: newAccumulatedCost,
 
-        // Last API call stats (from base calculation - these reflect ONLY the last call)
+        // Last API call stats
         promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
         historyTokensSentInLastApiCall:
           baseStats.historyTokensSentInLastApiCall || 0,
@@ -325,7 +326,7 @@ class TokenManagementService {
       // 8. Return the final statistics object
       return finalStatsObject;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error( // Corrected logger
         'TokenManagementService: Error calculating token statistics:',
         error
       );
@@ -349,12 +350,12 @@ class TokenManagementService {
       const tokens = encode(text);
       return tokens.length;
     } catch (error) {
-      logger.sidebar.error(
+      logger.sidepanel.error( // Corrected logger
         'TokenManagementService: Error encoding text with gpt-tokenizer:',
         error
       );
       // Fallback on encoding error
-      logger.sidebar.warn(
+      logger.sidepanel.warn( // Corrected logger
         'TokenManagementService: gpt-tokenizer encoding failed, falling back to char count.'
       );
       return Math.ceil(text.length / 4); // Fallback method: 1 token per 4 chars
@@ -487,4 +488,4 @@ class TokenManagementService {
   }
 }
 
-export default TokenManagementService;
+export default TokenManagementService;
\ No newline at end of file
diff --git a/webpack.config.js b/webpack.config.js
index fef6dec..78e1d69 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -27,7 +27,7 @@ module.exports = {
     background: './src/background/index.js',
     popup: './src/popup/index.jsx',
     settings: './src/settings/index.jsx',
-    sidebar: './src/sidebar/index.jsx',
+    sidepanel: './src/sidepanel/index.jsx',
     'content-script': './src/content/index.js',
     'platform-content': './src/content/platform-content.js',
   },
@@ -51,7 +51,7 @@ module.exports = {
                 '@babel/preset-env',
                 {
                   targets: {
-                    chrome: '130',
+                    chrome: '130', // Or your target Chrome version
                   },
                   useBuiltIns: 'usage',
                   corejs: 3,
@@ -96,4 +96,4 @@ module.exports = {
   performance: {
     hints: isProduction ? 'warning' : false,
   },
-};
+};
\ No newline at end of file
