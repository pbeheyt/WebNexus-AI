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
}

module.exports = MessageFormatter;
