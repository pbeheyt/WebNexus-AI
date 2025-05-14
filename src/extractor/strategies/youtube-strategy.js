// src/extractor/strategies/youtube-strategy.js
import { YoutubeTranscript } from 'youtube-transcript';

import BaseExtractor from '../base-extractor.js';
import { normalizeText } from '../utils/text-utils.js';

class YoutubeExtractorStrategy extends BaseExtractor {
  constructor() {
    super('youtube');
  }

  /**
   * Extract and save video data to Chrome storage
   */
  async extractAndSaveContent() {
    try {
      if (document.readyState !== 'complete') {
        await new Promise((resolve) => {
          window.addEventListener('load', resolve);
        });
      }
      const videoData = await this.extractData();
      await this.saveToStorage(videoData);
    } catch (error) {
      this.logger.error('Error in YouTube content extraction:', error);
      await this.saveToStorage({
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      });
    }
  }

  /**
   * Main function to extract all video data
   * @returns {Promise<Object>} The extracted video data
   */
  async extractData() {
    try {
      const rawTitle = this.extractVideoTitle();
      const rawChannel = this.extractChannelName();
      const rawDescription = this.extractVideoDescription();
      const fullVideoUrl = window.location.href;
      const videoId = new URLSearchParams(window.location.search).get('v');

      this.logger.info('Extracting transcript for video ID:', videoId);
      let transcriptText = 'Transcript not available or error occurred.'; // Default
      let transcriptLang = 'unknown';
      try {
        const transcriptData = await YoutubeTranscript.fetchTranscript(fullVideoUrl);
        transcriptText = this.formatTranscript(transcriptData, { timestampInterval: 15 });
        transcriptLang = transcriptData.length > 0 ? transcriptData[0].lang : 'unknown';
        this.logger.info('Transcript data extracted:', transcriptData.length, 'segments');
      } catch (transcriptError) {
        this.logger.warn('Failed to fetch or format transcript:', transcriptError.message);
        if (transcriptError.message?.includes('disabled')) {
          transcriptText = 'Transcript is not available for this video. The creator may have disabled it.';
        } else if (transcriptError.message?.includes('No transcript available')) {
          transcriptText = 'No transcript is available for this video.';
        } else if (transcriptError.message?.includes('too many requests')) {
          transcriptText = 'YouTube is limiting transcript access due to too many requests. Please try again later.';
        } else if (transcriptError.message?.includes('unavailable')) {
          transcriptText = 'The video appears to be unavailable or private.';
        } else {
           transcriptText = `Error getting transcript: ${transcriptError.message}`;
        }
      }
      
      this.logger.info('Starting comment extraction...');
      const commentsResult = await this.extractComments(); // Comments normalized within extractComments
      this.logger.info('Comment extraction complete, status:', commentsResult.status);

      return {
        videoId,
        videoTitle: normalizeText(rawTitle),
        channelName: normalizeText(rawChannel),
        videoDescription: normalizeText(rawDescription),
        transcript: transcriptText, // Transcript has its own complex formatting, not using normalizeText
        comments: commentsResult.items,
        commentStatus: commentsResult.status,
        transcriptLanguage: transcriptLang,
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    } catch (error) {
      // This catch is for errors in the main extractData logic, not transcript-specific ones
      this.logger.error('Critical error in extractData (YouTube):', error);
      let commentsResultOnError = { items: [], status: { state: 'unknown', message: '', count: 0 }};
      try {
        commentsResultOnError = await this.extractComments();
      } catch (commentError) {
        this.logger.error('Error extracting comments during main error handling:', commentError);
      }
      return {
        videoId: new URLSearchParams(window.location.search).get('v'),
        videoTitle: normalizeText(this.extractVideoTitle()),
        channelName: normalizeText(this.extractChannelName()),
        videoDescription: normalizeText(this.extractVideoDescription()),
        transcript: `Failed to extract video data: ${error.message}`,
        comments: commentsResultOnError.items,
        commentStatus: commentsResultOnError.status,
        error: true,
        message: error.message || 'Unknown error in YouTube extractData',
        extractedAt: new Date().toISOString(),
        contentType: this.contentType,
      };
    }
  }

  async extractComments() {
    try {
      this.logger.info(`Extracting all visible YouTube comments...`);
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
      const commentsDisabledMessage = document.querySelector('#comments ytd-message-renderer');
      let commentStatus = { state: 'unknown', message: '', count: 0, commentsExist: false };

      if (commentsDisabledMessage) {
        const disabledText = commentsDisabledMessage.textContent?.toLowerCase() || '';
        if (disabledText.includes('disabled') || disabledText.includes('turned off')) {
          commentStatus = { state: 'disabled', message: 'Comments are disabled for this video', count: 0, commentsExist: false };
          this.logger.info('Comments are disabled for this video');
          return { items: [], status: commentStatus };
        }
      }

      if (!commentElements || commentElements.length === 0) {
        this.logger.info('No comments found or comments not loaded yet');
        commentStatus = { state: 'empty', message: 'No comments available.', count: 0, commentsExist: false };
        return { items: [], status: commentStatus };
      }

      this.logger.info(`Found ${commentElements.length} comments`);
      const comments = [];
      for (const commentElement of commentElements) {
        const authorElement = commentElement.querySelector('#author-text');
        const rawAuthor = authorElement ? authorElement.textContent : 'Unknown user';

        const contentTextElement = commentElement.querySelector('#content-text, yt-formatted-string#content-text');
        let rawCommentText = 'Comment text not found';
        if (contentTextElement) {
          const textSpans = contentTextElement.querySelectorAll('span.yt-core-attributed-string');
          if (textSpans?.length > 0) {
            rawCommentText = Array.from(textSpans).map(span => span.textContent).join(' ');
          } else {
            rawCommentText = contentTextElement.textContent;
          }
        }

        const likeCountElement = commentElement.querySelector('#vote-count-middle');
        const likes = likeCountElement ? (likeCountElement.textContent?.trim() || '0') : '0';

        comments.push({
          author: normalizeText(rawAuthor),
          text: normalizeText(rawCommentText),
          likes,
        });
      }
      commentStatus = { state: 'loaded', message: '', count: comments.length, commentsExist: true };
      return { items: comments, status: commentStatus };
    } catch (error) {
      this.logger.error('Error extracting comments:', error);
      return { items: [], status: { state: 'error', message: `Error extracting comments: ${error.message}`, count: 0, commentsExist: false }};
    }
  }

  extractVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-watch-metadata');
    return titleElement ? titleElement.textContent : 'Title not found'; // Raw
  }

  extractChannelName() {
    const selectors = [
      '#top-row #channel-name yt-formatted-string',
      '#owner-text a.yt-simple-endpoint',
      'ytd-channel-name yt-formatted-string#text',
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent; // Raw
    }
    return 'Channel not found';
  }

  extractVideoDescription() {
    try {
      const microformatElement = document.querySelector('#microformat script[type="application/ld+json"]');
      if (microformatElement) {
        const jsonData = JSON.parse(microformatElement.textContent);
        if (jsonData?.description) {
          this.logger.info('Found description in microformat JSON-LD schema');
          return jsonData.description; // Raw
        }
      }
    } catch (e) {
      this.logger.warn('Error extracting from microformat JSON-LD:', e);
    }
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) return metaDescription.getAttribute('content'); // Raw
    const descriptionElement = document.querySelector('#description-inline-expander');
    if (descriptionElement) return descriptionElement.textContent; // Raw
    return 'Description not available';
  }

  formatTranscript(transcriptData, options = {}) {
    if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
      return 'No transcript data available';
    }
    const defaults = {
      timestampInterval: 60, timestampFormat: 'MM:SS',
      timestampPrefix: '[', timestampSuffix: '] ',
    };
    const config = { ...defaults, ...options };
    let formattedText = '';
    let lastTimestampTime = -config.timestampInterval;

    transcriptData.forEach((segment, index) => {
      const currentOffset = segment.offset / 1000; // Assuming offset is in milliseconds
      const currentText = this.decodeDoubleEncodedEntities(segment.text.trim());
      const currentTime = Math.floor(currentOffset);

      if (currentTime >= lastTimestampTime + config.timestampInterval) {
        if (formattedText.length > 0) formattedText += ' ';
        const timestamp = this.formatTimestamp(currentTime, config.timestampFormat);
        formattedText += `${config.timestampPrefix}${timestamp}${config.timestampSuffix}`;
        lastTimestampTime = currentTime;
      } else if (index > 0 && formattedText.length > 0 && !formattedText.endsWith(' ')) {
        formattedText += ' ';
      }
      formattedText += currentText;
    });
    return formattedText.trim(); // Final trim for the whole transcript
  }

  formatTimestamp(seconds, format = 'MM:SS') {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (format === 'HH:MM:SS' || hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  decodeDoubleEncodedEntities(text) {
    if (!text) return '';
    let decoded = text.replace(/&/g, '&');
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
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    return decoded;
  }
}

export default YoutubeExtractorStrategy;