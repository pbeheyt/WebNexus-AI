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
}