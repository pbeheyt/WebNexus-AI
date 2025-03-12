import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/constants.js';

// Manages tab navigation and content
export default class TabManager {
  constructor(tabButtonContainer, tabContentContainer, eventBus) {
    this.tabButtonContainer = tabButtonContainer;
    this.tabContentContainer = tabContentContainer;
    this.eventBus = eventBus;
    this.tabButtons = new Map();
    this.tabContents = new Map();
    this.activeContentType = CONTENT_TYPES.GENERAL;
  }

  initialize() {
    // Clear existing tabs
    this.tabButtonContainer.innerHTML = '';
    
    // Create a tab for each content type
    Object.entries(CONTENT_TYPES).forEach(([key, type]) => {
      const typeBtn = document.createElement('button');
      typeBtn.className = 'tab-btn';
      typeBtn.dataset.type = type;
      typeBtn.textContent = CONTENT_TYPE_LABELS[type];
      
      // Add event listener
      typeBtn.addEventListener('click', () => this.switchToTab(type));
      
      // Store reference
      this.tabButtons.set(type, typeBtn);
      
      // Add to DOM
      this.tabButtonContainer.appendChild(typeBtn);
    });
    
    // Create tab content containers if needed
    if (this.tabContentContainer.children.length === 0) {
      Object.values(CONTENT_TYPES).forEach(type => {
        const tabContent = document.createElement('div');
        tabContent.id = `tab-content-${type}`;
        tabContent.className = 'tab-content';
        tabContent.dataset.type = type;
        
        // Store reference
        this.tabContents.set(type, tabContent);
        
        // Add to DOM
        this.tabContentContainer.appendChild(tabContent);
      });
    } else {
      // Get existing tab content elements
      this.tabContentContainer.querySelectorAll('.tab-content').forEach(element => {
        const type = element.dataset.type;
        if (type) {
          this.tabContents.set(type, element);
        }
      });
    }
    
    // Initialize with first tab
    this.switchToTab(CONTENT_TYPES.GENERAL);
  }

  switchToTab(contentType) {
    // Update active tab button
    this.tabButtons.forEach((button, type) => {
      if (type === contentType) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show active tab content
    this.tabContents.forEach((content, type) => {
      if (type === contentType) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Update active content type
    this.activeContentType = contentType;
    
    // Publish event
    this.eventBus.publish('tab:changed', contentType);
  }

  getActiveTab() {
    return this.activeContentType;
  }

  getTabContent(contentType) {
    return this.tabContents.get(contentType);
  }
}