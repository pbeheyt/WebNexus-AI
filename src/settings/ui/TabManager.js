// src/settings/ui/TabManager.js
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/constants.js';

export default class TabManager {
  constructor(tabButtonContainer, tabContentContainer, eventBus) {
    this.tabButtonContainer = tabButtonContainer;
    this.tabContentContainer = tabContentContainer;
    this.eventBus = eventBus;
    this.tabButtons = new Map();
    this.tabContents = new Map();
    this.activeContentType = null;
    this.isInitialized = false;
  }

  initialize() {
    if (!this.tabButtonContainer || !this.tabContentContainer) {
      return;
    }
    
    // Don't re-initialize if already done
    if (this.isInitialized) {
      return;
    }
    
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
    
    // Wrap tabContentContainer in a tabs-container div if not already
    if (!this.tabContentContainer.parentElement.classList.contains('tabs-container')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'tabs-container';
      this.tabContentContainer.parentNode.insertBefore(wrapper, this.tabContentContainer);
      wrapper.appendChild(this.tabContentContainer);
    }
    
    // Handle the case where tabContentContainer itself is a tab-content element
    if (this.tabContentContainer.classList.contains('tab-content')) {
      // Use the container itself as a tab content
      const type = this.tabContentContainer.dataset.type;
      if (type) {
        this.tabContents.set(type, this.tabContentContainer);
        
        // Create content containers for other types
        Object.values(CONTENT_TYPES).forEach(contentType => {
          if (contentType !== type) {
            const tabContent = document.createElement('div');
            tabContent.id = `tab-content-${contentType}`;
            tabContent.className = 'tab-content';
            tabContent.dataset.type = contentType;
            
            // Store reference
            this.tabContents.set(contentType, tabContent);
            
            // Add to DOM - after the existing tab content
            this.tabContentContainer.parentNode.insertBefore(
              tabContent, 
              this.tabContentContainer.nextSibling
            );
          }
        });
      } else {
        // Fall back to normal initialization
        this.initializeTabContents();
      }
    } else {
      // Normal initialization
      this.initializeTabContents();
    }
    
    // Initialize with first tab and force activation
    this.switchToTab(CONTENT_TYPES.GENERAL, true); // Force activation
    
    // Mark as initialized
    this.isInitialized = true;
  }

  initializeTabContents() {
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
  }

  switchToTab(contentType, forceActivation = false) {
    // Don't switch if already on this tab (unless forced)
    if (!forceActivation && this.activeContentType === contentType) {
      return;
    }
    
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
        // First make it display:block but still invisible
        content.style.display = 'block';
        
        // Force a reflow to ensure the transition works
        content.offsetHeight;
        
        // Then add active class to trigger the transition
        content.classList.add('active');
      } else {
        // If it was active, start the transition out
        if (content.classList.contains('active')) {
          content.classList.remove('active');
          
          // After transition, hide completely
          setTimeout(() => {
            if (!content.classList.contains('active')) {
              content.style.display = 'none';
            }
          }, 250); // Match transition time in CSS
        }
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