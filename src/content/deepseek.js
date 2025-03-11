/**
 * DeepSeek Content Script
 * Handles interaction with DeepSeek interface to insert and submit content
 */

(() => {
  const logger = {
    info: (message, data = null) => console.log(`[DeepSeek] INFO: ${message}`, data || ''),
    warn: (message, data = null) => console.warn(`[DeepSeek] WARN: ${message}`, data || ''),
    error: (message, data = null) => console.error(`[DeepSeek] ERROR: ${message}`, data || '')
  };

  /**
   * Insert text into DeepSeek's editor and submit
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
    logger.info('Attempting to insert text into DeepSeek');
    
    // Find DeepSeek's editor element (textarea)
    let editorElement = document.querySelector('textarea.resize-none');
    
    if (!editorElement) {
      logger.error('DeepSeek textarea element not found');
      return false;
    }

    try {
      // Focus on the textarea
      editorElement.focus();
      
      // Set the value directly
      editorElement.value = text;
      
      // Trigger input event to activate the UI
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      
      // Wait a short moment for the UI to update
      setTimeout(() => {
        // Look for the send button (might be a div with specific class or an SVG icon)
        const sendButton = document.querySelector('button[type="submit"]') || 
                         document.querySelector('.send-button') ||
                         editorElement.parentElement.querySelector('button');
        
        if (!sendButton) {
          logger.error('DeepSeek send button not found');
          return false;
        }
        
        // Click the send button
        sendButton.click();
        logger.info('Text submitted to DeepSeek successfully');
      }, 500);
      
      return true;
    } catch (error) {
      logger.error('Error inserting text into DeepSeek:', error);
      return false;
    }
  }
  
  /**
   * Check if the user is logged in to DeepSeek
   * @returns {boolean} Whether the user is logged in
   */
  function isLoggedIn() {
    // Look for elements that indicate the user is logged in
    const textareaElement = document.querySelector('textarea.resize-none');
    const loginElements = document.querySelectorAll('button[type="button"]');
    
    // If textareaElement exists, user is likely logged in
    if (textareaElement) {
      return true;
    }
    
    // Check for login buttons
    for (const button of loginElements) {
      const buttonText = button.textContent.toLowerCase();
      if (buttonText.includes('login') || buttonText.includes('sign in')) {
        return false;
      }
    }
    
    // Default to assuming logged in if no clear indicators otherwise
    return true;
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
      logger.info('Starting to process extracted content for DeepSeek');
      
      // Check if user is logged in
      if (!isLoggedIn()) {
        logger.error('User is not logged in to DeepSeek');
        chrome.runtime.sendMessage({
          action: 'notifyError',
          error: 'Not logged in to DeepSeek. Please log in and try again.'
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
        
        logger.info('Attempting to insert text into DeepSeek');
        const success = insertText(fullText);
        
        if (success) {
          logger.info('Content successfully inserted into DeepSeek');
          
          // Clear the data after successful insertion
          chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
        } else {
          logger.error('Failed to insert content into DeepSeek');
          chrome.runtime.sendMessage({
            action: 'notifyError',
            error: 'Failed to insert content into DeepSeek. Please try again or check if DeepSeek interface has changed.'
          });
        }
      });
    } catch (error) {
      logger.error('Error in DeepSeek handleProcess:', error);
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
    // Check if textarea exists, which indicates the interface is ready
    const textareaElement = document.querySelector('textarea.resize-none');
    
    if (textareaElement && !processingStarted) {
      logger.info('DeepSeek interface ready, starting processing');
      processingStarted = true;
      observer.disconnect();
      handleProcess();
    } else {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        observer.disconnect();
        logger.error('Failed to find DeepSeek interface elements after maximum retries');
        chrome.runtime.sendMessage({
          action: 'notifyError',
          error: 'Could not interact with DeepSeek interface. The page may still be loading or the interface may have changed.'
        });
      }
    }
  });

  const initialize = () => {
    if (!window.location.href.includes('chat.deepseek.com')) {
      logger.info('Not on chat.deepseek.com, exiting');
      return;
    }
    
    logger.info('Initializing DeepSeek content script');
    
    if (document.readyState === 'complete') {
      observer.observe(document.body, observerConfig);
    } else {
      window.addEventListener('load', () => {
        observer.observe(document.body, observerConfig);
      });
    }
  };
  
  // Start the process
  initialize();
})();