// src/extractor/strategies/youtube-strategy.js
import { YoutubeTranscript } from 'youtube-transcript';

import BaseExtractor from '../base-extractor.js';

class YoutubeExtractorStrategy extends BaseExtractor {
  constructor() {
    super('youtube');
  }

  /**
   * Extract and save video data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      // Wait for the page to be fully loaded if needed
      if (document.readyState !== 'complete') {
        await new Promise((resolve) => {
          window.addEventListener('load', resolve);
        });
      }

      // Give a moment for YouTube's dynamic content to load
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.logger.info('Starting YouTube video data extraction...');

      // Extract all video data
      const videoData = await this.extractData();

      // Save to Chrome storage
      await this.saveToStorage(videoData);
    } catch (error) {
      this.logger.error('Error in YouTube content extraction:', error);

      // Save error message to storage
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Main function to extract all video data
   * @returns {Promise<Object>} The extracted video data
   */
  async extractData() {
    try {
      // Extract basic video metadata
      const title = this.extractVideoTitle();
      const channel = this.extractChannelName();
      const description = this.extractVideoDescription();

      // Get the current video URL with any parameters
      const fullVideoUrl = window.location.href;

      // Extract just the video ID for consistent identification
      const videoId = new URLSearchParams(window.location.search).get('v');

      this.logger.info('Extracting transcript for video ID:', videoId);
      this.logger.info('From URL:', fullVideoUrl);

      // Extract transcript using the npm package
      const transcriptData =
        await YoutubeTranscript.fetchTranscript(fullVideoUrl);

      // Format transcript with timestamps
      const formattedTranscript = this.formatTranscript(transcriptData, {
        timestampInterval: 15, // Add timestamp every 15 seconds for more granular reference points
      });

      this.logger.info(
        'Transcript data extracted:',
        transcriptData.length,
        'segments'
      );

      // Extract comments
      this.logger.info('Starting comment extraction...');
      const commentsResult = await this.extractComments();
      const comments = commentsResult.items;
      const commentStatus = commentsResult.status;
      this.logger.info('Comment extraction complete, status:', commentStatus);

      // Return the complete video data object
      return {
        videoId,
        videoTitle: title,
        channelName: channel,
        videoDescription: description,
        transcript: formattedTranscript,
        comments,
        commentStatus,
        transcriptLanguage:
          transcriptData.length > 0 ? transcriptData[0].lang : 'unknown',
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Determine error type and provide appropriate message
      let errorMessage = 'Failed to extract transcript';

      if (error.message && error.message.includes('Transcript is disabled')) {
        errorMessage =
          'Transcript is not available for this video. The creator may have disabled it.';
      } else if (
        error.message &&
        error.message.includes('No transcript available')
      ) {
        errorMessage = 'No transcript is available for this video.';
      } else if (error.message && error.message.includes('too many requests')) {
        errorMessage =
          'YouTube is limiting transcript access due to too many requests. Please try again later.';
      } else if (error.message && error.message.includes('unavailable')) {
        errorMessage = 'The video appears to be unavailable or private.';
      } else {
        errorMessage = `Error getting transcript: ${error.message}`;
      }

      // Get comments despite transcript error, using our new method
      let commentsResult = {
        items: [],
        status: { state: 'unknown', message: '', count: 0 },
      };
      try {
        // Always attempt to extract comments
        commentsResult = await this.extractComments();
      } catch (commentError) {
        this.logger.error(
          'Error extracting comments after transcript error:',
          commentError
        );
      }

      // Return what we could get, with error message for transcript and error flag
      return {
        videoId: new URLSearchParams(window.location.search).get('v'),
        videoTitle: this.extractVideoTitle(),
        channelName: this.extractChannelName(),
        videoDescription: this.extractVideoDescription(),
        transcript: errorMessage,
        comments: commentsResult.items,
        commentStatus: commentsResult.status,
        error: true,
        message: errorMessage,
        extractedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Extract top comments from the YouTube video
   * @returns {Promise<Array|string>} Promise resolving to array of comments or error message string
   */
  async extractComments() {
    try {
      this.logger.info(`Extracting all visible YouTube comments...`);

      // Check if comment section exists
      document.getElementById('comments');
      const commentElements = document.querySelectorAll(
        'ytd-comment-thread-renderer'
      );
      const commentsDisabledMessage = document.querySelector(
        '#comments ytd-message-renderer'
      );

      // Return structured comment status object
      let commentStatus = {
        state: 'unknown',
        message: '',
        count: 0,
        commentsExist: false,
      };

      // Check if comments are disabled entirely
      if (commentsDisabledMessage) {
        const disabledText = commentsDisabledMessage.textContent.toLowerCase();
        if (
          disabledText.includes('disabled') ||
          disabledText.includes('turned off')
        ) {
          commentStatus = {
            state: 'disabled',
            message: 'Comments are disabled for this video',
            count: 0,
            commentsExist: false,
          };

          this.logger.info('Comments are disabled for this video');
          return {
            items: [],
            status: commentStatus,
          };
        }
      }

      // Get all comment thread elements
      if (!commentElements || commentElements.length === 0) {
        this.logger.info('No comments found or comments not loaded yet');

        commentStatus = {
          state: 'empty',
          message:
            'No comments available. Comments might be disabled for this video.',
          count: 0,
          commentsExist: false,
        };

        return {
          items: [],
          status: commentStatus,
        };
      }

      this.logger.info(`Found ${commentElements.length} comments`);

      // Extract data from each comment
      const comments = [];

      for (let i = 0; i < commentElements.length; i++) {
        const commentElement = commentElements[i];

        // Extract author name
        const authorElement = commentElement.querySelector('#author-text');
        const author = authorElement
          ? authorElement.textContent.trim()
          : 'Unknown user';

        // Extract comment text
        const contentTextElement = commentElement.querySelector(
          '#content-text, yt-formatted-string#content-text'
        );
        let commentText = 'Comment text not found';

        if (contentTextElement) {
          // Try to get text spans
          const textSpans = contentTextElement.querySelectorAll(
            'span.yt-core-attributed-string'
          );
          if (textSpans && textSpans.length > 0) {
            commentText = Array.from(textSpans)
              .map((span) => span.textContent.trim())
              .join(' ');
          } else {
            // Fallback - try to get text directly
            commentText = contentTextElement.textContent.trim();
          }
        }

        // Extract likes if available
        const likeCountElement =
          commentElement.querySelector('#vote-count-middle');
        const likes = likeCountElement
          ? likeCountElement.textContent.trim()
          : '0';

        comments.push({
          author,
          text: commentText,
          likes,
        });
      }

      // Set comment status for successfully loaded comments
      commentStatus = {
        state: 'loaded',
        message: '',
        count: comments.length,
        commentsExist: true,
      };

      return {
        items: comments,
        status: commentStatus,
      };
    } catch (error) {
      this.logger.error('Error extracting comments:', error);

      return {
        items: [],
        status: {
          state: 'error',
          message: `Error extracting comments: ${error.message}`,
          count: 0,
          commentsExist: false,
        },
      };
    }
  }

  /**
   * Extract the video title from the page
   * @returns {string} The video title
   */
  extractVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-watch-metadata');
    return titleElement ? titleElement.textContent.trim() : 'Title not found';
  }

  /**
   * Extract the channel name from the page
   * @returns {string} The channel name
   */
  extractChannelName() {
    // Try multiple selectors to improve reliability
    const selectors = [
      '#top-row #channel-name yt-formatted-string',
      '#owner-text a.yt-simple-endpoint',
      'ytd-channel-name yt-formatted-string#text',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return 'Channel not found';
  }

  /**
   * Extract the video description from the microformat JSON-LD schema, with fallbacks
   * @returns {string} The video description
   */
  extractVideoDescription() {
    // Target the specific microformat element first
    try {
      const microformatElement = document.querySelector(
        '#microformat script[type="application/ld+json"]'
      );
      if (microformatElement) {
        const jsonData = JSON.parse(microformatElement.textContent);
        if (jsonData && jsonData.description) {
          this.logger.info('Found description in microformat JSON-LD schema');
          return jsonData.description;
        }
      }
    } catch (e) {
      this.logger.warn('Error extracting from microformat JSON-LD:', e);
    }

    // Try meta tag as fallback
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      return metaDescription.getAttribute('content');
    }

    // Try description element as final fallback
    const descriptionElement = document.querySelector(
      '#description-inline-expander'
    );
    if (descriptionElement) {
      return descriptionElement.textContent.trim();
    }

    return 'Description not available';
  }

  /**
   * Format transcript data into a single text block with regular timestamps
   * @param {Array} transcriptData - The transcript data from youtube-transcript
   * @param {Object} options - Formatting options
   * @returns {string} The formatted transcript with timestamps
   */
  formatTranscript(transcriptData, options = {}) {
    if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
      return 'No transcript data available';
    }

    // Default options
    const defaults = {
      timestampInterval: 60, // Add timestamp every 60 seconds
      timestampFormat: 'MM:SS', // Format: minutes:seconds
      timestampPrefix: '[', // Character(s) before timestamp
      timestampSuffix: '] ', // Character(s) after timestamp
    };

    const config = { ...defaults, ...options };

    let formattedText = '';
    let lastTimestampTime = -config.timestampInterval; // Ensure first segment gets timestamp

    // Process each transcript segment
    transcriptData.forEach((segment, index) => {
      const currentOffset = segment.offset;
      const currentText = this.decodeDoubleEncodedEntities(segment.text.trim());
      const currentTime = Math.floor(currentOffset);

      // Add new timestamp if interval has passed
      if (currentTime >= lastTimestampTime + config.timestampInterval) {
        // If not the first segment, add space before timestamp
        if (formattedText.length > 0) {
          formattedText += ' ';
        }

        const timestamp = this.formatTimestamp(
          currentTime,
          config.timestampFormat
        );
        formattedText += `${config.timestampPrefix}${timestamp}${config.timestampSuffix}`;
        lastTimestampTime = currentTime;
      } else if (
        index > 0 &&
        formattedText.length > 0 &&
        !formattedText.endsWith(' ')
      ) {
        // Add space between segments (but not after a timestamp)
        formattedText += ' ';
      }

      // Add the text
      formattedText += currentText;
    });

    return formattedText;
  }

  /**
   * Format seconds into a timestamp string
   * @param {number} seconds - Total seconds
   * @param {string} format - Format string ('MM:SS' or 'HH:MM:SS')
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(seconds, format = 'MM:SS') {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (format === 'HH:MM:SS' || hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Decode double-encoded HTML entities
   * @param {string} text - Text with encoded entities
   * @returns {string} Decoded text
   */
  decodeDoubleEncodedEntities(text) {
    if (!text) return '';

    // First pass: convert &amp; to & (handles double encoding)
    let decoded = text.replace(/&amp;/g, '&');

    // Second pass: decode common HTML entities
    const entities = {
      '&#39;': "'",
      '&quot;': '"',
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' ',
      '&#34;': '"',
      '&#60;': '<',
      '&#62;': '>',
      '&#160;': ' ',
    };

    // Replace each entity with its corresponding character
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    // Handle numeric entities (like &#039;)
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(dec);
    });

    return decoded;
  }
}

export default YoutubeExtractorStrategy;
