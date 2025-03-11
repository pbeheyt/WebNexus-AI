// popup/ui/StatusManager.js
export default class StatusManager {
  constructor(element, summarizeBtn) {
    this.element = element;
    this.summarizeBtn = summarizeBtn;
  }

  updateStatus(message, isProcessing = false, isSupported = true) {
    if (this.element) {
      this.element.textContent = message || '';
    }
    
    if (this.summarizeBtn) {
      this.summarizeBtn.disabled = !isSupported || isProcessing;
    }
  }
}