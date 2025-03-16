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
    if (message && (message.includes('Error') || message.includes('Failed') || message.includes('Cannot') ||
                    message.includes('No transcript') || message.includes('Transcript is not available'))) {
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

    // Show different types with different durations
    // errors: 5 seconds, warnings: 4 seconds, info: 3 seconds
    const displayTime = type === 'error' ? 5000 : (type === 'warning' ? 4000 : 3000);

    // Auto-hide after display time
    this.toastTimeout = setTimeout(() => {
      this.toastElement.classList.remove('show');
    }, displayTime);
  }

  notifyCommentsNotLoaded() {
    const message = 'Comments exist but are not loaded. Scroll down on YouTube to load comments before summarizing.';
    this.showToast(message, 'warning');
    
    // Update status with actionable information
    this.updateStatus(message, false, true);
    
    // Add additional helper text to the status message if available
    if (this.statusElement) {
      const helperText = document.createElement('div');
      helperText.className = 'comment-loading-helper';
      helperText.innerHTML = '<small><strong>Tip:</strong> After scrolling to load comments, click "Summarize Content" again.</small>';
      
      // Remove any existing helper text
      const existingHelper = this.statusElement.querySelector('.comment-loading-helper');
      if (existingHelper) {
        existingHelper.remove();
      }
      
      this.statusElement.appendChild(helperText);
    }
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
   * @param {string} promptType - The prompt type ('default', 'custom', or 'quick')
   */
  notifyPromptTypeToggled(promptType) {
    let typeName = 'Default';
    if (promptType === 'custom') {
      typeName = 'Custom';
    } else if (promptType === 'quick') {
      typeName = 'Quick';
    }
    
    const message = `Switched to ${typeName} prompt`;
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
