// src/extractor/strategies/youtube-strategy.js
const BaseExtractor = require('../base-extractor');
const { YoutubeTranscript } = require('youtube-transcript');

// Storage key for accessing settings
const STORAGE_KEY = 'custom_prompts_by_type';

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
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }
      
      // Give a moment for YouTube's dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
        extractedAt: new Date().toISOString()
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
      const transcriptData = await YoutubeTranscript.fetchTranscript(fullVideoUrl);
      const formattedTranscript = this.formatTranscript(transcriptData);
      
      this.logger.info('Transcript data extracted:', transcriptData.length, 'segments');
      
      // Check if comment analysis is enabled in user preferences
      const shouldExtractComments = await this.shouldExtractComments();
      
      // Extract comments only if needed
      let comments = [];
      let commentStatus = { 
        state: "skipped", 
        message: "Comment extraction skipped based on user preferences", 
        count: 0,
        commentsExist: false
      };
      
      if (shouldExtractComments) {
        this.logger.info('Starting comment extraction...');
        const commentsResult = await this.extractComments();
        comments = commentsResult.items;
        commentStatus = commentsResult.status;
        this.logger.info('Comment extraction complete, status:', commentStatus);
      } else {
        this.logger.info('Comment extraction skipped - analysis disabled in user preferences');
      }
      
      // Return the complete video data object
      return {
        videoId,
        videoTitle: title,
        channelName: channel,
        videoDescription: description,
        transcript: formattedTranscript,
        comments,
        commentStatus,
        transcriptLanguage: transcriptData.length > 0 ? transcriptData[0].lang : 'unknown',
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error extracting video data:', error);
      
      // Determine error type and provide appropriate message
      let errorMessage = 'Failed to extract transcript';
      
      if (error.message && error.message.includes('Transcript is disabled')) {
        errorMessage = 'Transcript is not available for this video. The creator may have disabled it.';
      } else if (error.message && error.message.includes('No transcript available')) {
        errorMessage = 'No transcript is available for this video.';
      } else if (error.message && error.message.includes('too many requests')) {
        errorMessage = 'YouTube is limiting transcript access due to too many requests. Please try again later.';
      } else if (error.message && error.message.includes('unavailable')) {
        errorMessage = 'The video appears to be unavailable or private.';
      } else {
        errorMessage = `Error getting transcript: ${error.message}`;
      }
      
      // Get comments despite transcript error, using our new method
      let commentsResult = { items: [], status: { state: "unknown", message: "", count: 0 } };
      try {
        // Only extract comments if needed
        const shouldExtractComments = await this.shouldExtractComments();
        if (shouldExtractComments) {
          commentsResult = await this.extractComments();
        } else {
          commentsResult = { 
            items: [], 
            status: { 
              state: "skipped", 
              message: "Comment extraction skipped based on user preferences", 
              count: 0,
              commentsExist: false
            } 
          };
        }
      } catch (commentError) {
        this.logger.error('Error extracting comments after transcript error:', commentError);
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
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Check if comments should be extracted based on user preferences
   * @returns {Promise<boolean>} Whether comments should be extracted
   */
  async shouldExtractComments() {
    try {
      // Get prompt preferences
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get('default_prompt_preferences', (data) => resolve(data));
      });
      
      // Check if comment analysis is explicitly disabled
      if (result && 
          result.default_prompt_preferences && 
          result.default_prompt_preferences.youtube && 
          result.default_prompt_preferences.youtube.commentAnalysis === false) {
        return false;
      }
      
      // Also check if we're using a custom prompt that might require comments
      const promptTypePrefs = await new Promise((resolve) => {
        chrome.storage.sync.get('prompt_type_preference', (data) => resolve(data));
      });
      
      const usingCustomPrompt = promptTypePrefs && 
                                promptTypePrefs.prompt_type_preference && 
                                promptTypePrefs.prompt_type_preference.youtube === 'custom';
      
      if (usingCustomPrompt) {
        // For custom prompts, we could parse the content to check for comment analysis
        // requirements, but for now we'll assume they might need comments
        return true;
      }
      
      // Default to extracting comments if preference isn't explicitly set
      return true;
    } catch (error) {
      this.logger.warn('Error checking comment extraction preference:', error);
      // Default to extracting comments in case of error
      return true;
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
      'ytd-channel-name yt-formatted-string#text'
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
      const microformatElement = document.querySelector('#microformat script[type="application/ld+json"]');
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
    const descriptionElement = document.querySelector('#description-inline-expander');
    if (descriptionElement) {
      return descriptionElement.textContent.trim();
    }
    
    return 'Description not available';
  }

  /**
   * Format transcript data into a continuous text without timestamps
   * @param {Array} transcriptData - The transcript data from youtube-transcript
   * @returns {string} The formatted transcript
   */
  formatTranscript(transcriptData) {
    if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
      return 'No transcript data available';
    }
    
    // Concatenate all text segments with spaces, removing timestamps
    const rawTranscript = transcriptData.map(segment => segment.text.trim())
      .join(' ')
      .replace(/\s+/g, ' '); // Replace multiple spaces with a single space
      
    // Decode HTML entities - specifically handling double-encoded entities
    return this.decodeDoubleEncodedEntities(rawTranscript);
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
      '&#160;': ' '
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

  /**
   * Extract top comments from the YouTube video
   * @returns {Promise<Array|string>} Promise resolving to array of comments or error message string
   */
  async extractComments() {
    try {
      // Get configured max comments or use default
      let maxComments = 20; // Default value
      let commentAnalysisEnabled = false;
      
      try {
        // Get extraction settings
        const result = await new Promise((resolve) => {
          chrome.storage.sync.get(STORAGE_KEY, (data) => resolve(data));
        });
        
        if (result && result[STORAGE_KEY] && 
            result[STORAGE_KEY].youtube && 
            result[STORAGE_KEY].youtube.settings && 
            result[STORAGE_KEY].youtube.settings.maxComments) {
          maxComments = result[STORAGE_KEY].youtube.settings.maxComments;
        }
        
        // Check if comment analysis is enabled in default prompt preferences
        const promptPrefs = await new Promise((resolve) => {
          chrome.storage.sync.get('default_prompt_preferences', (data) => resolve(data));
        });
        
        if (promptPrefs && 
            promptPrefs.default_prompt_preferences && 
            promptPrefs.default_prompt_preferences.youtube && 
            promptPrefs.default_prompt_preferences.youtube.commentAnalysis === true) {
          commentAnalysisEnabled = true;
        }
      } catch (error) {
        this.logger.warn('Error fetching settings:', error);
      }
      
      this.logger.info(`Extracting up to ${maxComments} YouTube comments...`);
      
      // Check if comment section exists but is not loaded
      const commentSection = document.getElementById('comments');
      const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
      const commentsDisabledMessage = document.querySelector('#comments ytd-message-renderer');
      
      // Return structured comment status object
      let commentStatus = {
        state: "unknown",
        message: "",
        count: 0,
        commentsExist: false
      };
      
      // Check if comments are disabled entirely
      if (commentsDisabledMessage) {
        const disabledText = commentsDisabledMessage.textContent.toLowerCase();
        if (disabledText.includes('disabled') || disabledText.includes('turned off')) {
          commentStatus = {
            state: "disabled",
            message: "Comments are disabled for this video",
            count: 0,
            commentsExist: false
          };
          
          this.logger.info('Comments are disabled for this video');
          return {
            items: [],
            status: commentStatus
          };
        }
      }
      
      // If comment section exists but no comments are loaded
      if (commentSection && commentElements.length === 0 && !commentsDisabledMessage) {
        commentStatus = {
          state: "not_loaded",
          message: "Comments exist but are not loaded. Scroll down on the YouTube page to load comments.",
          count: 0,
          commentsExist: true
        };
        
        this.logger.info('Comments section exists but comments not loaded - user needs to scroll');
        
        if (commentAnalysisEnabled) {
          // Save notification flag to local storage
          await chrome.storage.local.set({ 
            youtubeCommentsNotLoaded: true 
          });
          
          // Send message to background script
          chrome.runtime.sendMessage({
            action: 'youtubeCommentsNotLoaded'
          });
        }
        
        return {
          items: [],
          status: commentStatus
        };
      }
      
      // Get all comment thread elements
      if (!commentElements || commentElements.length === 0) {
        this.logger.info('No comments found or comments not loaded yet');
        
        commentStatus = {
          state: "empty",
          message: "No comments available. Comments might be disabled for this video.",
          count: 0,
          commentsExist: false
        };
        
        return {
          items: [],
          status: commentStatus
        };
      }
      
      this.logger.info(`Found ${commentElements.length} comments`);
      
      // Extract data from each comment
      const comments = [];
      
      for (let i = 0; i < Math.min(commentElements.length, maxComments); i++) {
        const commentElement = commentElements[i];
        
        // Extract author name
        const authorElement = commentElement.querySelector('#author-text');
        const author = authorElement ? authorElement.textContent.trim() : 'Unknown user';
        
        // Extract comment text
        const contentTextElement = commentElement.querySelector('#content-text, yt-formatted-string#content-text');
        let commentText = 'Comment text not found';
        
        if (contentTextElement) {
          // Try to get text spans
          const textSpans = contentTextElement.querySelectorAll('span.yt-core-attributed-string');
          if (textSpans && textSpans.length > 0) {
            commentText = Array.from(textSpans)
              .map(span => span.textContent.trim())
              .join(' ');
          } else {
            // Fallback - try to get text directly
            commentText = contentTextElement.textContent.trim();
          }
        }
        
        // Extract likes if available
        const likeCountElement = commentElement.querySelector('#vote-count-middle');
        const likes = likeCountElement ? likeCountElement.textContent.trim() : '0';
        
        comments.push({
          author,
          text: commentText,
          likes
        });
      }
      
      // Set comment status for successfully loaded comments
      commentStatus = {
        state: "loaded",
        message: "",
        count: comments.length,
        commentsExist: true
      };
      
      return {
        items: comments,
        status: commentStatus
      };
    } catch (error) {
      this.logger.error('Error extracting comments:', error);
      
      return {
        items: [],
        status: {
          state: "error",
          message: `Error extracting comments: ${error.message}`,
          count: 0,
          commentsExist: false
        }
      };
    }
  }
}

module.exports = YoutubeExtractorStrategy;