// src/platforms/implementations/grok-platform.js
const BasePlatform = require('../platform-base');

/**
 * Grok AI platform implementation
 */
class GrokPlatform extends BasePlatform {
  constructor() {
    super('grok');
  }
  
  isCurrentPlatform() {
    return window.location.hostname === 'grok.com' || 
           window.location.hostname.includes('grok');
  }
  
  findEditorElement() {
    // Find the visible, interactive textarea by combining attribute and style conditions
    const textareas = document.querySelectorAll('textarea[aria-label="Ask Grok anything"]');
    
    // Filter to find the visible one (not hidden, not display:none)
    for (const textarea of textareas) {
      // Skip hidden textareas
      if (textarea.getAttribute('aria-hidden') === 'true' || 
          textarea.style.visibility === 'hidden' ||
          textarea.style.display === 'none' ||
          textarea.tabIndex === -1) {
        continue;
      }
      
      return textarea;
    }
    
    // Fallback to standard selector if filtering didn't work
    return document.querySelector('textarea[aria-label="Ask Grok anything"]');
  }
  
  findSubmitButton() {
    return document.querySelector('button[type="submit"][aria-label="Submit"]');
  }
  
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    
    if (!editorElement) {
      this.logger.error('Grok editor element not found');
      return false;
    }

    try {
      // Simple direct approach to setting the value
      editorElement.value = text;
      
      // Trigger standard input event
      const inputEvent = new Event('input', { bubbles: true });
      editorElement.dispatchEvent(inputEvent);
      
      // Add focus after setting value
      editorElement.focus();
      
      return new Promise(resolve => {
        setTimeout(() => {
          const sendButton = this.findSubmitButton();
          
          if (!sendButton) {
            this.logger.error('Send button not found');
            resolve(false);
            return;
          }
          
          // Enable button if disabled
          if (sendButton.disabled) {
            sendButton.disabled = false;
          }
          
          // Click the button directly
          sendButton.click();
          
          this.logger.info('Text submitted to Grok successfully');
          resolve(true);
        }, 500);
      });
    } catch (error) {
      this.logger.error('Error inserting text into Grok:', error);
      return false;
    }
  }
}

module.exports = GrokPlatform;