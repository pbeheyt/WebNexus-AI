// src/platforms/implementations/gemini-platform.js
const BasePlatform = require('../platform-base');

class GeminiPlatform extends BasePlatform {
  constructor() {
    super('gemini');
  }
  
  isCurrentPlatform() {
    return window.location.hostname.includes('gemini.google.com');
  }
  
  findEditorElement() {
    // Exact selector based on provided HTML
    return document.querySelector('div.ql-editor[contenteditable="true"][aria-multiline="true"]');
  }
  
  findSubmitButton() {
    // Exact selector based on provided HTML
    return document.querySelector('button.send-button');
  }
  
  async insertAndSubmitText(text) {
    const editorElement = this.findEditorElement();
    
    if (!editorElement) {
      this.logger.error('Gemini editor element not found');
      return false;
    }

    try {
      // Focus the editor
      editorElement.focus();
      
      // Clear existing content and set new content
      editorElement.innerHTML = '';
      
      // Create paragraph for each line
      const paragraphs = text.split('\n');
      paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
          const p = document.createElement('p');
          p.textContent = paragraph;
          editorElement.appendChild(p);
        } else {
          // Empty paragraph with br
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          editorElement.appendChild(p);
        }
      });
      
      // Remove placeholder class if present
      if (editorElement.classList.contains('ql-blank')) {
        editorElement.classList.remove('ql-blank');
      }
      
      // Trigger input events
      ['input', 'change'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        editorElement.dispatchEvent(event);
      });
      
      // Wait for UI to update
      return new Promise(resolve => {
        setTimeout(() => {
          const sendButton = this.findSubmitButton();
          
          if (!sendButton) {
            this.logger.error('Gemini send button not found');
            resolve(false);
            return;
          }
          
          // Remove disabled state if present
          if (sendButton.getAttribute('aria-disabled') === 'true') {
            sendButton.removeAttribute('aria-disabled');
          }
          
          // Click the button with multiple events
          ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            sendButton.dispatchEvent(event);
          });
          
          this.logger.info('Text submitted to Gemini successfully');
          resolve(true);
        }, 800);
      });
    } catch (error) {
      this.logger.error('Error inserting text into Gemini:', error);
      return false;
    }
  }
}

module.exports = GeminiPlatform;