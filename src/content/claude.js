/**
 * Claude Content Script
 * 
 * Simplified implementation based on working YouTube extension approach.
 * Handles the integration with Claude AI by inserting extracted content 
 * into Claude's editor and clicking the send button.
 */

(() => {
  // Simple debug logging function
  const debug = (message, data = null) => {
    if (data !== null) {
      console.log(`[Claude Integration] ${message}`, data);
    } else {
      console.log(`[Claude Integration] ${message}`);
    }
  };

  /**
   * Insert text into Claude's editor and submit
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
    debug('Attempting to insert text into Claude editor');
    
    // Try to find Claude's editor with simpler selectors first
    let editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]');
    
    if (!editorElement) {
      editorElement = document.querySelector('[contenteditable="true"]');
    }
    
    if (!editorElement) {
      debug('Claude editor element not found');
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
        debug('Could not focus editor', focusError);
      }

      // Find and click the send button after a short delay
      setTimeout(() => {
        findAndClickSendButton();
      }, 1000);

      return true;
    } catch (error) {
      debug('Error inserting text', error);
      return false;
    }
  }
  
  /**
   * Find and click the send button with multiple approaches
   */
  function findAndClickSendButton() {
    // Try multiple possible button selectors
    const sendButton = 
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Send Message"]') ||
      document.querySelector('button[type="submit"]') ||
      document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');
    
    if (!sendButton) {
      debug('Send button not found');
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
      
      debug('Send button clicked');
      return true;
    } catch (error) {
      debug('Error clicking send button', error);
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
      debug('No content data available for formatting');
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
   * Main processing function
   */
  const handleProcess = async () => {
    try {
      debug('Starting to process extracted content');
      
      // Get data from storage using standard approach
      chrome.storage.local.get(['prePrompt', 'extractedContent'], result => {
        debug('Retrieved data from storage', {
          hasPrompt: !!result.prePrompt,
          hasContent: !!result.extractedContent,
          contentType: result.extractedContent?.contentType
        });
        
        if (!result.prePrompt) {
          throw new Error('Missing prompt data');
        }

        if (!result.extractedContent) {
          throw new Error('Missing content data');
        }
        
        // Format content based on type
        const formattedContent = formatContent(result.extractedContent);
        
        // Combine prompt with content
        const fullText = `${result.prePrompt}\n\n${formattedContent}`;
        
        debug('Attempting to insert text into Claude');
        const success = insertText(fullText);
        
        if (success) {
          debug('Content successfully inserted');
          
          // Clear the data after successful insertion
          chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
        } else {
          debug('Failed to insert content into Claude');
        }
      });
    } catch (error) {
      debug('Error in handleProcess', error);
    }
  };

  /**
   * Initialize the script
   */
  function initialize() {
    if (!window.location.href.includes('claude.ai')) {
      debug('Not on Claude.ai, exiting');
      return;
    }
    
    debug('Initializing Claude integration script');
    
    // Wait for the DOM to be fully loaded
    if (document.readyState === 'complete') {
      debug('Document already loaded, processing content');
      setTimeout(handleProcess, 1000); // Small delay to ensure all elements are ready
    } else {
      debug('Waiting for document to load');
      window.addEventListener('load', () => {
        setTimeout(handleProcess, 1000);
      });
    }
  }
  
  // Set a flag to indicate this script is loaded
  window.__claudeExtensionLoaded = true;
  
  // Initialize the script
  initialize();
})();