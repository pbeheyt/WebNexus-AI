// src/services/MessageFormatter.js

/**
 * Utility service to format conversation messages for different AI platforms
 */
class MessageFormatter {
  /**
   * Create a message formatter
   * @param {string} platformId - Platform identifier (chatgpt, claude, etc.)
   */
  constructor(platformId) {
    this.platformId = platformId;
  }
  
  /**
   * Format messages for API request
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Object} Formatted messages object
   */
  formatForApi(messages) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return null;
    }
    
    // Use different formatting based on platform
    switch (this.platformId) {
      case 'chatgpt':
        return this.formatForOpenAI(messages);
      case 'claude':
        return this.formatForClaude(messages);
      case 'gemini':
        return this.formatForGemini(messages);
      case 'mistral':
      case 'deepseek':
      case 'grok':
        return this.formatForOpenAI(messages); // These use OpenAI-compatible format
      default:
        return this.formatForOpenAI(messages);
    }
  }
  
  /**
   * Format messages for OpenAI/ChatGPT API
   * @param {Array} messages - Array of message objects
   * @returns {Array} Formatted messages array
   */
  formatForOpenAI(messages) {
    return messages.map(msg => {
      // Map internal role names to OpenAI roles
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';
      else if (msg.role === 'system') role = 'system';
      
      return {
        role,
        content: msg.content
      };
    });
  }
  
  /**
   * Format messages for Claude API
   * @param {Array} messages - Array of message objects
   * @returns {Array} Formatted messages array for Claude
   */
  formatForClaude(messages) {
    return messages.map(msg => {
      // Map internal role names to Claude roles
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';
      
      return {
        role,
        content: [
          {
            type: "text",
            text: msg.content
          }
        ]
      };
    });
  }
  
  /**
   * Format messages for Gemini API
   * @param {Array} messages - Array of message objects
   * @returns {Array} Formatted messages array for Gemini
   */
  formatForGemini(messages) {
    // Gemini uses a different format with contents array
    const formattedContents = [];
    
    // Process messages in order
    messages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      
      formattedContents.push({
        role,
        parts: [{ text: msg.content }]
      });
    });
    
    return formattedContents;
  }
  
  /**
   * Format conversation history as text
   * @param {Array} messages - Conversation messages
   * @returns {string} Formatted conversation history text
   */
  formatAsText(messages) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return '';
    }
    
    return messages.map(msg => {
      const roleLabel = msg.role.toUpperCase();
      return `${roleLabel}: ${msg.content}`;
    }).join('\n\n');
  }
  
  /**
   * Create truncated conversation history to fit within token limits
   * @param {Array} messages - Conversation messages
   * @param {number} maxTokens - Maximum token limit 
   * @returns {Array} Truncated message array
   */
  createTruncatedHistory(messages, maxTokens = 2000) {
    if (!messages || messages.length === 0) {
      return [];
    }
    
    // Rough token estimation: 1 token = ~4 characters
    const estimateTokens = (text) => Math.ceil(text.length / 4);
    
    // Start with most recent messages and work backwards
    const reversedMessages = [...messages].reverse();
    const result = [];
    let tokenCount = 0;
    
    for (const message of reversedMessages) {
      const messageTokens = estimateTokens(message.content);
      
      // If adding this message would exceed token limit, stop
      if (tokenCount + messageTokens > maxTokens) {
        break;
      }
      
      // Add message to result and update token count
      result.unshift(message); // Add to front to maintain order
      tokenCount += messageTokens;
    }
    
    return result;
  }
}

module.exports = MessageFormatter;