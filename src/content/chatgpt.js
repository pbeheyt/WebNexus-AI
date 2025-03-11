/**
 * ChatGPT Content Script
 * Handles interaction with ChatGPT interface to insert and submit content
 */

(() => {
  const logger = {
    info: (message, data = null) => console.log(`[ChatGPT] INFO: ${message}`, data || ''),
    warn: (message, data = null) => console.warn(`[ChatGPT] WARN: ${message}`, data || ''),
    error: (message, data = null) => console.error(`[ChatGPT] ERROR: ${message}`, data || '')
  };

  /**
   * Insert text into ChatGPT's editor and submit
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
    logger.info('Attempting to insert text into ChatGPT');
    
    // Find ChatGPT's modern editor element with more specific selector
    const editorElement = document.querySelector('#prompt-textarea.ProseMirror');
    
    if (!editorElement) {
      logger.error('ChatGPT editor element not found');
      return false;
    }

    try {
      // Clear existing content
      editorElement.innerHTML = '';
      
      // Split the text into paragraphs by newline
      const paragraphs = text.split('\n');
      
      // Insert each paragraph
      paragraphs.forEach((paragraph) => {
        if (paragraph.trim() === '') {
          // Add empty paragraph with break for blank lines
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          editorElement.appendChild(p);
        } else {
          // Add text paragraph
          const p = document.createElement('p');
          p.textContent = paragraph;
          editorElement.appendChild(p);
        }
      });
      
      // Remove placeholder class if it exists
      const placeholderP = editorElement.querySelector('p.placeholder');
      if (placeholderP) {
        placeholderP.classList.remove('placeholder');
      }
      
      // Focus the editor
      editorElement.focus();
      
      // Dispatch input event to ensure ChatGPT recognizes the change
      const inputEvent = new Event('input', {
        bubbles: true
      });
      editorElement.dispatchEvent(inputEvent);
      
      // Wait a moment for UI to update (longer timeout for reliability)
      setTimeout(() => {
        // Find enabled send button
        const sendButton = document.querySelector('button[data-testid="send-button"]:not(:disabled)');
        
        if (!sendButton) {
          logger.error('ChatGPT send button not found or disabled');
          return false;
        }
        
        logger.info('Send button found, clicking...');
        
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
        
        logger.info('Text submitted to ChatGPT successfully');
      }, 1000);
      
      return true;
    } catch (error) {
      logger.error('Error inserting text into ChatGPT:', error);
      return false;
    }
  }
  
  /**
   * Check if the user is logged in to ChatGPT
   * @returns {boolean} Whether the user is logged in
   */
  function isLoggedIn() {
    // Look for elements that indicate the user is logged in
    const conversationElements = document.querySelector('[data-testid="conversation-turn"]');
    const chatInputElement = document.querySelector('#prompt-textarea.ProseMirror');
    const loginButtonElement = document.querySelector('button[data-testid="login-button"]');
    
    // If login button is present, user is not logged in
    if (loginButtonElement) {
      return false;
    }
    
    // If conversation elements or chat input is present, user is likely logged in
    return !!(conversationElements || chatInputElement);
  }

  /**
   * Format YouTube video data
   */
  const formatYouTubeData = (data) => {
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';
    
    // Format comments with likes
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = '\n\nComments:\n';
      data.comments.forEach(comment => {
        commentsText += `User: ${comment.author || 'Anonymous'}\nLikes: ${comment.likes || '0'}\nComment: ${comment.text || ''}\n\n`;
      });
    }
    
    return `Title: ${title}\nChannel: ${channel}\n\nDescription:\n${description}\n\nTranscript:\n${transcript}${commentsText}`;
  };

  /**
   * Format Reddit post data
   */
  function formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    
    // Format comments simply
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = '\n\nComments:\n';
      data.comments.forEach(comment => {
        commentsText += `User: ${comment.author || 'Anonymous'}\nScore: ${comment.popularity || '0'}\nComment: ${comment.content || ''}\n\n`;
      });
    }
    
    return `Title: ${title}\nAuthor: ${author}\n\nContent:\n${content}${commentsText}`;
  }

  /**
   * Format general web page data
   */
  function formatGeneralData(data) {
    const title = data.pageTitle || 'No title available';
    const url = data.pageUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    
    return `Title: ${title}\nURL: ${url}\n\nContent:\n${content}`;
  }

  /**
   * Format extracted content based on content type
   */
  function formatContent(data) {
    if (!data) {
      logger.error('No content data available for formatting');
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
        formatted = `Content: ${JSON.stringify(data)}`;
    }
    
    return formatted;
  }

  /**
   * Main processing function
   */
  const handleProcess = async () => {
    try {
      logger.info('Starting to process extracted content for ChatGPT');
      
      // Check if user is logged in
      if (!isLoggedIn()) {
        logger.error('User is not logged in to ChatGPT');
        chrome.runtime.sendMessage({
          action: 'notifyError',
          error: 'Not logged in to ChatGPT. Please log in and try again.'
        });
        return;
      }
      
      // Get data from storage
      chrome.storage.local.get(['prePrompt', 'extractedContent'], result => {
        logger.info('Retrieved data from storage', {
          hasPrompt: !!result.prePrompt,
          hasContent: !!result.extractedContent
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
        
        logger.info('Attempting to insert text into ChatGPT');
        const success = insertText(fullText);
        
        if (success) {
          logger.info('Content successfully inserted into ChatGPT');
          
          // Clear the data after successful insertion
          chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
        } else {
          logger.error('Failed to insert content into ChatGPT');
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: 'Failed to insert content into ChatGPT. Please try again or check if ChatGPT interface has changed.'
          });
        }
      });
    } catch (error) {
      logger.error('Error in ChatGPT handleProcess:', error);
      chrome.runtime.sendMessage({
        action: 'notifyError',
        error: `Error processing content: ${error.message}`
      });
    }
  };

  // Initialize with MutationObserver to wait for the interface to load
  const observerConfig = { childList: true, subtree: true };
  let retryCount = 0;
  const MAX_RETRIES = 20;
  let processingStarted = false;

  const observer = new MutationObserver(() => {
    // Check if ProseMirror editor exists, which indicates the interface is ready
    const editorElement = document.querySelector('#prompt-textarea.ProseMirror');
    
    if (editorElement && !processingStarted) {
      logger.info('ChatGPT interface ready, starting processing');
      processingStarted = true;
      observer.disconnect();
      handleProcess();
    } else {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        observer.disconnect();
        logger.error('Failed to find ChatGPT interface elements after maximum retries');
        chrome.runtime.sendMessage({
          action: 'notifyError',
          error: 'Could not interact with ChatGPT interface. The page may still be loading or the interface may have changed.'
        });
      }
    }
  });

  const initialize = () => {
    if (!window.location.href.includes('chatgpt.com')) {
      logger.info('Not on chatgpt.com, exiting');
      return;
    }
    
    logger.info('Initializing ChatGPT content script');
    
    if (document.readyState === 'complete') {
      if (isLoggedIn()) {
        observer.observe(document.body, observerConfig);
      } else {
        logger.error('User is not logged in to ChatGPT');
        chrome.runtime.sendMessage({
          action: 'notifyError',
          error: 'Not logged in to ChatGPT. Please log in and try again.'
        });
      }
    } else {
      window.addEventListener('load', () => {
        if (isLoggedIn()) {
          observer.observe(document.body, observerConfig);
        } else {
          logger.error('User is not logged in to ChatGPT');
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: 'Not logged in to ChatGPT. Please log in and try again.'
          });
        }
      });
    }
  };
  
  // Start the process
  initialize();
})();