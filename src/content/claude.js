(() => {
  /**
   * Insert text into Claude's editor and submit
   * @param {string} text - The text to insert
   * @returns {boolean} Success status
   */
  function insertText(text) {
    // Find Claude's editor with reliable selectors
    let editorElement = document.querySelector('p[data-placeholder="How can Claude help you today?"]');
    
    if (!editorElement) {
      editorElement = document.querySelector('[contenteditable="true"]');
    }
    
    if (!editorElement) {
      console.error('Claude editor element not found');
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
      if (editorElement.classList.contains('is-empty')) {
        editorElement.classList.remove('is-empty');
      }
      if (editorElement.classList.contains('is-editor-empty')) {
        editorElement.classList.remove('is-editor-empty');
      }

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      
      // Try to focus the editor
      try {
        editorElement.focus();
      } catch (focusError) {
        console.error('Could not focus editor:', focusError);
      }

      // Find and click the send button after a short delay
      setTimeout(() => {
        const sendButton = 
          document.querySelector('button[aria-label="Send message"]') ||
          document.querySelector('button[aria-label="Send Message"]') ||
          document.querySelector('button[type="submit"]') ||
          document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');
        
        if (!sendButton) {
          console.error('Send button not found');
          return false;
        }
        
        // Ensure button is enabled
        if (sendButton.disabled) {
          sendButton.disabled = false;
        }
        
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
        
        console.log('Send button clicked');
      }, 1000);

      return true;
    } catch (error) {
      console.error('Error inserting text:', error);
      return false;
    }
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
   * Format Reddit post data with comment links
   */
  function formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    const postUrl = data.postUrl || '';
    
    // Start with post information
    let formattedText = `Title: ${title}\nAuthor: ${author}`;
    
    // Add post URL if available
    if (postUrl) {
      formattedText += `\nURL: ${postUrl}`;
    }
    
    // Add post content
    formattedText += `\n\nContent:\n${content}`;
    
    // Format comments with links
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formattedText += '\n\nComments:\n';
      
      data.comments.forEach(comment => {
        formattedText += `User: ${comment.author || 'Anonymous'}\n`;
        formattedText += `Score: ${comment.popularity || '0'}\n`;
        
        // Add permalink if available
        if (comment.permalink) {
          formattedText += `Link: ${comment.permalink}\n`;
        }
        
        formattedText += `Comment: ${comment.content || ''}\n\n`;
      });
    }
    
    return formattedText;
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
      console.error('No content data available for formatting');
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
      console.log('Starting to process extracted content');
      
      // Get data from storage
      chrome.storage.local.get(['prePrompt', 'extractedContent'], result => {
        console.log('Retrieved data from storage', {
          hasPrompt: !!result.prePrompt,
          hasContent: !!result.extractedContent
        });
        
        if (!result.prePrompt) {
          throw new Error('Missing prompt data');
        }

        if (!result.extractedContent) {
          throw new Error('Missing content data');
        }
        
        // Format content based on type (using simplified formatters)
        const formattedContent = formatContent(result.extractedContent);
        
        // Combine prompt with content
        const fullText = `${result.prePrompt}\n\n${formattedContent}`;
        
        console.log('Attempting to insert text into Claude');
        const success = insertText(fullText);
        
        if (success) {
          console.log('Content successfully inserted');
          
          // Clear the data after successful insertion
          chrome.storage.local.remove(['extractedContent', 'prePrompt', 'contentReady']);
        } else {
          console.error('Failed to insert content into Claude');
        }
      });
    } catch (error) {
      console.error('Error in handleProcess:', error);
    }
  };

  // Initialize with MutationObserver (from working scripts)
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

  const initialize = () => {
    if (!window.location.href.includes('claude.ai')) {
      console.log('Not on Claude.ai, exiting');
      return;
    }
    
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