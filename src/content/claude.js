/**
 * Claude Content Script
 * 
 * Handles the integration with Claude AI.
 */

(() => {
  // Debug flag - set to false to disable debug logging
  const DEBUG = false;
  
  /**
   * Enhanced console logging with timestamps
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  function debugLog(message, data = null) {
      if (!DEBUG) return;
      
      const timestamp = new Date().toISOString();
      const prefix = `[Claude Debug ${timestamp}]`;
      
      if (data !== null) {
          console.log(prefix, message, data);
      } else {
          console.log(prefix, message);
      }
  }
  
  function debugError(message, error = null) {
      if (!DEBUG) return;
      
      const timestamp = new Date().toISOString();
      const prefix = `[Claude Debug ERROR ${timestamp}]`;
      
      if (error !== null) {
          console.error(prefix, message, error);
      } else {
          console.error(prefix, message);
      }
  }

  /**
   * Insert text into Claude's editor
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
      debugLog('Attempting to insert text into Claude editor');
      
      // Try multiple selectors for editor element
      const editorSelectors = [
          'p[data-placeholder="How can Claude help you today?"]',
          '[contenteditable="true"]',
          'div[role="textbox"]',
          '.ProseMirror',
          'div.editor'
      ];
      
      let editorElement = null;
      let foundSelector = null;
      
      for (const selector of editorSelectors) {
          const element = document.querySelector(selector);
          if (element) {
              editorElement = element;
              foundSelector = selector;
              break;
          }
      }
      
      if (!editorElement) {
          debugError('Claude editor element not found');
          return false;
      }
      
      try {
          // Clear existing content
          editorElement.innerHTML = '';
          
          // Split the text into lines and create paragraphs
          const lines = text.split('\n');
          
          lines.forEach((line, index) => {
              const p = document.createElement('p');
              p.textContent = line;
              editorElement.appendChild(p);
              
              // Add a line break between paragraphs
              if (index < lines.length - 1) {
                  editorElement.appendChild(document.createElement('br'));
              }
          });
    
          // Remove empty states
          const classesToRemove = ['is-empty', 'is-editor-empty'];
          classesToRemove.forEach(className => {
              if (editorElement.classList.contains(className)) {
                  editorElement.classList.remove(className);
              }
          });
    
          // Trigger input event
          const inputEvent = new Event('input', { bubbles: true });
          editorElement.dispatchEvent(inputEvent);
          
          // Try to focus the editor
          try {
              editorElement.focus();
          } catch (focusError) {
              debugError('Could not focus editor', focusError);
          }
    
          // Find and click the send button with multiple approaches
          setTimeout(() => {
              findAndClickSendButton();
          }, 1500); // Delay to ensure content is properly inserted
    
          return true;
      } catch (error) {
          debugError('Error inserting text', error);
          return false;
      }
  }
  
  /**
   * Find and click the send button with multiple approaches
   */
  function findAndClickSendButton() {
      // Try multiple possible button selectors
      const buttonSelectors = [
          'button[aria-label="Send message"]',
          'button[aria-label="Send Message"]',
          'button[type="submit"]',
          'button.send-button',
          'button svg path[d*="M208.49,120.49"]'
      ];
      
      let sendButton = null;
      
      // Try direct selectors first
      for (const selector of buttonSelectors) {
          try {
              const button = document.querySelector(selector);
              if (button) {
                  sendButton = button;
                  break;
              }
          } catch (error) {
              debugError(`Error with selector ${selector}`, error);
          }
      }
      
      // Try finding by path if direct selectors failed
      if (!sendButton) {
          try {
              const pathElement = document.querySelector('button svg path[d*="M208.49,120.49"]');
              if (pathElement) {
                  sendButton = pathElement.closest('button');
              }
          } catch (error) {
              debugError('Error finding button by SVG path', error);
          }
      }
      
      // Try finding by text content if all else failed
      if (!sendButton) {
          try {
              const buttons = Array.from(document.querySelectorAll('button'));
              const sendButtonByText = buttons.find(button => 
                  button.textContent.toLowerCase().includes('send') || 
                  button.innerHTML.toLowerCase().includes('send')
              );
              
              if (sendButtonByText) {
                  sendButton = sendButtonByText;
              }
          } catch (error) {
              debugError('Error finding button by text', error);
          }
      }
      
      if (!sendButton) {
          debugError('Send button not found');
          return false;
      }
      
      try {
          // Check if button is disabled
          if (sendButton.disabled) {
              sendButton.disabled = false;
          }
          
          // Create and dispatch multiple events for better compatibility
          const eventTypes = ['mousedown', 'mouseup', 'click'];
          
          eventTypes.forEach(eventType => {
              const event = new MouseEvent(eventType, {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  buttons: 1
              });
              
              sendButton.dispatchEvent(event);
          });
          
          // Try direct click as well
          sendButton.click();
          
          return true;
      } catch (error) {
          debugError('Error clicking send button', error);
          return false;
      }
  }

  /**
   * Format YouTube video data for prompt
   * @param {Object} data - YouTube video data
   * @returns {string} Formatted text
   */
  const formatYouTubeData = (data) => {
      if (data.error) {
          return `Error: ${data.message || 'Unknown error occurred while extracting YouTube data'}`;
      }
      
      const title = data.videoTitle || 'No title available';
      const channel = data.channelName || 'Unknown channel';
      const description = data.videoDescription || 'No description available';
      const transcript = data.transcript || 'No transcript available';
      
      // Format comments
      let commentsSection = '';
      if (data.comments && Array.isArray(data.comments)) {
          if (data.comments.length > 0) {
              commentsSection = `\nTop Comments:\n`;
              data.comments.forEach((comment, index) => {
                  commentsSection += `${index + 1}. ${comment.author}: "${comment.text}"${comment.likes ? ` (${comment.likes} likes)` : ''}\n`;
              });
          } else {
              commentsSection = `\nComments: No comments available or comments are disabled for this video.\n`;
          }
      } else if (typeof data.comments === 'string') {
          commentsSection = `\nComments: ${data.comments}\n`;
      }
      
      const formatted = `YouTube Video Information:
Title: ${title}
Channel: ${channel}

Description:
${description}

Transcript:
${transcript}
${commentsSection}`;

      return formatted;
  };

  /**
   * Format Reddit post data for prompt
   * @param {Object} data - Reddit post data
   * @returns {string} Formatted text
   */
  function formatRedditData(data) {
      if (data.error) {
          return `Error: ${data.message || 'Unknown error occurred while extracting Reddit data'}`;
      }
      
      const title = data.postTitle || 'No title available';
      const content = data.postContent || 'No content available';
      const author = data.postAuthor || 'Unknown author';
      const subreddit = data.subreddit || 'Unknown subreddit';
      const score = data.postScore || '0';
      
      // Format comments
      let commentsSection = '';
      if (data.comments) {
          if (Array.isArray(data.comments) && data.comments.length > 0) {
              commentsSection = `\nComments:\n`;
              data.comments.forEach((comment, index) => {
                  commentsSection += `${index + 1}. u/${comment.author} (${comment.popularity || '0'} points): "${comment.content}"\n\n`;
              });
          } else if (typeof data.comments === 'string') {
              commentsSection = `\nComments: ${data.comments}\n`;
          }
      }
      
      const formatted = `Reddit Post Information:
Subreddit: ${subreddit}
Title: ${title}
Author: ${author}
Score: ${score}

Content:
${content}

${commentsSection}`;

      return formatted;
  }

  /**
   * Format general web page data for prompt
   * @param {Object} data - General web page data
   * @returns {string} Formatted text
   */
  function formatGeneralData(data) {
      if (data.error) {
          return `Error: ${data.message || 'Unknown error occurred while extracting page data'}`;
      }
      
      const title = data.pageTitle || 'No title available';
      const url = data.pageUrl || 'Unknown URL';
      const author = data.pageAuthor ? `\nAuthor: ${data.pageAuthor}` : '';
      const description = data.pageDescription ? `\nDescription: ${data.pageDescription}` : '';
      const content = data.content || 'No content available';
      const selectionInfo = data.isSelection ? '\n(Text was manually selected by the user)' : '';
      
      const formatted = `Web Page Information:
Title: ${title}
URL: ${url}${author}${description}${selectionInfo}

Content:
${content}`;

      return formatted;
  }

  /**
   * Format extracted content based on content type
   * @param {Object} data - The extracted content data
   * @returns {string} Formatted text
   */
  function formatContent(data) {
      if (!data) {
          debugError('No content data available for formatting');
          return 'No content data available';
      }
      
      const contentType = data.contentType;
      
      let formatted = '';
      switch (contentType) {
          case 'youtube':
              formatted = formatYouTubeData(data);
              break;
          case 'reddit':
              formatted = formatRedditData(data);
              break;
          case 'general':
              formatted = formatGeneralData(data);
              break;
          default:
              formatted = `Unknown content type: ${contentType}`;
      }
      
      return formatted;
  }

  /**
   * Process data retrieved from storage
   * @param {Object} result - Data from storage
   */
  function processData(result) {
      try {
          if (!result.prePrompt) {
              throw new Error('Missing prompt data');
          }

          if (!result.extractedContent) {
              throw new Error('Missing content data');
          }
          
          const formattedContent = formatContent(result.extractedContent);
          const fullText = `${result.prePrompt}\n\n${formattedContent}`;
          
          const success = insertText(fullText);
          
          if (success && chrome && chrome.storage && chrome.storage.local) {
              // Clear the storage after successful insertion
              chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
          }
      } catch (error) {
          debugError('Error in processData', error);
          // Don't display error messages in the Claude interface
      }
  }

  /**
   * Handle the processing of extracted content and prompt with retry mechanism
   */
  const handleProcess = async () => {
      try {
          // Check if chrome.storage is available
          if (!chrome || !chrome.storage || !chrome.storage.local) {
              debugError('chrome.storage.local is not available');
              
              // Try to use a fallback method
              if (window.__claudeData) {
                  processData(window.__claudeData);
                  return;
              } else {
                  return; // Exit silently
              }
          }
          
          // Set up retry logic for getting the data
          let retries = 0;
          const maxRetries = 15;  // Maximum number of retries
          const retryInterval = 1000;  // 1 second between retries
          
          const tryGetData = () => {
              // Standard chrome.storage approach
              chrome.storage.local.get(['prePrompt', 'extractedContent'], result => {
                  // Check if we have both required pieces of data
                  if (!result.prePrompt || !result.extractedContent) {
                      if (retries < maxRetries) {
                          // If missing data and still have retries left, try again
                          retries++;
                          setTimeout(tryGetData, retryInterval);
                          return;
                      }
                  }
                  
                  // Process the data (this will handle missing data cases)
                  processData(result);
              });
          };
          
          // Start the retry loop
          tryGetData();
      } catch (error) {
          debugError('Error in handleProcess', error);
          // Don't display error messages in the Claude interface
      }
  };

  /**
   * Initialize the script with retry mechanism
   */
  function initialize() {
      if (!window.location.href.includes('claude.ai')) {
          return;
      }
      
      // Set up observer to detect when Claude's editor is ready
      const observerConfig = { childList: true, subtree: true };
      let retryCount = 0;
      const MAX_RETRIES = 15;
      const RETRY_INTERVAL = 1000;
      
      const observer = new MutationObserver(() => {
          // Check for editor element
          const editorSelectors = [
              'p[data-placeholder="How can Claude help you today?"]',
              '[contenteditable="true"]',
              'div[role="textbox"]',
              '.ProseMirror',
              'div.editor'
          ];
          
          let editorFound = false;
          
          for (const selector of editorSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                  editorFound = true;
                  break;
              }
          }
          
          if (editorFound) {
              observer.disconnect();
              handleProcess();
          } else {
              retryCount++;
              
              if (retryCount >= MAX_RETRIES) {
                  observer.disconnect();
                  // Try direct approach as last resort
                  handleProcess();
              }
          }
      });
      
      // Start the observer based on document state
      if (document.readyState === 'complete') {
          observer.observe(document.body, observerConfig);
          
          // Also try initial check
          setTimeout(() => {
              const editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]') || 
                                document.querySelector('[contenteditable="true"]');
              
              if (editorElement) {
                  observer.disconnect();
                  handleProcess();
              }
          }, 500);
      } else {
          window.addEventListener('load', () => {
              observer.observe(document.body, observerConfig);
              
              // Also set a timer for direct attempt if observer doesn't trigger
              setTimeout(() => {
                  if (retryCount === 0) {
                      handleProcess();
                  }
              }, MAX_RETRIES * RETRY_INTERVAL + 1000);
          });
      }
      
      // Backup: Also try after a fixed delay regardless of observer
      setTimeout(() => {
          if (retryCount === 0) {
              observer.disconnect();
              handleProcess();
          }
      }, 5000);
  }
  
  // Set a flag to indicate this script is loaded
  window.__claudeExtensionLoaded = true;
  
  // Initialize the script
  initialize();
})();