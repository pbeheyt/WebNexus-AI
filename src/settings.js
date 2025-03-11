// src/settings.js
document.addEventListener('DOMContentLoaded', async () => {
  // Constants
  const STORAGE_KEY = 'custom_prompts';
  
  // Cache DOM elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const promptList = document.getElementById('promptList');
  const promptForm = document.getElementById('promptForm');
  const promptSearch = document.getElementById('promptSearch');
  const backBtn = document.getElementById('backBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const notification = document.getElementById('notification');
  
  // Default prompts and custom prompts
  let defaultPrompts = {};
  let customPrompts = {};
  
  /**
   * Generate a unique ID for new prompts
   */
  function generateId() {
    return 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  
  /**
   * Show a notification message
   */
  function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  }
  
  /**
   * Load default prompts from config.json
   */
  async function loadDefaultPrompts() {
    try {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      
      if (config.defaultPrompts) {
        defaultPrompts = config.defaultPrompts;
        return config.defaultPrompts;
      } else {
        console.error('No default prompts found in config.json');
        return {};
      }
    } catch (error) {
      console.error('Error loading default prompts:', error);
      return {};
    }
  }
  
  /**
   * Load custom prompts from Chrome storage
   */
  async function loadCustomPrompts() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading custom prompts:', chrome.runtime.lastError);
          resolve({});
        } else if (result && result[STORAGE_KEY]) {
          customPrompts = result[STORAGE_KEY];
          resolve(result[STORAGE_KEY]);
        } else {
          resolve({});
        }
      });
    });
  }
  
  /**
   * Save custom prompts to Chrome storage
   */
  async function saveCustomPrompts() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: customPrompts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving custom prompts:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Render the prompt list
   */
  function renderPromptList(filter = '') {
    promptList.innerHTML = '';
    
    // Filter function for prompts
    const filterPrompt = (name, content) => {
      if (!filter) return true;
      const lowercaseFilter = filter.toLowerCase();
      return name.toLowerCase().includes(lowercaseFilter) || 
             content.toLowerCase().includes(lowercaseFilter);
    };
    
    // Count how many prompts we're displaying
    let displayCount = 0;
    
    // Render default prompts
    Object.entries(defaultPrompts).forEach(([key, prompt]) => {
      if (!filterPrompt(prompt.name, prompt.content)) return;
      
      displayCount++;
      promptList.appendChild(createPromptElement(key, prompt, true));
    });
    
    // Render custom prompts
    Object.entries(customPrompts).forEach(([key, prompt]) => {
      if (!filterPrompt(prompt.name, prompt.content)) return;
      
      displayCount++;
      promptList.appendChild(createPromptElement(key, prompt, false));
    });
    
    // Show empty state if no prompts are displayed
    if (displayCount === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      
      if (filter) {
        emptyState.innerHTML = `
          <p>No prompts found matching "${filter}"</p>
          <button class="btn" id="clearSearchBtn">Clear Search</button>
        `;
        
        // Add event listener after it's in the DOM
        setTimeout(() => {
          document.getElementById('clearSearchBtn').addEventListener('click', () => {
            promptSearch.value = '';
            renderPromptList();
          });
        }, 0);
      } else {
        emptyState.innerHTML = `
          <p>No prompts available. Add your first prompt to get started.</p>
          <button class="btn" id="addFirstPromptBtn">Add First Prompt</button>
        `;
        
        // Add event listener after it's in the DOM
        setTimeout(() => {
          document.getElementById('addFirstPromptBtn').addEventListener('click', () => {
            switchTab('add-prompt');
          });
        }, 0);
      }
      
      promptList.appendChild(emptyState);
    }
  }
  
  /**
   * Create an HTML element for a prompt
   */
  function createPromptElement(key, prompt, isDefault) {
    const promptElement = document.createElement('div');
    promptElement.className = 'prompt-item';
    promptElement.dataset.id = key;
    
    // Format content for display (truncate if needed)
    let displayContent = prompt.content;
    if (displayContent.length > 300) {
      displayContent = displayContent.substring(0, 300) + '...';
    }
    
    promptElement.innerHTML = `
      <div class="prompt-header">
        <h3 class="prompt-title">
          ${prompt.name}
          <span class="badge ${isDefault ? 'badge-default' : 'badge-custom'}">
            ${isDefault ? 'Default' : 'Custom'}
          </span>
        </h3>
        <div class="prompt-actions">
          ${isDefault ? `
            <button class="action-btn duplicate-btn" title="Duplicate">📋 Duplicate</button>
          ` : `
            <button class="action-btn edit-btn" title="Edit">✏️ Edit</button>
            <button class="action-btn delete-btn" title="Delete">🗑️ Delete</button>
          `}
        </div>
      </div>
      <div class="prompt-content">${displayContent.replace(/\n/g, '<br>')}</div>
      <div class="prompt-meta">
        Type: ${prompt.type === 'general' ? 'Web Content' : 
               prompt.type === 'reddit' ? 'Reddit Post' : 
               prompt.type === 'youtube' ? 'YouTube Video' : prompt.type}
      </div>
    `;
    
    // Add event listeners
    const actionsDiv = promptElement.querySelector('.prompt-actions');
    
    if (isDefault) {
      // For default prompts, we only have the duplicate button
      const duplicateBtn = actionsDiv.querySelector('.duplicate-btn');
      duplicateBtn.addEventListener('click', () => duplicatePrompt(key, prompt));
    } else {
      // For custom prompts, we have edit and delete
      const editBtn = actionsDiv.querySelector('.edit-btn');
      const deleteBtn = actionsDiv.querySelector('.delete-btn');
      
      editBtn.addEventListener('click', () => editPrompt(key, prompt));
      deleteBtn.addEventListener('click', () => deletePrompt(key, prompt.name));
    }
    
    return promptElement;
  }
  
  /**
   * Duplicate a prompt (create a copy of default or custom)
   */
  function duplicatePrompt(id, prompt) {
    // Set up the form for the duplicated prompt
    document.getElementById('promptName').value = `${prompt.name} (Copy)`;
    document.getElementById('promptType').value = prompt.type;
    document.getElementById('promptContent').value = prompt.content;
    document.getElementById('promptId').value = '';
    document.getElementById('formMode').value = 'add';
    
    // Switch to the add tab
    switchTab('add-prompt');
  }
  
  /**
   * Edit an existing prompt
   */
  function editPrompt(id, prompt) {
    // Set up the form for editing
    document.getElementById('promptName').value = prompt.name;
    document.getElementById('promptType').value = prompt.type;
    document.getElementById('promptContent').value = prompt.content;
    document.getElementById('promptId').value = id;
    document.getElementById('formMode').value = 'edit';
    
    // Update button text
    document.getElementById('savePromptBtn').textContent = 'Update Prompt';
    
    // Switch to the add tab (which becomes the edit tab)
    switchTab('add-prompt');
  }
  
  /**
   * Delete a prompt
   */
  function deletePrompt(id, name) {
    if (confirm(`Are you sure you want to delete the prompt "${name}"?`)) {
      delete customPrompts[id];
      saveCustomPrompts().then(() => {
        showNotification(`Prompt "${name}" has been deleted`);
        renderPromptList(promptSearch.value);
      }).catch(error => {
        showNotification('Error deleting prompt: ' + error.message, 5000);
      });
    }
  }
  
  /**
   * Handle form submission
   */
  function handleFormSubmit(event) {
    event.preventDefault();
    
    const mode = document.getElementById('formMode').value;
    const promptId = document.getElementById('promptId').value || generateId();
    const name = document.getElementById('promptName').value;
    const type = document.getElementById('promptType').value;
    const content = document.getElementById('promptContent').value;
    
    if (!name || !content) {
      showNotification('Please fill in all required fields', 3000);
      return;
    }
    
    // Create/update the prompt
    customPrompts[promptId] = {
      name,
      type,
      content,
      updatedAt: new Date().toISOString()
    };
    
    // Save to storage
    saveCustomPrompts().then(() => {
      // Reset the form
      promptForm.reset();
      document.getElementById('promptId').value = '';
      document.getElementById('formMode').value = 'add';
      document.getElementById('savePromptBtn').textContent = 'Save Prompt';
      
      // Show notification and switch tab
      showNotification(`Prompt ${mode === 'edit' ? 'updated' : 'saved'} successfully`);
      switchTab('all-prompts');
      renderPromptList(promptSearch.value);
    }).catch(error => {
      showNotification('Error saving prompt: ' + error.message, 5000);
    });
  }
  
  /**
   * Switch between tabs
   */
  function switchTab(tabId) {
    // Update active tab button
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show active tab content
    tabContents.forEach(content => {
      if (content.id === tabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }
  
  /**
   * Initialize the settings page
   */
  async function initialize() {
    try {
      // Load prompts
      await Promise.all([
        loadDefaultPrompts(),
        loadCustomPrompts()
      ]);
      
      // Render prompt list
      renderPromptList();
      
      // Set up tab switching
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          switchTab(button.dataset.tab);
        });
      });
      
      // Set up form submission
      promptForm.addEventListener('submit', handleFormSubmit);
      
      // Set up search filtering
      promptSearch.addEventListener('input', () => {
        renderPromptList(promptSearch.value);
      });
      
      // Set up back button
      backBtn.addEventListener('click', () => {
        window.close();
      });
      
      // Set up cancel button
      cancelBtn.addEventListener('click', () => {
        promptForm.reset();
        document.getElementById('promptId').value = '';
        document.getElementById('formMode').value = 'add';
        document.getElementById('savePromptBtn').textContent = 'Save Prompt';
        switchTab('all-prompts');
      });
      
    } catch (error) {
      console.error('Error initializing settings page:', error);
      showNotification('Error loading prompts. Please try again.', 5000);
    }
  }
  
  // Initialize the page
  initialize();
});