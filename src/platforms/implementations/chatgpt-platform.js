// src/platforms/implementations/chatgpt-platform.js
const BasePlatform = require('../platform-base');

/**
 * ChatGPT AI platform implementation
 */
class ChatGptPlatform extends BasePlatform {
  constructor() {
    super('chatgpt');
  }
  
  /**
   * Check if the current page is ChatGPT
   * @returns {boolean} True if on ChatGPT
   */
  isCurrentPlatform() {
    return window.location.href.includes('chatgpt.com');
  }
  
  /**
   * Find ChatGPT's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    return document.querySelector('#prompt-textarea.ProseMirror');
  }
  
  /**
   * Find ChatGPT's submit button
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    return document.querySelector('button[data-testid="send-button"]:not(:disabled)');
  }
  
  /**
   * Insert text into ChatGPT's editor and submit
   * @param {string} text - The text to insert
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    
    if (!editorElement) {
      this.logger.error('ChatGPT editor element not found');
      return false;
    }

    try {
      // Clear existing content
      editorElement.innerHTML = '';
      
      // Split the text into paragraphs by newline
      const paragraphs = text.split('\n');
      
      // Insert each paragraph
      paragraphs.forEach((paragraph) => {
        if (paragraph.trim() === '') {
          // Add empty paragraph with break for blank lines
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          editorElement.appendChild(p);
        } else {
          // Add text paragraph
          const p = document.createElement('p');
          p.textContent = paragraph;
          editorElement.appendChild(p);
        }
      });
      
      // Remove placeholder class if it exists
      const placeholderP = editorElement.querySelector('p.placeholder');
      if (placeholderP) {
        placeholderP.classList.remove('placeholder');
      }
      
      // Focus the editor
      editorElement.focus();
      
      // Dispatch input event to ensure ChatGPT recognizes the change
      const inputEvent = new Event('input', {
        bubbles: true
      });
      editorElement.dispatchEvent(inputEvent);
      
      // Wait a moment for UI to update (longer timeout for reliability)
      return new Promise(resolve => {
        setTimeout(() => {
          // Find enabled send button
          const sendButton = this.findSubmitButton();
          
          if (!sendButton) {
            this.logger.error('ChatGPT send button not found or disabled');
            resolve(false);
            return;
          }
          
          this.logger.info('Send button found, clicking...');
          
          // Create and dispatch multiple events for better compatibility
          ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            sendButton.dispatchEvent(event);
          });
          
          this.logger.info('Text submitted to ChatGPT successfully');
          resolve(true);
        }, 1000);
      });
    } catch (error) {
      this.logger.error('Error inserting text into ChatGPT:', error);
      return false;
    }
  }
}

module.exports = ChatGptPlatform;