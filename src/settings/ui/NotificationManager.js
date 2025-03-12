// Manages transient notifications
export default class NotificationManager {
  constructor(notificationElement) {
    this.element = notificationElement;
    this.timeoutId = null;
  }

  show(message, duration = 3000) {
    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    // Update message and show
    this.element.textContent = message;
    this.element.classList.add('show');
    
    // Hide after duration
    this.timeoutId = setTimeout(() => {
      this.element.classList.remove('show');
    }, duration);
  }

  error(message, duration = 5000) {
    this.show(message, duration);
    this.element.classList.add('error');
    
    // Remove error class after hiding
    setTimeout(() => {
      this.element.classList.remove('error');
    }, duration + 300);
  }

  success(message, duration = 3000) {
    this.show(message, duration);
    this.element.classList.add('success');
    
    // Remove success class after hiding
    setTimeout(() => {
      this.element.classList.remove('success');
    }, duration + 300);
  }

  hide() {
    this.element.classList.remove('show');
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}