// import { useState, useCallback } from 'react';
// import { useSidebarPlatform } from '../contexts/SidebarPlatformContext';
// import { useSidebarContent } from '../contexts/SidebarContentContext';
// import { INTERFACE_SOURCES } from '../../shared/constants';

// export function useApiProcess() {
//   const { selectedPlatformId, selectedModel, hasCredentials } = useSidebarPlatform();
//   const { currentTab, contentType } = useSidebarContent();
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [error, setError] = useState(null);
  
//   // Unified process function that handles both streaming and non-streaming cases
//   const processContent = useCallback(async (prompt, extractedContent, streamHandler = null) => {
//     // Validation checks
//     if (!selectedPlatformId) {
//       setError('Missing platform selection');
//       return null;
//     }

//     if (!hasCredentials) {
//       setError(`No API credentials found for ${selectedPlatformId}. Please add them in settings.`);
//       return null;
//     }

//     if (!extractedContent) {
//       setError('No content extracted to analyze');
//       return null;
//     }

//     setIsProcessing(true);
//     setError(null);

//     try {
//       // Common request parameters for both streaming and non-streaming
//       const request = {
//         action: 'sidebarApiProcess',
//         platformId: selectedPlatformId,
//         prompt,
//         extractedContent,
//         url: extractedContent.pageUrl || (currentTab ? currentTab.url : window.location.href),
//         tabId: currentTab ? currentTab.id : null,
//         source: INTERFACE_SOURCES.SIDEBAR,
//         contentType: contentType,
//         // Flag to signal streaming is requested - backend already handles this
//         streaming: !!streamHandler
//       };

//       // Send request to background script
//       const response = await chrome.runtime.sendMessage(request);

//       if (!response || !response.success) {
//         throw new Error(response?.error || 'Processing failed');
//       }

//       // Set up stream listener if streaming is requested
//       if (streamHandler && response.streamId) {
//         // Register listener for stream chunks
//         const messageListener = (message) => {
//           if (message.action === 'streamChunk' && message.streamId === response.streamId) {
//             // Process chunk - streamHandler should handle done status
//             streamHandler(message.chunkData);
            
//             // Remove listener when streaming is complete
//             if (message.chunkData.done) {
//               chrome.runtime.onMessage.removeListener(messageListener);
//               setIsProcessing(false);
//             }
//           }
//         };

//         // Add listener
//         chrome.runtime.onMessage.addListener(messageListener);
        
//         // Return stream ID for reference
//         return response.streamId;
//       } else {
//         // Regular non-streaming response
//         setIsProcessing(false);
//         return response.response;
//       }
//     } catch (error) {
//       console.error('API processing error:', error);
//       setError(error.message || 'Unknown error during API processing');
//       setIsProcessing(false);
//       return null;
//     }
//   }, [selectedPlatformId, hasCredentials, currentTab, contentType]);

//   // Maintain backwards compatibility with separate methods
//   const processContentStreaming = useCallback(async (prompt, extractedContent, onChunk) => {
//     return processContent(prompt, extractedContent, onChunk);
//   }, [processContent]);

//   return {
//     processContent,
//     processContentStreaming,
//     isProcessing,
//     error,
//     hasCredentials
//   };
// }
