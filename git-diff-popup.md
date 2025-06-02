diff --git a/src/popup/Popup.jsx b/src/popup/Popup.jsx
index 74decdc..ad450bc 100644
--- a/src/popup/Popup.jsx
+++ b/src/popup/Popup.jsx
@@ -407,6 +407,8 @@ export function Popup() {
                           }
                           aria-describedby='include-context-tooltip'
                           className='inline-flex items-center'
+                          tabIndex={0}
+                          role="button"
                         >
                           <Toggle
                             id='include-context-toggle'
