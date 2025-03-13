// popup/ui/StatusManager.js
export default class StatusManager {
  constructor(statusElement, summarizeBtn, toastElement = null) {
    this.statusElement = statusElement;
    this.summarizeBtn = summarizeBtn;
    this.toastElement = toastElement || document.getElementById('toast');
    this.toastTimeout = null;
  }

  updateStatus(message, isProcessing = false, isSupported = true) {
    // Update status text element
    if (this.statusElement) {
      this.statusElement.textContent = message || '';
    }
    
    // Update button state
    if (this.summarizeBtn) {
      this.summarizeBtn.disabled = !isSupported || isProcessing;
      
      // Update button text based on state
      if (isProcessing) {
        this.summarizeBtn.textContent = 'Processing...';
      } else {
        this.summarizeBtn.textContent = 'Summarize Content';
      }
    }
    
    // Show important messages as toast notifications
    if (message && (message.includes('Error') || message.includes('Failed') || message.includes('Cannot'))) {
      this.showToast(message, 'error');
    }
  }
  
  showToast(message, type = 'info') {
    if (!this.toastElement) return;
    
    // Clear any existing timeout
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    // Update toast content and class
    this.toastElement.textContent = message;
    this.toastElement.className = `toast ${type}`;
    
    // Show the toast
    setTimeout(() => {
      this.toastElement.classList.add('show');
    }, 10);
    
    // Auto-hide after 3 seconds
    this.toastTimeout = setTimeout(() => {
      this.toastElement.classList.remove('show');
    }, 3000);
  }

  /**
   * Show notification for parameter change in default prompt config
   * @param {string} paramType - The parameter type (e.g., 'length', 'style')
   * @param {string} paramName - The parameter name
   * @param {string} newValue - The new parameter value
   */
  notifyParameterChanged(paramType, paramName, newValue) {
    const readableParamName = this.formatParameterName(paramName);
    const message = `Default prompt preferences ${readableParamName} updated to ${newValue}`;
    this.updateStatus(message, false, true);
  }

  /**
   * Show notification for custom prompt selection
   * @param {string} promptName - The name of the selected prompt
   */
  notifyCustomPromptChanged(promptName) {
    const message = `Custom prompt changed to "${promptName}"`;
    this.updateStatus(message, false, true);
  }

  /**
   * Show notification for prompt type toggle
   * @param {boolean} isDefault - Whether toggled to default (true) or custom (false)
   */
  notifyPromptTypeToggled(isDefault) {
    const message = `Switched to ${isDefault ? 'Default' : 'Custom'} prompt`;
    this.updateStatus(message, false, true);
  }

  /**
   * Format parameter name for display
   * @param {string} paramName - The parameter name in camelCase
   * @returns {string} - Formatted parameter name
   */
  formatParameterName(paramName) {
    // Convert camelCase to readable format (e.g., "commentAnalysis" to "Comment Analysis")
    return paramName.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
  }
}