// src/extractor/strategies/reddit-strategy.js
const BaseExtractor = require('../base-extractor');

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
      
      // Get post URL for reference
      const postUrl = window.location.href;
      
      // Return the complete post data object with empty comments array
      return {
        postTitle: title,
        postContent: content,
        postAuthor: author,
        subreddit,
        comments: [],
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
}

module.exports = RedditExtractorStrategy;