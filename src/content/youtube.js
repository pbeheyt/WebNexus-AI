/**
 * YouTube Content Script
 * 
 * Extracts video information and transcript from YouTube pages.
 * Uses the youtube-transcript npm package for reliable transcript extraction.
 */

// Import the YouTube Transcript library
const { YoutubeTranscript } = require('youtube-transcript');

// Flag to indicate script is fully loaded
let contentScriptReady = false;

/**
 * Extract the video title from the page
 * @returns {string} The video title
 */
function extractVideoTitle() {
  const titleElement = document.querySelector('h1.ytd-watch-metadata');
  return titleElement ? titleElement.textContent.trim() : 'Title not found';
}

/**
 * Extract the channel name from the page
 * @returns {string} The channel name
 */
function extractChannelName() {
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
 * Extract the video description from meta tag or description element
 * @returns {string} The video description
 */
function extractVideoDescription() {
  // Try meta tag first
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    return metaDescription.getAttribute('content');
  }
  
  // Try description element as fallback
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
function formatTranscript(transcriptData) {
  if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
    return 'No transcript data available';
  }
  
  // Concatenate all text segments with spaces, removing timestamps
  return transcriptData.map(segment => segment.text.trim())
    .join(' ')
    .replace(/\s+/g, ' '); // Replace multiple spaces with a single space
}

/**
 * Extract top comments from the YouTube video
 * @param {number} maxComments - Maximum number of comments to extract
 * @returns {Array|string} Array of comments or error message string
 */
function extractComments(maxComments = 20) {
  try {
    console.log('Extracting YouTube comments...');
    
    // Get all comment thread elements
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
    
    if (!commentElements || commentElements.length === 0) {
      console.log('No comments found or comments not loaded yet');
      return 'No comments available. Comments might be disabled for this video or not loaded yet.';
    }
    
    console.log(`Found ${commentElements.length} comments`);
    
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
    
    return comments;
  } catch (error) {
    console.error('Error extracting comments:', error);
    return `Error extracting comments: ${error.message}`;
  }
}

/**
 * Main function to extract all video data
 * @returns {Promise<Object>} The extracted video data
 */
async function extractVideoData() {
  try {
    // Extract basic video metadata
    const title = extractVideoTitle();
    const channel = extractChannelName();
    const description = extractVideoDescription();
    
    // Get the current video URL with any parameters
    const fullVideoUrl = window.location.href;
    
    // Extract just the video ID for consistent identification
    const videoId = new URLSearchParams(window.location.search).get('v');
    
    console.log('Extracting transcript for video ID:', videoId);
    console.log('From URL:', fullVideoUrl);
    
    // Extract transcript using the npm package
    const transcriptData = await YoutubeTranscript.fetchTranscript(fullVideoUrl);
    const formattedTranscript = formatTranscript(transcriptData);
    
    console.log('Transcript data extracted:', transcriptData.length, 'segments');
    
    // Extract comments
    console.log('Starting comment extraction...');
    const comments = extractComments();
    console.log('Comment extraction complete, found:', Array.isArray(comments) ? comments.length : 'error');
    
    // Return the complete video data object
    return {
      videoId,
      videoTitle: title,
      channelName: channel,
      videoDescription: description,
      transcript: formattedTranscript,
      comments,
      transcriptLanguage: transcriptData.length > 0 ? transcriptData[0].lang : 'unknown',
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error extracting video data:', error);
    
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
    
    // Return what we could get, with error message for transcript
    return {
      videoId: new URLSearchParams(window.location.search).get('v'),
      videoTitle: extractVideoTitle(),
      channelName: extractChannelName(),
      videoDescription: extractVideoDescription(),
      transcript: errorMessage,
      comments: extractComments(),
      error: true,
      message: errorMessage,
      extractedAt: new Date().toISOString()
    };
  }
}

/**
 * Extract and save video data to Chrome storage
 */
async function extractAndSaveVideoData() {
  try {
    // Wait for the page to be fully loaded if needed
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }
    
    // Give a moment for YouTube's dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Starting YouTube video data extraction...');
    
    // Extract all video data
    const videoData = await extractVideoData();
    
    // Save to Chrome storage
    chrome.storage.local.set({ 
      extractedContent: {
        ...videoData,
        contentType: 'youtube'
      },
      contentReady: true
    }, () => {
      console.log('YouTube video data saved to storage for video:', videoData.videoId);
      console.log('Data extraction timestamp:', videoData.extractedAt);
    });
    
    // Verify storage
    chrome.storage.local.get(['extractedContent', 'contentReady'], function(result) {
      console.log('VERIFICATION - Stored data:', result.extractedContent);
      
      // Log if transcript was found
      if (result.extractedContent && result.extractedContent.transcript) {
        if (result.extractedContent.error) {
          console.log('❌ Transcript extraction issue:', result.extractedContent.message);
        } else {
          console.log('✅ Transcript successfully extracted');
        }
      } else {
        console.log('❌ Transcript extraction failed');
      }
      
      // Log if comments were found
      if (result.extractedContent && Array.isArray(result.extractedContent.comments)) {
        console.log('✅ Comments successfully extracted:', result.extractedContent.comments.length);
      } else {
        console.log('❌ Comment extraction failed or no comments found');
      }
    });
  } catch (error) {
    console.error('Error in YouTube content script:', error);
    
    // Save error message to storage
    chrome.storage.local.set({ 
      extractedContent: {
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: 'youtube'
      },
      contentReady: true
    });
  }
}

// Handle messages from popup and background scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in YouTube content script:', message);
  
  // Respond to ping messages to verify content script is loaded
  if (message.action === 'ping') {
    console.log('Ping received, responding with pong');
    sendResponse({ status: 'pong', ready: contentScriptReady });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'extractContent') {
    console.log('Extract content request received');
    // Start the extraction process
    extractAndSaveVideoData();
    sendResponse({ status: 'Extracting YouTube content...' });
    return true; // Keep the message channel open for async response
  }
});

// Initialize and mark as ready when loaded
const initialize = async () => {
  try {
    console.log('YouTube transcript extractor content script initializing...');
    
    // Mark script as ready
    contentScriptReady = true;
    console.log('YouTube transcript extractor content script ready');
  } catch (error) {
    console.error('Error initializing YouTube content script:', error);
  }
};

// Log when content script loads
console.log('YouTube content script loaded');

// Initialize the content script
initialize();
