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
  
  /**
   * Find the active Grok editor element using structural and class-based detection strategies
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    // Strategy 1: Find by distinctive class combinations and element attributes
    const potentialTextareas = document.querySelectorAll('textarea.w-full');
    
    for (const textarea of potentialTextareas) {
      // Check if it has distinctive textarea Grok classes 
      if (textarea.className.includes('bg-transparent') && 
          textarea.className.includes('focus:outline-none')) {
        return textarea;
      }
    }
    
    // Strategy 2: Find by structural position and style characteristics
    const allTextareas = document.querySelectorAll('textarea');
    
    for (const textarea of allTextareas) {
      const style = window.getComputedStyle(textarea);
      
      // Check for Grok's typical textarea styling pattern
      if (style.resize === 'none' && 
          textarea.getAttribute('dir') === 'auto') {
        return textarea;
      }
    }
    
    return null;
  }
  
  /**
   * Find Grok's submit button through structured identification patterns
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    // Strategy 1: Type + aria-label (with localization support)
    const submitLabels = ['Submit', 'Soumettre', 'Enviar', '提交'];
    for (const label of submitLabels) {
      const button = document.querySelector(`button[type="submit"][aria-label="${label}"]`);
      if (button) return button;
    }
    
    // Strategy 2: Type + SVG path pattern detection
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    for (const button of submitButtons) {
      // Look for arrow up SVG pattern
      const svg = button.querySelector('svg');
      if (svg) {
        const path = svg.querySelector('path');
        if (path) {
          const d = path.getAttribute('d');
          // Check for characteristic upward arrow path
          if (d && (d.includes('M12 4V21') || d.includes('M12 4L19 11') || d.includes('M5 11L12 4'))) {
            return button;
          }
        }
      }
    }
    
    // Strategy 3: Fallback to any submit button
    return document.querySelector('button[type="submit"]');
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