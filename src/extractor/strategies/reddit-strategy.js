// src/extractor/strategies/reddit-strategy.js
import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

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
      const postData = await this.extractData();
      await this.saveToStorage(postData);
    } catch (error) {
      this.logger.error('Error in Reddit content extraction:', error);
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      });
    }
  }

  /**
   * Main function to extract all post data
   * @returns {Promise<Object>} Promise resolving to the extracted post data
   */
  async extractData() {
    try {
      const rawTitle = this.extractPostTitle();
      const rawContent = this.extractPostContent();
      const score = this.extractPostScore(); // Score is not text for normalization
      const rawAuthor = this.extractAuthor();
      const rawSubreddit = this.extractSubreddit();

      this.logger.info('Starting Reddit comment extraction...');
      const comments = await this.extractComments(); // Comments are normalized within extractComments
      this.logger.info('Comment extraction complete, found:', comments.length);

      const postUrl = window.location.href; // URL not normalized

      return {
        postTitle: normalizeText(rawTitle),
        postContent: normalizeText(rawContent),
        postScore: score,
        postAuthor: normalizeText(rawAuthor),
        subreddit: normalizeText(rawSubreddit),
        comments,
        postUrl,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    } catch (error) {
      this.logger.error('Error extracting Reddit post data:', error);
      return {
        postTitle: normalizeText(this.extractPostTitle()), // Attempt normalization even in error
        postContent: `Error extracting content: ${error.message}`, // Error message
        postScore: this.extractPostScore(),
        postAuthor: normalizeText(this.extractAuthor()),
        subreddit: normalizeText(this.extractSubreddit()),
        comments: [],
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    }
  }

  /**
   * Extract the post title from the page (raw)
   * @returns {string} The raw post title
   */
  extractPostTitle() {
    const selectors = ['h1', 'h1.text-neutral-content'];
    for (const selector of selectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent) {
        return titleElement.textContent; // Return raw, normalize in extractData
      }
    }
    return 'Title not found';
  }

  /**
   * Extract the post content from the page (raw, with paragraph separation)
   * @returns {string} The raw post content
   */
  extractPostContent() {
    const selectors = [
      '.text-neutral-content[slot="text-body"] .mb-sm .md.text-14',
      '.RichTextJSON-root',
      'div[data-testid="post-content"] div[data-click-id="text"]',
    ];

    for (const selector of selectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement) {
        let postContent = '';
        const paragraphs = contentElement.querySelectorAll('p');
        if (paragraphs.length > 0) {
          paragraphs.forEach((paragraph, index) => {
            postContent += paragraph.textContent;
            if (index < paragraphs.length - 1) {
              postContent += '\n\n'; // Use double newline for paragraph separation initially
            }
          });
          return postContent; // Return raw, normalize in extractData
        } else {
          return contentElement.textContent; // Return raw, normalize in extractData
        }
      }
    }
    return 'Post content not found';
  }

  /**
   * Extract post score
   * @returns {string|null}
   */
  extractPostScore() {
    const postElement = document.querySelector('shreddit-post');
    if (postElement && postElement.hasAttribute('score')) {
      return postElement.getAttribute('score');
    }
    const scoreSelectors = [
      'div[id^="vote-arrows-"] > div',
      '[data-testid="post-score"]',
    ];
    for (const selector of scoreSelectors) {
      const scoreElement = document.querySelector(selector);
      if (scoreElement && scoreElement.textContent) {
        const scoreText = scoreElement.textContent.trim();
        if (scoreText.toLowerCase().includes('k')) {
          return String(Math.round(parseFloat(scoreText.replace(/k/i, '')) * 1000));
        }
        const score = scoreText.replace(/[^\d]/g, '');
        if (score) return score;
      }
    }
    return null;
  }

  /**
   * Extract the author username from the page (raw)
   * @returns {string} The raw post author username
   */
  extractAuthor() {
    const selectors = [
      'span[slot="authorName"] a.author-name',
      'a[data-testid="post_author_link"]',
      'a[data-click-id="user"]',
      '.author-link',
    ];
    for (const selector of selectors) {
      const authorElement = document.querySelector(selector);
      if (authorElement && authorElement.textContent) {
        return authorElement.textContent; // Return raw
      }
    }
    return 'Unknown author';
  }

  /**
   * Extract the subreddit name from the page (raw)
   * @returns {string} The raw subreddit name
   */
  extractSubreddit() {
    const selectors = [
      'a[data-testid="subreddit-name"]',
      'a[data-click-id="subreddit"]',
      '.subreddit-link',
    ];
    for (const selector of selectors) {
      const subredditElement = document.querySelector(selector);
      if (subredditElement && subredditElement.textContent) {
        return subredditElement.textContent; // Return raw
      }
    }
    const urlMatch = window.location.pathname.match(/r\/([^/]+)/);
    if (urlMatch && urlMatch[1]) {
      return `r/${urlMatch[1]}`; // Return raw
    }
    return 'Unknown subreddit';
  }

  waitForComments() {
    return new Promise((resolve) => {
      // Define comment selectors locally, consistent with how extractComments might use them.
      const commentSelectors = ['shreddit-comment', 'div[data-testid="comment"]', '.Comment'];

      // 1. Check for explicit "no comments" state or "comments disabled" state
      const noCommentsElement = document.querySelector('comment-forest-empty-state');
      const commentStatsZero = document.querySelector('shreddit-comment-tree-stats[total-comments="0"]');

      if (noCommentsElement || commentStatsZero) {
        this.logger.info('waitForComments: Detected no comments (empty state or stats zero). Resolving immediately.');
        resolve();
        return;
      }

      // 2. Check if comments are already loaded
      for (const selector of commentSelectors) {
        if (document.querySelectorAll(selector).length > 0) {
          this.logger.info(`waitForComments: Comments found with selector "${selector}". Resolving immediately.`);
          resolve();
          return;
        }
      }

      // 3. If comments are not present and no explicit "no comments" state, observe for changes or timeout
      this.logger.info('waitForComments: No comments found yet, and no explicit "no comments" state. Starting observer.');
      
      let observer; // Declare observer here to be accessible by timeout and its clear function
      
      const timeoutId = setTimeout(() => {
        this.logger.warn('waitForComments: Timed out waiting for comments or "no comments" state. Resolving anyway.');
        if (observer) {
          observer.disconnect();
        }
        resolve();
      }, 5000); // 5-second timeout

      observer = new MutationObserver(() => {
        // Check for "no comments" state again in case it appears dynamically
        if (document.querySelector('comment-forest-empty-state') || document.querySelector('shreddit-comment-tree-stats[total-comments="0"]')) {
          this.logger.info('waitForComments: "No comments" state appeared dynamically. Resolving.');
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve();
          return;
        }

        // Check for comments
        for (const selector of commentSelectors) {
          if (document.querySelectorAll(selector).length > 0) {
            this.logger.info(`waitForComments: Comments appeared dynamically with selector "${selector}". Resolving.`);
            clearTimeout(timeoutId);
            observer.disconnect();
            resolve();
            return;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async extractComments() {
    try {
      this.logger.info(`Extracting all visible Reddit comments...`);
      await this.waitForComments();
      const commentSelectors = ['shreddit-comment', 'div[data-testid="comment"]', '.Comment'];
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

      const comments = [];
      for (const commentElement of commentElements) {
        let author = 'Unknown user';
        const authorSelectors = [
          'a[data-testid="comment_author_link"]', 'a[data-click-id="user"]',
          '[data-testid="comment_author_icon"]+a', 'a.author',
        ];
        for (const selector of authorSelectors) {
          const authorElement = commentElement.querySelector(selector);
          if (authorElement && authorElement.textContent) {
            author = authorElement.textContent.trim(); // Trim here as it's simple
            break;
          }
        }
        if (author === 'Unknown user' && commentElement.getAttribute) {
          author = commentElement.getAttribute('author') || author;
        }

        let rawCommentContent = '';
        const contentSelectors = ['.md.text-14', '[data-testid="comment-content"]', 'div[data-click-id="text"]'];
        for (const selector of contentSelectors) {
          const contentElement = commentElement.querySelector(selector);
          if (contentElement) {
            const paragraphs = contentElement.querySelectorAll('p');
            if (paragraphs.length > 0) {
              paragraphs.forEach((paragraph, index) => {
                rawCommentContent += paragraph.textContent;
                if (index < paragraphs.length - 1) {
                  rawCommentContent += '\n\n'; // Double newline for paragraph separation
                }
              });
            } else {
              rawCommentContent = contentElement.textContent;
            }
            break;
          }
        }

        let score = '0';
        if (commentElement.tagName?.toLowerCase() === 'shreddit-comment' && commentElement.hasAttribute('score')) {
          score = commentElement.getAttribute('score');
        } else {
          const commentActionRow = commentElement.querySelector('shreddit-comment-action-row');
          if (commentActionRow?.hasAttribute('score')) {
            score = commentActionRow.getAttribute('score');
          } else {
            const scoreSelectors = [
              '[data-testid="vote-score"]', 'div[data-click-id="upvote"]', 'div[class*="score"]',
              '.vote-count', '.score[title]', '.text-neutral-content.text-12',
              'span[aria-label*="votes"]', 'button[aria-label*="upvoted"]',
              'faceplate-tracker[noun="upvote"] .text-neutral-content-weak',
            ];
            for (const selector of scoreSelectors) {
              const scoreElement = commentElement.querySelector(selector);
              if (scoreElement?.textContent?.trim()) {
                score = scoreElement.textContent.trim(); break;
              }
            }
          }
        }
        if (score) {
          if (typeof score === 'string' && score.includes('k')) {
            score = String(Math.round(parseFloat(score.replace('k', '')) * 1000));
          } else if (typeof score === 'string') {
            score = score.replace(/[^\d.-]/g, '') || '0';
          }
        }

        if (rawCommentContent.trim()) {
          comments.push({
            author: normalizeText(author), // Normalize author here too
            content: normalizeText(rawCommentContent), // Apply normalization
            popularity: score,
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

export default RedditExtractorStrategy;
