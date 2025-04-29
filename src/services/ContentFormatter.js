// src/services/ContentFormatter.js
const logger = require('../shared/logger.js').service;

class ContentFormatter {
  /**
   * Format content based on content type for better LLM processing.
   * @param {Object} contentData - The extracted content data.
   * @param {string} contentType - The type of content (e.g., 'youtube', 'reddit', 'general', 'pdf').
   * @returns {string} Formatted content string.
   */
  static formatContent(contentData, contentType) {
    if (!contentData) {
      logger.error('No content data available for formatting');
      return '[Error: No content data available]'; // Clear error indication
    }

    logger.info(`Formatting content of type: ${contentType}`);

    let formatted = '';
    try {
      switch (contentType) {
        case 'youtube':
          formatted = this._formatYouTubeData(contentData);
          break;
        case 'reddit':
          formatted = this._formatRedditData(contentData);
          break;
        case 'general':
          formatted = this._formatGeneralData(contentData);
          break;
        case 'pdf':
          formatted = this._formatPdfData(contentData);
          break;
      }
    } catch (error) {
        logger.error(`Error formatting content type ${contentType}:`, error);
        formatted = `[Error: Failed to format content of type ${contentType}]`;
    }

    // Basic cleanup: ensure consistent line breaks and trim whitespace
    return formatted.replace(/\n{3,}/g, '\n').trim();
  }

  /** Helper to safely get data or return a placeholder */
  static _getData(value, placeholder = 'Not Available') {
    return value !== null && value !== undefined && value !== '' ? String(value) : placeholder;
  }

  /**
   * Format YouTube video data for LLMs.
   * @private
   */
  static _formatYouTubeData(data) {
    const videoId = this._getData(data.videoId);
    const url = videoId !== 'Not Available' ? `https://www.youtube.com/watch?v=${videoId}` : 'Not Available';

    let formatted = `## METADATA\n`;
    formatted += `- Title: ${this._getData(data.videoTitle)}\n`;
    formatted += `- Channel: ${this._getData(data.channelName)}\n`;
    formatted += `- URL: ${url}\n`; // Add URL here for context

    formatted += `## DESCRIPTION\n`;
    formatted += `${this._getData(data.videoDescription, 'No description provided.')}\n`;

    formatted += `## TRANSCRIPT\n`;
    formatted += `${this._getData(data.transcript, 'No transcript available.')}\n`;

    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formatted += `## COMMENTS\n`;
      data.comments.forEach((comment, index) => {
        formatted += `${index + 1}. Author: ${this._getData(comment.author, 'Anonymous')}\n`;
        formatted += `   Likes: ${this._getData(comment.likes, '0')}\n`;
        formatted += `   Comment: "${this._getData(comment.text, '')}"\n`; // Indent comment text slightly
      });
    } else {
      formatted += `## COMMENTS\nNo comments available.\n`;
    }

    return formatted;
  }

  /**
   * Format Reddit post data for LLMs.
   * @private
   */
  static _formatRedditData(data) {
    let formatted = `## METADATA\n`;
    formatted += `- Title: ${this._getData(data.postTitle)}\n`;
    formatted += `- Author: ${this._getData(data.postAuthor, 'u/Unknown')}\n`;
    formatted += `- Subreddit: ${this._getData(data.subreddit, 'r/Unknown')}\n`;
    formatted += `- URL: ${this._getData(data.postUrl)}\n`;
    formatted += `- Score: ${this._getData(data.postScore, 'Not Available')} points\n`;

    formatted += `## POST CONTENT\n`;
    formatted += `${this._getData(data.postContent, 'No post body content.')}\n`;

    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formatted += `## COMMENTS\n`;
      data.comments.forEach((comment, index) => {
        formatted += `${index + 1}. Author: ${this._getData(comment.author, 'u/Anonymous')}\n`;
        formatted += `   Score: ${this._getData(comment.popularity, '0')} points\n`;
        // Link removed as per previous request
        formatted += `   Comment: "${this._getData(comment.content, '')}"\n`;
      });
    } else {
      formatted += `## COMMENTS\nNo comments available.\n`;
    }

    return formatted;
  }

  /**
   * Format general web page data for LLMs.
   * @private
   */
  static _formatGeneralData(data) {
    let formatted = `## METADATA\n`;
    formatted += `- Title: ${this._getData(data.pageTitle)}\n`;
    formatted += `- URL: ${this._getData(data.pageUrl)}\n`;
    formatted += `- Author: ${this._getData(data.pageAuthor)}\n`; // Included even if 'Not Available'
    formatted += `- Description: ${this._getData(data.pageDescription)}\n`; // Included even if 'Not Available'

    formatted += `## PAGE CONTENT\n`;
    formatted += `${this._getData(data.content, 'No main content extracted.')}\n`;

    return formatted;
  }

  /**
   * Format PDF document data for LLMs.
   * @private
   */
  static _formatPdfData(data) {
    let formatted = `## METADATA\n`;
    formatted += `- Title: ${this._getData(data.pdfTitle, 'Untitled PDF')}\n`;
    formatted += `- URL/Source: ${this._getData(data.pdfUrl)}\n`;
    formatted += `- Pages: ${this._getData(data.pageCount)}\n`;

    const metadata = data.metadata || {};
    formatted += `- Author: ${this._getData(metadata.author)}\n`;
    formatted += `- Creation Date: ${this._getData(metadata.creationDate)}\n`;

    if (data.ocrRequired) {
      formatted += `- Note: OCR may have been required; text accuracy might vary.\n`;
    }
    formatted += `\n`; // End metadata section

    formatted += `## PDF CONTENT\n`;
    let contentText = this._getData(data.content, 'No content extracted from PDF.');

    // Attempt to clean JSON artifacts if necessary (keep existing logic)
    if (typeof contentText === 'string' && contentText.startsWith('{"content":"')) {
        try {
            const contentObj = JSON.parse(contentText);
            contentText = this._getData(contentObj.content, contentText); // Fallback to original if parse is empty
        } catch (e) {
            logger.warn('Failed to parse potential JSON in PDF content, using raw string.');
        }
    }

    // Standardize page markers (keep existing logic, ensure it works)
    if (typeof contentText === 'string') {
        contentText = contentText
            .replace(/--- Page (\d+) ---\n*/g, '\n## PAGE $1\n') // Ensure separation
            .replace(/\n{3,}/g, '\n') // Consolidate excessive newlines
            .trim();
    } else {
        logger.warn('PDF content is not a string after processing, converting.');
        contentText = String(contentText); // Ensure it's a string
    }

    formatted += `${contentText}\n`;

    return formatted;
  }
}

module.exports = ContentFormatter;
