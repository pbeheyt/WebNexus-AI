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
   * that accommodate UI changes and render resilient identification
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    // Strategy 1: Find by distinctive class combinations and element attributes
    const potentialTextareas = document.querySelectorAll('textarea.w-full');
    
    for (const textarea of potentialTextareas) {
      // Check if it has distinctive textarea Grok classes 
      if (textarea.className.includes('bg-transparent') && 
          textarea.className.includes('focus:outline-none') &&
          this.isVisibleElement(textarea)) {
        return textarea;
      }
    }
    
    // Strategy 2: Find by structural position and style characteristics
    const allTextareas = document.querySelectorAll('textarea');
    
    for (const textarea of allTextareas) {
      const style = window.getComputedStyle(textarea);
      
      // Check for Grok's typical textarea styling pattern
      if (style.resize === 'none' && 
          this.isVisibleElement(textarea) && 
          textarea.getAttribute('dir') === 'auto') {
        return textarea;
      }
    }
    
    return null;
  }
  
  /**
   * Helper method to determine if an element is visible and interactive
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} True if the element is visible and interactive
   */
  isVisibleElement(element) {
    if (!element) return false;
    
    // Check for explicit hidden attributes
    if (element.getAttribute('aria-hidden') === 'true' || 
        element.style.visibility === 'hidden' ||
        element.style.display === 'none' ||
        element.tabIndex === -1) {
      return false;
    }
    
    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    // Check if element has zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    return true;
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