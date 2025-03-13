// src/popup/ui/PlatformSelector.js - Simplified Version without theme-dependent logos

export default class PlatformSelector {
  constructor(element, onChange) {
    this.element = element;
    this.onChange = onChange;
  }

  /**
   * Render platform options
   * @param {Array} platforms - Array of platform objects
   * @param {string} selectedPlatformId - ID of the selected platform
   */
  render(platforms, selectedPlatformId) {
    if (!this.element || !platforms?.length) return;
    
    // Clear existing content
    this.element.innerHTML = '';
    
    // Create platform options
    platforms.forEach(platform => {
      // Use platform icon directly without theme modifications
      const iconUrl = platform.iconUrl;
      
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
}