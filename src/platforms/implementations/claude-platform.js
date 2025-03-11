// src/platforms/implementations/claude-platform.js
const BasePlatform = require('../platform-base');

/**
 * Claude AI platform implementation
 */
class ClaudePlatform extends BasePlatform {
  constructor() {
    super('claude');
  }
  
  /**
   * Check if the current page is Claude
   * @returns {boolean} True if on Claude
   */
  isCurrentPlatform() {
    return window.location.href.includes('claude.ai');
  }
  
  /**
   * Find Claude's editor element
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    return document.querySelector('p[data-placeholder="How can Claude help you today?"]') || 
           document.querySelector('[contenteditable="true"]');
  }
  
  /**
   * Find Claude's submit button
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    return document.querySelector('button[aria-label="Send message"]') ||
           document.querySelector('button[aria-label="Send Message"]') ||
           document.querySelector('button[type="submit"]') ||
           document.querySelector('button svg path[d*="M208.49,120.49"]')?.closest('button');
  }
  
  /**
   * Insert text into Claude's editor and submit
   * @param {string} text - The text to insert
   * @returns {Promise<boolean>} Success status
   */
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    
    if (!editorElement) {
      this.logger.error('Claude editor element not found');
      return false;
    }

    try {
      // Clear existing content
      editorElement.innerHTML = '';
      
      // Split the text into lines and create paragraphs
      const lines = text.split('\n');
      
      lines.forEach((line, index) => {
        const p = document.createElement('p');
        p.textContent = line;
        editorElement.appendChild(p);
        
        // Add a line break between paragraphs
        if (index < lines.length - 1) {
          editorElement.appendChild(document.createElement('br'));
        }
      });

      // Remove empty states
      if (editorElement.classList.contains('is-empty')) {
        editorElement.classList.remove('is-empty');
      }
      if (editorElement.classList.contains('is-editor-empty')) {
        editorElement.classList.remove('is-editor-empty');
      }

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      
      // Try to focus the editor
      try {
        editorElement.focus();
      } catch (focusError) {
        this.logger.error('Could not focus editor:', focusError);
      }

      // Find and click the send button after a short delay
      return new Promise(resolve => {
        setTimeout(() => {
          const sendButton = this.findSubmitButton();
          
          if (!sendButton) {
            this.logger.error('Send button not found');
            resolve(false);
            return;
          }
          
          // Ensure button is enabled
          if (sendButton.disabled) {
            sendButton.disabled = false;
          }
          
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
          
          this.logger.info('Send button clicked');
          resolve(true);
        }, 1000);
      });
    } catch (error) {
      this.logger.error('Error inserting text:', error);
      return false;
    }
  }
}

module.exports = ClaudePlatform;