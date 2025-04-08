// src/services/ContentFormatter.js
const logger = require('../shared/logger.js').service;

class ContentFormatter {
  /**
   * Format content based on content type
   * @param {Object} contentData - The extracted content data
   * @param {string} contentType - The type of content (e.g., 'youtube', 'reddit', 'general', 'pdf')
   * @returns {string} Formatted content
   */
  static formatContent(contentData, contentType) {
    if (!contentData) {
      logger.error('No content data available for formatting');
      return 'No content data available';
    }

    logger.info(`Formatting content of type: ${contentType}`);

    let formatted = '';
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
      default:
        logger.warn(`Unknown content type '${contentType}', using JSON stringify`);
        try {
          formatted = `Content Type: ${contentType}\nData: ${JSON.stringify(contentData, null, 2)}`;
        } catch (e) {
          logger.error('Failed to stringify unknown content data:', e);
          formatted = `Content Type: ${contentType}\nData: [Could not stringify]`;
        }
    }

    return formatted;
  }

  /**
   * Format YouTube video data
   * @private
   * @param {Object} data - YouTube video data
   * @returns {string} Formatted YouTube data
   */
  static _formatYouTubeData(data) {
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';

    // Format comments with likes
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = `## COMMENTS\n`;
      data.comments.forEach((comment, index) => {
        commentsText += `${index + 1}. User: ${comment.author || 'Anonymous'} (${comment.likes || '0'} likes)\n  "${comment.text || ''}"\n`;
      });
    }

    return `## VIDEO METADATA\n  - Title: ${title}\n  - Channel: ${channel}\n  - URL: https://www.youtube.com/watch?v=${data.videoId || ''}\n## DESCRIPTION\n${description}\n## TRANSCRIPT\n${transcript}\n${commentsText}`;
  }

  /**
   * Format Reddit post data
   * @private
   * @param {Object} data - Reddit post data
   * @returns {string} Formatted Reddit data
   */
  static _formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    const postUrl = data.postUrl || '';
    const subreddit = data.subreddit || 'Unknown subreddit';

    let formattedText = `## POST METADATA\n  - Title: ${title}\n  - Author: ${author}\n  - Subreddit: ${subreddit}\n  - URL: ${postUrl}\n## POST CONTENT\n${content}\n`;

    // Format comments with links
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formattedText += `## COMMENTS\n`;

      data.comments.forEach((comment, index) => {
        formattedText += `${index + 1}. u/${comment.author || 'Anonymous'} (${comment.popularity || '0'} points) [(link)](${comment.permalink || postUrl})\n  "${comment.content || ''}"\n`;
      });
    }

    return formattedText;
  }

  /**
   * Format general web page data
   * @private
   * @param {Object} data - Web page data
   * @returns {string} Formatted web page data
   */
  static _formatGeneralData(data) {
    const title = data.pageTitle || 'No title available';
    const url = data.pageUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const author = data.pageAuthor || null;
    const description = data.pageDescription || null;

    let metadataText = `## PAGE METADATA\n  - Title: ${title}\n  - URL: ${url}`;

    if (author) {
      metadataText += `\n  - Author: ${author}`;
    }

    if (description) {
      metadataText += `\n  - Description: ${description}`;
    }

    return `${metadataText}\n## PAGE CONTENT\n${content}`;
  }

  /**
   * Format PDF document data
   * @private
   * @param {Object} data - PDF document data
   * @returns {string} Formatted PDF data
   */
  static _formatPdfData(data) {
    const title = data.pdfTitle || 'Untitled PDF';
    const url = data.pdfUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const pageCount = data.pageCount || 'Unknown';
    const metadata = data.metadata || {};

    // Format metadata section
    let metadataText = `## PDF METADATA\n  - Title: ${title}\n  - Pages: ${pageCount}\n  - URL: ${url}`;

    if (metadata.author) {
      metadataText += `\n  - Author: ${metadata.author}`;
    }

    if (metadata.creationDate) {
      metadataText += `\n  - Created: ${metadata.creationDate}`;
    }

    if (data.ocrRequired) {
      metadataText += `\n  - Note: This PDF may require OCR as text extraction was limited.`;
    }

    // Format and clean up the content
    let formattedContent = content;

    // Remove JSON artifacts if present
    if (typeof formattedContent === 'string' && formattedContent.includes('{"content":"')) {
      try {
        const contentObj = JSON.parse(formattedContent);
        formattedContent = contentObj.content || formattedContent;
      } catch (e) {
        // If parsing fails, keep the original content
        logger.warn('Failed to parse JSON in PDF content');
      }
    }

    // Clean up page markers to make them more readable
    if (typeof formattedContent === 'string') {
        formattedContent = formattedContent
          .replace(/--- Page (\d+) ---\n\n/g, '\n\n## PAGE $1\n') // Corrected regex
          .replace(/\n{3,}/g, '\n\n')  // Reduce multiple line breaks
          .trim();
    } else {
        logger.warn('PDF content is not a string, skipping cleanup.');
        formattedContent = String(formattedContent); // Ensure it's a string
    }


    return `${metadataText}\n\n## PDF CONTENT\n${formattedContent}`;
  }
}

module.exports = ContentFormatter;
