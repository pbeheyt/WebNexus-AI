// popup/ui/PlatformSelector.js
export default class PlatformSelector {
  constructor(element, onChange) {
    this.element = element;
    this.onChange = onChange;
  }

  render(platforms, selectedPlatformId) {
    if (!this.element || !platforms?.length) return;
    
    // Get current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    
    // Clear existing content
    this.element.innerHTML = '';
    
    // Create platform options
    platforms.forEach(platform => {
      // Modify iconUrl for ChatGPT based on theme
      let iconUrl = platform.iconUrl;
      if (platform.id === 'chatgpt') {
        iconUrl = chrome.runtime.getURL(currentTheme === 'dark' ? 'images/chatgpt_logo_white.png' : 'images/chatgpt_logo_black.png');
      }
      
      const card = document.createElement('label');
      card.className = `platform-card ${platform.id === selectedPlatformId ? 'selected' : ''}`;
      card.dataset.platform = platform.id;
      
      card.innerHTML = `
        <input type="radio" name="platform" value="${platform.id}" 
          ${platform.id === selectedPlatformId ? 'checked' : ''}>
        <img src="${iconUrl}" class="platform-icon" alt="${platform.name}">
        <span class="platform-name">${platform.name}</span>
        ${platform.id === selectedPlatformId ? '<span class="selected-indicator"></span>' : ''}
      `;
      
      const radioInput = card.querySelector('input');
      
      radioInput.addEventListener('change', () => {
        if (radioInput.checked) {
          // Update UI
          document.querySelectorAll('.platform-card').forEach(el => {
            el.classList.remove('selected');
            const indicator = el.querySelector('.selected-indicator');
            if (indicator) indicator.remove();
          });
          
          card.classList.add('selected');
          
          // Add selected indicator if it doesn't exist
          if (!card.querySelector('.selected-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'selected-indicator';
            card.appendChild(indicator);
          }
          
          // Call onChange handler
          if (this.onChange) {
            this.onChange(platform.id);
          }
        }
      });
      
      this.element.appendChild(card);
    });
  }
  
  // Theme change listener to update ChatGPT logo
  updateLogos() {
    if (!this.element) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const chatGptIcon = this.element.querySelector('[data-platform="chatgpt"] .platform-icon');
    
    if (chatGptIcon) {
      chatGptIcon.src = chrome.runtime.getURL(
        currentTheme === 'dark' ? 'images/chatgpt_logo_white.png' : 'images/chatgpt_logo_black.png'
      );
    }
  }
}