/**
 * Reddit Content Script
 * Extracts post content and comments from Reddit pages.
 */

// Flag to indicate script is fully loaded
let contentScriptReady = false;

/**
 * Extract the post title from the page
 * @returns {string} The post title
 */
function extractPostTitle() {
  // Try multiple selectors to improve reliability
  const selectors = [
    'h1',
    'h1.text-neutral-content'
  ];

  for (const selector of selectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      return titleElement.textContent.trim();
    }
  }

  return 'Title not found';
}

/**
 * Extract the post content from the page
 * @returns {string} The post content
 */
function extractPostContent() {
  // Try multiple selectors to improve reliability
  const selectors = [
    '.text-neutral-content[slot="text-body"] .mb-sm .md.text-14',
    '.RichTextJSON-root',
    'div[data-testid="post-content"] div[data-click-id="text"]'
  ];

  for (const selector of selectors) {
    const contentElement = document.querySelector(selector);
    if (contentElement) {
      let postContent = '';
      
      // Get all paragraphs
      const paragraphs = contentElement.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs.forEach(paragraph => {
          postContent += paragraph.textContent.trim() + '\n\n';
        });
        return postContent.trim();
      } else {
        // Fallback - use the entire content element
        return contentElement.textContent.trim();
      }
    }
  }

  return 'Post content not found';
}

/**
 * Extract the author username from the page
 * @returns {string} The post author username
 */
/**
 * Extract the author username from the page
 * @returns {string} The post author username
 */
/**
 * Extract the author username from the page
 * @returns {string} The post author username
 */
function extractAuthor() {
  // Try multiple selectors to improve reliability
  const selectors = [
    'span[slot="authorName"] a.author-name',
    'a[data-testid="post_author_link"]',
    'a[data-click-id="user"]',
    '.author-link'
  ];

  for (const selector of selectors) {
    const authorElement = document.querySelector(selector);
    if (authorElement && authorElement.textContent.trim()) {
      return authorElement.textContent.trim();
    }
  }

  return 'Unknown author';
}

/**
 * Extract the subreddit name from the page
 * @returns {string} The subreddit name
 */
function extractSubreddit() {
  // Try multiple selectors to improve reliability
  const selectors = [
    'a[data-testid="subreddit-name"]',
    'a[data-click-id="subreddit"]',
    '.subreddit-link'
  ];

  for (const selector of selectors) {
    const subredditElement = document.querySelector(selector);
    if (subredditElement && subredditElement.textContent.trim()) {
      return subredditElement.textContent.trim();
    }
  }

  // Fallback - try to extract from URL
  const urlMatch = window.location.pathname.match(/\/r\/([^\/]+)/);
  if (urlMatch && urlMatch[1]) {
    return `r/${urlMatch[1]}`;
  }

  return 'Unknown subreddit';
}

/**
 * Extract comments from the Reddit post
 * @param {number} maxComments - Maximum number of comments to extract
 * @returns {Array} Array of comment objects
 */
function extractComments(maxComments = 30) {
  try {
    console.log('Extracting Reddit comments...');
    
    // Try multiple selectors for comments to improve reliability
    const commentSelectors = [
      'shreddit-comment',
      'div[data-testid="comment"]',
      '.Comment'
    ];
    
    let commentElements = [];
    
    for (const selector of commentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        commentElements = elements;
        console.log(`Found ${elements.length} comments using selector: ${selector}`);
        break;
      }
    }
    
    if (commentElements.length === 0) {
      console.log('No comments found or comments not loaded yet');
      return [];
    }
    
    // Extract data from each comment
    const comments = [];
    
    for (let i = 0; i < Math.min(commentElements.length, maxComments); i++) {
      const commentElement = commentElements[i];
      
      // Extract author (handle different selectors)
      let author = 'Unknown user';
      const authorSelectors = [
        'a[data-testid="comment_author_link"]',
        'a[data-click-id="user"]',
        '[data-testid="comment_author_icon"]+a',
        'a.author'
      ];
      
      for (const selector of authorSelectors) {
        const authorElement = commentElement.querySelector(selector);
        if (authorElement && authorElement.textContent.trim()) {
          author = authorElement.textContent.trim();
          break;
        }
      }
      
      // Try getAttribute for shreddit-comment
      if (author === 'Unknown user' && commentElement.getAttribute) {
        author = commentElement.getAttribute('author') || author;
      }
      
      // Extract comment text (handle different selectors)
      let commentContent = '';
      const contentSelectors = [
        '.md.text-14',
        '[data-testid="comment-content"]',
        'div[data-click-id="text"]'
      ];
      
      for (const selector of contentSelectors) {
        const contentElement = commentElement.querySelector(selector);
        if (contentElement) {
          const paragraphs = contentElement.querySelectorAll('p');
          if (paragraphs.length > 0) {
            paragraphs.forEach(paragraph => {
              commentContent += paragraph.textContent.trim() + '\n\n';
            });
            commentContent = commentContent.trim();
            break;
          } else {
            commentContent = contentElement.textContent.trim();
            break;
          }
        }
      }
      
      let score = '0';

      // First check if the score attribute exists on shreddit-comment or shreddit-comment-action-row
      if (commentElement.getAttribute && commentElement.getAttribute('score')) {
        score = commentElement.getAttribute('score');
      } else {
        // Find score from shreddit-comment-action-row if it exists
        const commentActionRow = commentElement.querySelector('shreddit-comment-action-row');
        if (commentActionRow && commentActionRow.getAttribute('score')) {
          score = commentActionRow.getAttribute('score');
        } else {
          // Try the existing selectors as fallback
          const scoreSelectors = [
            '[data-testid="vote-score"]',
            'div[data-click-id="upvote"]',
            'div[class*="score"]'
          ];
          
          for (const selector of scoreSelectors) {
            const scoreElement = commentElement.querySelector(selector);
            if (scoreElement && scoreElement.textContent.trim()) {
              score = scoreElement.textContent.trim();
              break;
            }
          }
        }
      }
      
      // Add comment to the list if it has content
      if (commentContent) {
        comments.push({
          author,
          content: commentContent,
          popularity: score
        });
      }
    }
    
    return comments;
  } catch (error) {
    console.error('Error extracting Reddit comments:', error);
    return [];
  }
}

/**
 * Main function to extract all post data
 * @returns {Object} The extracted post data
 */
function extractPostData() {
  try {
    // Extract basic post metadata
    const title = extractPostTitle();
    const content = extractPostContent();
    const author = extractAuthor();
    const subreddit = extractSubreddit();
    
    // Extract comments
    console.log('Starting Reddit comment extraction...');
    const comments = extractComments();
    console.log('Comment extraction complete, found:', comments.length);
    
    // Get post URL for reference
    const postUrl = window.location.href;
    
    // Return the complete post data object
    return {
      postTitle: title,
      postContent: content,
      postAuthor: author,
      subreddit,
      comments,
      postUrl,
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error extracting Reddit post data:', error);
    
    // Return what we could get, with error message
    return {
      postTitle: extractPostTitle(),
      postContent: 'Error extracting content: ' + error.message,
      postAuthor: extractAuthor(),
      subreddit: extractSubreddit(),
      comments: [],
      error: true,
      message: error.message || 'Unknown error occurred',
      extractedAt: new Date().toISOString()
    };
  }
}

/**
 * Extract and save post data to Chrome storage
 */
function extractAndSavePostData() {
  try {
    console.log('Starting Reddit post data extraction...');
    
    // Extract all post data
    const postData = extractPostData();
    
    // Save to Chrome storage
    chrome.storage.local.set({ 
      extractedContent: {
        ...postData,
        contentType: 'reddit'
      },
      contentReady: true
    }, () => {
      console.log('Reddit post data saved to storage');
    });
  } catch (error) {
    console.error('Error in Reddit content script:', error);
    
    // Save error message to storage
    chrome.storage.local.set({ 
      extractedContent: {
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: 'reddit'
      },
      contentReady: true
    });
  }
}

// Handle messages from popup and background scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in Reddit content script:', message);
  
  // Respond to ping messages to verify content script is loaded
  if (message.action === 'ping') {
    console.log('Ping received, responding with pong');
    sendResponse({ status: 'pong', ready: contentScriptReady });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'extractContent') {
    console.log('Extract content request received');
    // Start the extraction process
    extractAndSavePostData();
    sendResponse({ status: 'Extracting Reddit content...' });
    return true; // Keep the message channel open for async response
  }
});

// Initialize and mark as ready when loaded
const initialize = () => {
  try {
    console.log('Reddit content script initializing...');
    
    // Mark script as ready
    contentScriptReady = true;
    console.log('Reddit content script ready');
  } catch (error) {
    console.error('Error initializing Reddit content script:', error);
  }
};

// Initialize the content script
initialize();