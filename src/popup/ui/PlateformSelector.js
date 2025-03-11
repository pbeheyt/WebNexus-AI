// popup/ui/PlatformSelector.js
export default class PlatformSelector {
  constructor(element, onChange) {
    this.element = element;
    this.onChange = onChange;
  }

  render(platforms, selectedPlatformId) {
    if (!this.element || !platforms?.length) return;
    
    // Clear existing content
    this.element.innerHTML = '';
    
    // Create platform options
    platforms.forEach(platform => {
      const option = document.createElement('div');
      option.className = `platform-option ${platform.id === selectedPlatformId ? 'selected' : ''}`;
      option.dataset.platform = platform.id;
      
      option.innerHTML = `
        <input type="radio" name="platform" value="${platform.id}" id="platform-${platform.id}" 
          ${platform.id === selectedPlatformId ? 'checked' : ''}>
        <img src="${platform.iconUrl}" class="platform-icon" alt="${platform.name}">
        <label for="platform-${platform.id}">${platform.name}</label>
      `;
      
      option.addEventListener('click', () => {
        // Update UI
        document.querySelectorAll('.platform-option').forEach(el => 
          el.classList.remove('selected'));
        option.classList.add('selected');
        
        // Call onChange handler
        if (this.onChange) {
          this.onChange(platform.id);
        }
      });
      
      this.element.appendChild(option);
    });
  }
}