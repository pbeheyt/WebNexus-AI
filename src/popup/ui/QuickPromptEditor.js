// src/popup/ui/QuickPromptEditor.js
export default class QuickPromptEditor {
  constructor(element, onChange, preferenceService = null, statusManager = null) {
    this.element = element;
    this.onChange = onChange;
    this.preferenceService = preferenceService;
    this.statusManager = statusManager;
    this.contentType = null;
    this.textarea = null;
    this.charCounter = null;
    // Don't try to bind handleInput here as it's not defined yet
  }

  async initialize(contentType) {
    this.contentType = contentType;
    if (!this.element) return;
    
    try {
      // Check for previously consumed quick prompt
      const consumptionData = await chrome.storage.local.get('quick_prompt_consumed');
      const wasConsumed = consumptionData.quick_prompt_consumed && 
                        consumptionData.quick_prompt_consumed.contentType === contentType;
      
      // Clear if consumed
      if (wasConsumed) {
        console.log(`Found consumed quick prompt for ${contentType}, clearing it`);
        
        // Clear the prompt for this content type
        if (this.preferenceService) {
          await this.preferenceService.clearQuickPromptText(contentType);
          console.log(`Cleared previously consumed quick prompt for ${contentType}`);
        }
        
        // Reset consumption flag
        await chrome.storage.local.remove('quick_prompt_consumed');
        console.log('Reset quick_prompt_consumed flag');
      }
    
      // Clear container
      this.element.innerHTML = '';
      
      // Create textarea with appropriate placeholder
      this.textarea = document.createElement('textarea');
      this.textarea.className = 'quick-prompt-textarea';
      this.textarea.placeholder = this.getPlaceholderText(contentType);
      
      // Character counter
      this.charCounter = document.createElement('div');
      this.charCounter.className = 'char-counter';
      
      // Load saved text if available
      if (this.preferenceService) {
        const savedText = await this.preferenceService.getQuickPromptText(contentType);
        if (savedText) {
          this.textarea.value = savedText;
          this.charCounter.textContent = `${savedText.length} characters`;
        } else {
          this.charCounter.textContent = '0 characters';
        }
      }
      
      // Define handleInput as a proper method with proper binding
      this.handleInput = async (event) => {
        const text = this.textarea.value;
        this.charCounter.textContent = `${text.length} characters`;
        
        // Apply warning style for very long prompts
        if (text.length > 2000) {
          this.charCounter.classList.add('warning');
        } else {
          this.charCounter.classList.remove('warning');
        }
        
        // Save to storage if preference service available
        if (this.preferenceService) {
          await this.preferenceService.saveQuickPromptText(this.contentType, text);
        }
        
        // Notify parent
        if (this.onChange) {
          this.onChange(text);
        }
        
        // Auto-grow the textarea
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(130, Math.min(this.textarea.scrollHeight, 300)) + 'px';
      };
      
      this.textarea.addEventListener('input', this.handleInput);
      
      // Add focus/blur listeners for enhanced UI feedback
      // Store references to handlers for proper cleanup
      this.focusHandler = () => {
        this.element.classList.add('editor-focused');
      };
      
      this.blurHandler = () => {
        this.element.classList.remove('editor-focused');
      };
      
      this.textarea.addEventListener('focus', this.focusHandler);
      this.textarea.addEventListener('blur', this.blurHandler);
      
      // Append elements
      this.element.appendChild(this.textarea);
      this.element.appendChild(this.charCounter);
      
      // Initialize the height for auto-grow
      setTimeout(() => {
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(130, Math.min(this.textarea.scrollHeight, 300)) + 'px';
      }, 0);
    } catch (error) {
      console.error('Error initializing quick prompt editor:', error);
      // Fallback to basic initialization
      this.element.innerHTML = `
        <textarea class="quick-prompt-textarea" placeholder="Enter your prompt..."></textarea>
        <div class="char-counter">0 characters</div>
      `;
    }
  }
  
  getPlaceholderText(contentType) {
    switch (contentType) {
      case 'youtube':
        return 'Enter your prompt for analyzing this YouTube video...';
      case 'reddit':
        return 'Enter your prompt for analyzing this Reddit post...';
      case 'pdf':
        return 'Enter your prompt for analyzing this PDF document...';
      case 'selected_text':
        return 'Enter your prompt for analyzing this selected text...';
      case 'general':
        return 'Enter your custom prompt for analyzing this page...';
      default:
        return 'Enter your custom prompt for analyzing this page...';
    }
  }
  
  /**
   * Get the current prompt text
   * @returns {string} - The current prompt text
   */
  getText() {
    return this.textarea ? this.textarea.value : '';
  }
  
  /**
   * Set the prompt text
   * @param {string} text - The text to set
   */
  async setText(text) {
    if (this.textarea) {
      this.textarea.value = text;
      
      // Update character counter
      if (this.charCounter) {
        this.charCounter.textContent = `${text.length} characters`;
        
        if (text.length > 2000) {
          this.charCounter.classList.add('warning');
        } else {
          this.charCounter.classList.remove('warning');
        }
      }
      
      // Adjust height for auto-grow
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.max(130, Math.min(this.textarea.scrollHeight, 300)) + 'px';
      
      // Save to storage if preference service available
      if (this.preferenceService && this.contentType) {
        await this.preferenceService.saveQuickPromptText(this.contentType, text);
      }
      
      // Notify parent
      if (this.onChange) {
        this.onChange(text);
      }
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.textarea) {
      // Remove event listeners
      this.textarea.removeEventListener('input', this.handleInput);
      
      // Store references to the focus/blur handlers during initialization
      if (this.focusHandler) {
        this.textarea.removeEventListener('focus', this.focusHandler);
      }
      
      if (this.blurHandler) {
        this.textarea.removeEventListener('blur', this.blurHandler);
      }
    }
    
    // Clear container
    if (this.element) {
      this.element.innerHTML = '';
    }
    
    this.textarea = null;
    this.charCounter = null;
  }
}