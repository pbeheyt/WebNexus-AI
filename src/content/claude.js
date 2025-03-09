/**
 * Claude Content Script
 * 
 * Handles the integration with Claude AI.
 * Inserts extracted content and prompt into Claude's interface.
 */

(() => {
  /**
   * Insert text into Claude's editor
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
    let editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]');
    
    if (!editorElement) {
      editorElement = document.querySelector('[contenteditable="true"]');
    }
    
    if (!editorElement) {
      console.error('Claude editor element not found');
      return false;
    }

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
    editorElement.classList.remove('is-empty', 'is-editor-empty');

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true });
    editorElement.dispatchEvent(inputEvent);

    // Find and click the send button
    setTimeout(() => {
      // Try multiple possible button selectors
      const sendButton = 
        document.querySelector('button[aria-label="Send message"]') ||
        document.querySelector('button[aria-label="Send Message"]') ||
        document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');

      if (sendButton) {
        console.log('Send button found, clicking...');
        
        // Ensure the button is enabled
        sendButton.disabled = false;
        
        // Create and dispatch multiple events for better compatibility
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
          const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
          });
          sendButton.dispatchEvent(event);
        });
      } else {
        console.error('Send button not found');
      }
    }, 1000); // Delay to ensure content is properly inserted

    return true;
  }

  /**
   * Format YouTube video data for prompt
   * @param {Object} data - YouTube video data
   * @returns {string} Formatted text
   */
  function formatYouTubeData(data) {
    if (data.error) {
      return `Error: ${data.message || 'Unknown error occurred while extracting YouTube data'}`;
    }
    
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';
    
    // Format comments
    let commentsSection = '';
    if (data.comments) {
      if (Array.isArray(data.comments) && data.comments.length > 0) {
        commentsSection = `\nTop Comments:\n`;
        data.comments.forEach((comment, index) => {
          commentsSection += `${index + 1}. ${comment.author}: "${comment.text}"${comment.likes ? ` (${comment.likes} likes)` : ''}\n`;
        });
      } else if (typeof data.comments === 'string') {
        commentsSection = `\nComments: ${data.comments}\n`;
      }
    }
    
    return `YouTube Video Information:
Title: ${title}
Channel: ${channel}

Description:
${description}

Transcript:
${transcript}
${commentsSection}`;
  }

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
    
    return `Reddit Post Information:
Subreddit: ${subreddit}
Title: ${title}
Author: ${author}
Score: ${score}

Content:
${content}

${commentsSection}`;
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
    
    return `Web Page Information:
Title: ${title}
URL: ${url}${author}${description}${selectionInfo}

Content:
${content}`;
  }

  /**
   * Format extracted content based on content type
   * @param {Object} data - The extracted content data
   * @returns {string} Formatted text
   */
  function formatContent(data) {
    if (!data) {
      return 'No content data available';
    }
    
    const contentType = data.contentType;
    
    switch (contentType) {
      case 'youtube':
        return formatYouTubeData(data);
      case 'reddit':
        return formatRedditData(data);
      case 'general':
        return formatGeneralData(data);
      default:
        return `Unknown content type: ${contentType}\n\nRaw data: ${JSON.stringify(data, null, 2)}`;
    }
  }

  /**
   * Handle the processing of extracted content and prompt
   */
  async function handleProcess() {
    try {
      // Get stored data
      const { extractedContent, prePrompt } = await chrome.storage.local.get([
        'extractedContent', 
        'prePrompt'
      ]);
      
      console.log('Retrieved data for Claude:', { 
        hasExtractedContent: !!extractedContent,
        hasPrePrompt: !!prePrompt
      });

      if (!prePrompt) {
        throw new Error('No prompt found in storage');
      }

      if (!extractedContent) {
        throw new Error('No extracted content found in storage');
      }

      // Format content based on type
      const formattedContent = formatContent(extractedContent);
      
      // Combine prompt and content
      const fullText = `${prePrompt}\n\n${formattedContent}`;
      
      console.log('Attempting to insert text into Claude...');

      // Insert into Claude
      const success = insertText(fullText);
      
      if (success) {
        console.log('Message successfully inserted into Claude');
        
        // Clear the storage after successful insertion
        await chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
      } else {
        throw new Error('Failed to insert message into Claude');
      }
    } catch (error) {
      console.error('Error in handling Claude process:', error);
      
      // Try to insert error message into Claude
      insertText(`An error occurred while preparing content for Claude: ${error.message}\n\nPlease try again.`);
    }
  }

  /**
   * Initialize the content script
   */
  function initialize() {
    console.log('Claude content script initializing...');
    
    // Set up observer to detect when Claude's editor is ready
    const observerConfig = { childList: true, subtree: true };
    let retryCount = 0;
    const MAX_RETRIES = 10;
    
    const observer = new MutationObserver(() => {
      const editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]') || 
                          document.querySelector('[contenteditable="true"]');
      
      if (editorElement) {
        console.log('Claude editor element found');
        observer.disconnect();
        handleProcess();
      } else {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          observer.disconnect();
          console.error('Failed to find Claude editor element after maximum retries');
        }
      }
    });
    
    // Start the observer
    if (document.readyState === 'complete') {
      observer.observe(document.body, observerConfig);
    } else {
      window.addEventListener('load', () => {
        observer.observe(document.body, observerConfig);
      });
    }
  }

  // Log when content script loads
  console.log('Claude content script loaded');

  // Initialize the content script
  initialize();
})();
