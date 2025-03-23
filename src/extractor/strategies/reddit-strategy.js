// src/extractor/strategies/reddit-strategy.js
const BaseExtractor = require('../base-extractor');
const STORAGE_KEYS = require('../../shared/constants').STORAGE_KEYS;

class RedditExtractorStrategy extends BaseExtractor {
  constructor() {
    super('reddit');
  }

  /**
   * Extract and save post data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      this.logger.info('Starting Reddit post data extraction...');
      
      // Add small delay to ensure dynamic content is loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Extract all post data
      const postData = await this.extractData();
      
      // Save to Chrome storage
      await this.saveToStorage(postData);
    } catch (error) {
      this.logger.error('Error in Reddit content extraction:', error);
      
      // Save error message to storage
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Main function to extract all post data
   * @returns {Promise<Object>} Promise resolving to the extracted post data
   */
  async extractData() {
    try {
      // Extract basic post metadata
      const title = this.extractPostTitle();
      const content = this.extractPostContent();
      const author = this.extractAuthor();
      const subreddit = this.extractSubreddit();
      
      // Extract comments
      this.logger.info('Starting Reddit comment extraction...');
      const comments = await this.extractComments();
      this.logger.info('Comment extraction complete, found:', comments.length);
      
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
      this.logger.error('Error extracting Reddit post data:', error);
      
      // Return what we could get, with error message
      return {
        postTitle: this.extractPostTitle(),
        postContent: 'Error extracting content: ' + error.message,
        postAuthor: this.extractAuthor(),
        subreddit: this.extractSubreddit(),
        comments: [],
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract the post title from the page
   * @returns {string} The post title
   */
  extractPostTitle() {
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
  extractPostContent() {
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
  extractAuthor() {
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
  extractSubreddit() {
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
  waitForComments() {
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
  async extractComments() {
    try {
      // Get configured max comments or use default
      let maxComments = 100; // Default value
      
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS, (data) => resolve(data));
        });
        
        if (result && result[STORAGE_KEYS.CUSTOM_PROMPTS] && 
            result[STORAGE_KEYS.CUSTOM_PROMPTS].reddit && 
            result[STORAGE_KEYS.CUSTOM_PROMPTS].reddit.settings && 
            result[STORAGE_KEYS.CUSTOM_PROMPTS].reddit.settings.maxComments) {
          maxComments = result[STORAGE_KEYS.CUSTOM_PROMPTS].reddit.settings.maxComments;
        }
      } catch (error) {
        this.logger.warn('Error fetching max comments setting, using default:', error);
      }
      
      this.logger.info(`Extracting up to ${maxComments} Reddit comments...`);
      
      // Wait for comments to be loaded
      await this.waitForComments();
      
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
          this.logger.info(`Found ${elements.length} comments using selector: ${selector}`);
          break;
        }
      }
      
      if (commentElements.length === 0) {
        this.logger.info('No comments found or comments not loaded yet');
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
        
        // Score extraction
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
        
        // Normalize score value
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
      
      return comments;
    } catch (error) {
      this.logger.error('Error extracting comments:', error);
      return [];
    }
  }
}

module.exports = RedditExtractorStrategy;