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
  
  findSubmitButton() {
    return document.querySelector('button[type="submit"][aria-label="Submit"]');
  }
  // No override needed for _insertTextIntoEditor - default implementation works
  // No override needed for _clickSubmitButton - default implementation works
}

module.exports = GrokPlatform;
