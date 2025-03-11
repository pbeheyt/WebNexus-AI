/**
 * Reddit Content Script
 * Extracts post content and comments from Reddit pages.
 */

// Flag to indicate script is fully loaded
let contentScriptReady = false;

// Storage key for accessing settings
const STORAGE_KEY = 'custom_prompts_by_type';

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
 * Wait for comments to be loaded in the DOM
 * @returns {Promise} Promise that resolves when comments are available
 */
function waitForComments() {
  return new Promise(resolve => {
    // If comments are already present, resolve immediately
    const selectors = [
      'shreddit-comment',
      'div[data-testid="comment"]',
      '.Comment'
    ];
    
    for (const selector of selectors) {
      if (document.querySelectorAll(selector).length > 0) {
        resolve();
        return;
      }
    }
    
    // Otherwise, watch for changes
    const observer = new MutationObserver(mutations => {
      for (const selector of selectors) {
        if (document.querySelectorAll(selector).length > 0) {
          observer.disconnect();
          resolve();
          return;
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Timeout after 5 seconds to prevent infinite waiting
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 5000);
  });
}

/**
 * Extract comments from the Reddit post
 * @returns {Promise<Array>} Promise resolving to array of comment objects
 */
function extractComments() {
  return new Promise((resolve) => {
    // First, get the configured max comments
    chrome.storage.sync.get(STORAGE_KEY, async (result) => {
      try {
        // Get configured max comments or use default
        let maxComments = 200; // Default value
        
        if (result && result[STORAGE_KEY] && 
            result[STORAGE_KEY].reddit && 
            result[STORAGE_KEY].reddit.settings && 
            result[STORAGE_KEY].reddit.settings.maxComments) {
          maxComments = result[STORAGE_KEY].reddit.settings.maxComments;
        }
        
        console.log(`Extracting up to ${maxComments} Reddit comments...`);
        
        // Wait for comments to be loaded
        await waitForComments();
        
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
          resolve([]);
          return;
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
          
          // IMPROVED SCORE EXTRACTION
          let score = '0';
          
          // Method 1: Direct attribute access for shreddit-comment elements
          if (commentElement.tagName && 
              commentElement.tagName.toLowerCase() === 'shreddit-comment' && 
              commentElement.hasAttribute('score')) {
            score = commentElement.getAttribute('score');
          } 
          // Method 2: Access through action row with proper null checks
          else {
            const commentActionRow = commentElement.querySelector('shreddit-comment-action-row');
            if (commentActionRow && commentActionRow.hasAttribute('score')) {
              score = commentActionRow.getAttribute('score');
            } 
            // Method 3: Try alternative selectors for score display elements
            else {
              const scoreSelectors = [
                '[data-testid="vote-score"]',
                'div[data-click-id="upvote"]',
                'div[class*="score"]',
                '.vote-count',
                '.score[title]',
                // Additional selectors for newer Reddit UI
                '.text-neutral-content.text-12',
                'span[aria-label*="votes"]',
                'button[aria-label*="upvoted"]',
                'faceplate-tracker[noun="upvote"] .text-neutral-content-weak'
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
          
          // Handle "Vote" text and normalize score value
          if (score) {
            // Handle scores with "k" suffix (e.g., "1.2k")
            if (typeof score === 'string' && score.includes('k')) {
              score = String(Math.round(parseFloat(score.replace('k', '')) * 1000));
            } 
            // Remove non-numeric characters
            else if (typeof score === 'string') {
              const numericScore = score.replace(/[^\d.-]/g, '');
              score = numericScore || '0';
            }
          }
          
          // Extract permalink for the comment
          let permalink = '';
          
          // Method 1: Check for permalink attribute on shreddit-comment element
          if (commentElement.getAttribute && commentElement.getAttribute('permalink')) {
            permalink = commentElement.getAttribute('permalink');
          } 
          // Method 2: Check for permalink attribute on shreddit-comment-action-row
          else {
            const commentActionRow = commentElement.querySelector('shreddit-comment-action-row');
            if (commentActionRow && commentActionRow.getAttribute('permalink')) {
              permalink = commentActionRow.getAttribute('permalink');
            } 
            // Method 3: Look for permalink in link elements
            else {
              const permalinkSelectors = [
                'a[href*="/comment/"]',
                '.text-neutral-content-weak[href]',
                'shreddit-comment-share-button[permalink]',
                'a[rel="nofollow noopener noreferrer"]'
              ];
              
              for (const selector of permalinkSelectors) {
                const permalinkElement = commentElement.querySelector(selector);
                if (permalinkElement) {
                  // For normal link elements
                  if (permalinkElement.href) {
                    permalink = permalinkElement.href;
                    break;
                  }
                  // For elements with permalink attribute
                  else if (permalinkElement.getAttribute && permalinkElement.getAttribute('permalink')) {
                    permalink = permalinkElement.getAttribute('permalink');
                    break;
                  }
                }
              }
            }
          }
          
          // Convert relative permalink to absolute URL if needed
          if (permalink && permalink.startsWith('/')) {
            permalink = `https://www.reddit.com${permalink}`;
          }
          
          // Add comment to the list if it has content
          if (commentContent) {
            comments.push({
              author,
              content: commentContent,
              popularity: score,
              permalink: permalink || window.location.href // Fallback to post URL if permalink not found
            });
          }
        }
        
        resolve(comments);
      } catch (error) {
        console.error('Error extracting Reddit comments:', error);
        resolve([]);
      }
    });
  });
}

/**
 * Main function to extract all post data
 * @returns {Promise<Object>} Promise resolving to the extracted post data
 */
function extractPostData() {
  try {
    // Extract basic post metadata
    const title = extractPostTitle();
    const content = extractPostContent();
    const author = extractAuthor();
    const subreddit = extractSubreddit();
    
    // Return a promise that resolves with the full post data
    return new Promise(async (resolve) => {
      // Extract comments
      console.log('Starting Reddit comment extraction...');
      const comments = await extractComments();
      console.log('Comment extraction complete, found:', comments.length);
      
      // Get post URL for reference
      const postUrl = window.location.href;
      
      // Resolve with the complete post data object
      resolve({
        postTitle: title,
        postContent: content,
        postAuthor: author,
        subreddit,
        comments,
        postUrl,
        extractedAt: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Error extracting Reddit post data:', error);
    
    // Return what we could get, with error message
    return Promise.resolve({
      postTitle: extractPostTitle(),
      postContent: 'Error extracting content: ' + error.message,
      postAuthor: extractAuthor(),
      subreddit: extractSubreddit(),
      comments: [],
      error: true,
      message: error.message || 'Unknown error occurred',
      extractedAt: new Date().toISOString()
    });
  }
}

/**
 * Extract and save post data to Chrome storage
 */
async function extractAndSavePostData() {
  try {
    console.log('Starting Reddit post data extraction...');
    
    // Add small delay to ensure dynamic content is loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Extract all post data
    const postData = await extractPostData();
    
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