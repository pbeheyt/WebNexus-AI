/**
 * General Content Script
 * 
 * Extracts text content from general web pages.
 * Handles DOM traversal to find and extract visible text.
 */

// Flag to indicate script is fully loaded
let contentScriptReady = false;

/**
 * Extract the page title
 * @returns {string} The page title
 */
function extractPageTitle() {
  return document.title || 'Unknown Title';
}

/**
 * Extract the page URL
 * @returns {string} The current page URL
 */
function extractPageUrl() {
  return window.location.href;
}

/**
 * Extract meta description from the page
 * @returns {string|null} The meta description or null if not found
 */
function extractMetaDescription() {
  const metaDescription = document.querySelector('meta[name="description"]');
  return metaDescription ? metaDescription.getAttribute('content') : null;
}

/**
 * Extract all visible text from the page
 * @returns {string} All visible text content
 */
function extractVisibleText() {
  let bodyText = '';
  
  /**
   * Recursive function to extract text from DOM node
   * @param {Node} node - The DOM node to extract text from
   * @returns {string} Extracted text
   */
  function extractText(node) {
    // Handle text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim().length > 0) {
        return node.textContent;
      }
      return '';
    }
    
    // Handle element nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Skip hidden or non-content elements
      const excludedTags = [
        'script', 'style', 'img', 'svg', 'footer', 'nav', 
        'noscript', 'iframe', 'video', 'audio', 'canvas',
        'code', 'pre', 'meta', 'link', 'head', 'header'
      ];
      
      if (excludedTags.includes(tagName)) {
        return '';
      }
      
      // Check if element is visible using computed style
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return '';
      }
      
      // Extract text from child nodes
      let text = '';
      node.childNodes.forEach(child => {
        text += extractText(child);
      });
      
      // Add spacing based on element type
      if (['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
        text += '\n\n';
      } else if (['br'].includes(tagName)) {
        text += '\n';
      } else if (['span', 'a', 'strong', 'em', 'b', 'i'].includes(tagName)) {
        text += ' ';
      }
      
      return text;
    }
    
    return '';
  }
  
  // Start extraction from body
  document.body.childNodes.forEach(child => {
    bodyText += extractText(child);
  });
  
  // Clean up multiple line breaks and spaces
  return bodyText
    .replace(/\n{3,}/g, '\n\n')  // Replace 3+ line breaks with 2
    .replace(/\s{2,}/g, ' ')     // Replace 2+ spaces with 1
    .trim();
}

/**
 * Extract main content from the page using heuristics
 * @returns {string} Main content text
 */
function extractMainContent() {
  // Try to find the main content element using common selectors
  const mainSelectors = [
    'main',
    'article',
    '#content',
    '.content',
    '.main',
    '.article',
    '.post',
    '.entry',
    '[role="main"]'
  ];
  
  for (const selector of mainSelectors) {
    const mainElement = document.querySelector(selector);
    if (mainElement) {
      const mainText = extractVisibleText(mainElement);
      // Only use main content if it has substantial text
      if (mainText.length > 200) {
        return mainText;
      }
    }
  }
  
  // Fallback to extracting all visible text
  return extractVisibleText();
}

/**
 * Attempt to extract the author name from the page
 * @returns {string|null} The author name or null if not found
 */
function extractAuthor() {
  // Try meta tags first
  const metaAuthor = document.querySelector('meta[name="author"], meta[property="author"], meta[property="article:author"]');
  if (metaAuthor) {
    return metaAuthor.getAttribute('content');
  }
  
  // Try common author selectors
  const authorSelectors = [
    '.author',
    '.byline',
    '.post-author',
    '.entry-author',
    '[rel="author"]'
  ];
  
  for (const selector of authorSelectors) {
    const authorElement = document.querySelector(selector);
    if (authorElement && authorElement.textContent.trim()) {
      return authorElement.textContent.trim();
    }
  }
  
  return null;
}

/**
 * Main function to extract all page data
 * @returns {Object} The extracted page data
 */
function extractPageData() {
  try {
    // Get user selection if any
    const selectedText = window.getSelection().toString().trim();
    
    // Extract basic page metadata
    const title = extractPageTitle();
    const url = extractPageUrl();
    const description = extractMetaDescription();
    const author = extractAuthor();
    
    // Extract content (either selection or main content)
    const content = selectedText || extractMainContent();
    
    // Return the complete page data object
    return {
      pageTitle: title,
      pageUrl: url,
      pageDescription: description,
      pageAuthor: author,
      content: content,
      isSelection: !!selectedText,
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error extracting page data:', error);
    
    // Return what we could get, with error message
    return {
      pageTitle: extractPageTitle(),
      pageUrl: extractPageUrl(),
      content: 'Error extracting content: ' + error.message,
      error: true,
      message: error.message || 'Unknown error occurred',
      extractedAt: new Date().toISOString()
    };
  }
}

/**
 * Extract and save page data to Chrome storage
 */
function extractAndSavePageData() {
  try {
    console.log('Starting general page data extraction...');
    
    // Extract all page data
    const pageData = extractPageData();
    
    // Save to Chrome storage
    chrome.storage.local.set({ 
      extractedContent: {
        ...pageData,
        contentType: 'general'
      },
      contentReady: true
    }, () => {
      console.log('General page data saved to storage:', pageData.pageTitle);
      console.log('Data extraction timestamp:', pageData.extractedAt);
    });
    
    // Verify storage
    chrome.storage.local.get(['extractedContent', 'contentReady'], function(result) {
      console.log('VERIFICATION - Stored data:', result.extractedContent);
      
      if (result.extractedContent) {
        if (result.extractedContent.error) {
          console.log('❌ Page extraction issue:', result.extractedContent.message);
        } else {
          console.log('✅ Page successfully extracted');
        }
        
        // Log content length
        if (result.extractedContent.content) {
          console.log(`✅ Content extracted: ${result.extractedContent.content.length} characters`);
        } else {
          console.log('❌ No content extracted');
        }
      } else {
        console.log('❌ Page extraction failed');
      }
    });
  } catch (error) {
    console.error('Error in general content script:', error);
    
    // Save error message to storage
    chrome.storage.local.set({ 
      extractedContent: {
        error: true,
        message: error.message || 'Unknown error occurred',
        extractedAt: new Date().toISOString(),
        contentType: 'general'
      },
      contentReady: true
    });
  }
}

// Handle messages from popup and background scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in general content script:', message);
  
  // Respond to ping messages to verify content script is loaded
  if (message.action === 'ping') {
    console.log('Ping received, responding with pong');
    sendResponse({ status: 'pong', ready: contentScriptReady });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'extractContent') {
    console.log('Extract content request received');
    // Start the extraction process
    extractAndSavePageData();
    sendResponse({ status: 'Extracting general content...' });
    return true; // Keep the message channel open for async response
  }
});

// Initialize and mark as ready when loaded
const initialize = () => {
  try {
    console.log('General content script initializing...');
    
    // Mark script as ready
    contentScriptReady = true;
    console.log('General content script ready');
  } catch (error) {
    console.error('Error initializing general content script:', error);
  }
};

// Log when content script loads
console.log('General content script loaded');

// Initialize the content script
initialize();
