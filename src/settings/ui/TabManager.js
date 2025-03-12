// src/settings/ui/TabManager.js
import { TABS } from '../utils/constants.js';

export default class TabManager {
  constructor(tabButtonContainer, eventBus) {
    this.tabButtonContainer = tabButtonContainer;
    this.eventBus = eventBus;
    this.tabButtons = new Map();
    this.tabContents = new Map();
    this.activeTab = null;
    this.isInitialized = false;
  }

  initialize() {
    if (!this.tabButtonContainer) {
      return;
    }
    
    // Don't re-initialize if already done
    if (this.isInitialized) {
      return;
    }
    
    // Get references to tab buttons and contents
    const tabButtons = this.tabButtonContainer.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      const tabId = button.dataset.tab;
      this.tabButtons.set(tabId, button);
      
      // Get corresponding content
      const content = document.getElementById(tabId);
      if (content) {
        this.tabContents.set(tabId, content);
      }
      
      // Add event listener
      button.addEventListener('click', () => this.switchToTab(tabId));
    });
    
    // Set initial active tab (either from URL hash or default to prompt management)
    const hash = window.location.hash.substring(1);
    const initialTab = this.tabButtons.has(hash) ? hash : TABS.PROMPT_MANAGEMENT;
    this.switchToTab(initialTab);
    
    // Initialize content accordion behavior for configuration tab
    this.initializeAccordion();
    
    // Mark as initialized
    this.isInitialized = true;
  }

  initializeAccordion() {
    const headers = document.querySelectorAll('.content-type-header');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        content.classList.toggle('collapsed');
        
        // Update the indicator arrow
        const arrow = header.querySelector('span:last-child');
        if (arrow) {
          arrow.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });
  }

  switchToTab(tabId) {
    // Don't switch if already on this tab
    if (this.activeTab === tabId) {
      return;
    }
    
    // Update active tab button
    this.tabButtons.forEach((button, id) => {
      if (id === tabId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show active tab content
    this.tabContents.forEach((content, id) => {
      if (id === tabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Update active tab
    this.activeTab = tabId;
    
    // Update URL hash
    window.location.hash = tabId;
    
    // Publish event
    this.eventBus.publish('tab:changed', tabId);
  }

  getActiveTab() {
    return this.activeTab;
  }

  getTabContent(tabId) {
    return this.tabContents.get(tabId);
  }
}