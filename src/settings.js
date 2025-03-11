// src/settings.js
document.addEventListener('DOMContentLoaded', async () => {
  // Constants
  const STORAGE_KEY = 'custom_prompts_by_type';
  const CONTENT_TYPES = {
    GENERAL: 'general',
    REDDIT: 'reddit',
    YOUTUBE: 'youtube'
  };
  
  // Cache DOM elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const promptList = document.getElementById('promptList');
  const promptForm = document.getElementById('promptForm');
  const backBtn = document.getElementById('backBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const notification = document.getElementById('notification');
  const contentTypeSelect = document.getElementById('promptType');
  
  // Default prompts and custom prompts
  let defaultPrompts = {};
  let customPromptsByType = {};
  
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
        // Add type property to each default prompt
        for (const [type, prompt] of Object.entries(config.defaultPrompts)) {
          prompt.type = type;
        }
        
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
      chrome.storage.sync.get([STORAGE_KEY, 'custom_prompts'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading custom prompts:', chrome.runtime.lastError);
          customPromptsByType = initializeEmptyPromptStructure();
          resolve(customPromptsByType);
          return;
        }
        
        // Check if we're using the new structure
        if (result[STORAGE_KEY]) {
          customPromptsByType = result[STORAGE_KEY];
          resolve(customPromptsByType);
          return;
        }
        
        // If we have legacy data, migrate it
        if (result.custom_prompts) {
          console.log('Migrating from legacy data structure');
          const migratedData = migrateFromLegacyFormat(result.custom_prompts);
          customPromptsByType = migratedData;
          
          // Save the migrated data
          chrome.storage.sync.set({ [STORAGE_KEY]: migratedData }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving migrated data:', chrome.runtime.lastError);
            } else {
              console.log('Migration completed successfully');
              // Optionally remove old data
              chrome.storage.sync.remove('custom_prompts');
            }
          });
          
          resolve(migratedData);
          return;
        }
        
        // Initialize empty structure if no data exists
        customPromptsByType = initializeEmptyPromptStructure();
        resolve(customPromptsByType);
      });
    });
  }
  
  /**
   * Initialize empty prompt structure
   */
  function initializeEmptyPromptStructure() {
    return {
      [CONTENT_TYPES.GENERAL]: {
        prompts: {},
        preferredPromptId: null
      },
      [CONTENT_TYPES.REDDIT]: {
        prompts: {},
        preferredPromptId: null
      },
      [CONTENT_TYPES.YOUTUBE]: {
        prompts: {},
        preferredPromptId: null
      }
    };
  }
  
  /**
   * Migrate from legacy format to new format
   */
  function migrateFromLegacyFormat(legacyPrompts) {
    const newStructure = initializeEmptyPromptStructure();
    
    // Process each legacy prompt
    Object.entries(legacyPrompts).forEach(([id, prompt]) => {
      const type = prompt.type || CONTENT_TYPES.GENERAL;
      
      // Add to the appropriate type category
      newStructure[type].prompts[id] = {
        id,
        name: prompt.name,
        content: prompt.content,
        type: type,
        updatedAt: prompt.updatedAt || new Date().toISOString()
      };
      
      // If this is the first prompt of this type, make it preferred
      if (!newStructure[type].preferredPromptId) {
        newStructure[type].preferredPromptId = id;
      }
    });
    
    return newStructure;
  }
  
  /**
   * Save custom prompts to Chrome storage
   */
  async function saveCustomPrompts() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: customPromptsByType }, () => {
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
   * Get all prompts for a specific type
   */
  function getPromptsByType(type) {
    const typePrompts = [];
    
    // Add default prompt for this type if exists
    if (defaultPrompts[type]) {
      typePrompts.push({
        id: type,
        prompt: defaultPrompts[type],
        isDefault: true
      });
    }
    
    // Add custom prompts for this type
    if (customPromptsByType[type] && customPromptsByType[type].prompts) {
      Object.entries(customPromptsByType[type].prompts).forEach(([id, prompt]) => {
        typePrompts.push({
          id,
          prompt,
          isDefault: false
        });
      });
    }
    
    return typePrompts;
  }
  
  /**
   * Render the prompt list for a specific type
   */
  function renderPromptList(type) {
    promptList.innerHTML = '';
    
    // Get preferred prompt ID for this type
    const preferredPromptId = customPromptsByType[type]?.preferredPromptId || type;
    
    // Get all prompts for this type
    const typePrompts = getPromptsByType(type);
    
    // Display message if no prompts
    if (typePrompts.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <p>No prompts available for ${type}. Add your first prompt to get started.</p>
        <button class="btn" id="addFirstPromptBtn">Add First Prompt</button>
      `;
      
      promptList.appendChild(emptyState);
      
      // Add event listener
      setTimeout(() => {
        const addBtn = document.getElementById('addFirstPromptBtn');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            document.getElementById('promptType').value = type;
            switchTab('add-prompt');
          });
        }
      }, 0);
      
      return;
    }
    
    // Render each prompt
    typePrompts.forEach(({ id, prompt, isDefault }) => {
      promptList.appendChild(createPromptElement(id, prompt, isDefault, id === preferredPromptId));
    });
  }
  
  /**
   * Create an HTML element for a prompt
   */
  function createPromptElement(id, prompt, isDefault, isPreferred) {
    const promptElement = document.createElement('div');
    promptElement.className = 'prompt-item';
    promptElement.dataset.id = id;
    
    if (isPreferred) {
      promptElement.classList.add('preferred-prompt');
    }
    
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
          ${isPreferred ? '<span class="badge badge-preferred">Preferred</span>' : ''}
        </h3>
        <div class="prompt-actions">
          ${isPreferred ? '' : '<button class="action-btn set-preferred-btn" title="Set as Preferred">⭐ Set Preferred</button>'}
          ${isDefault ? `
            <button class="action-btn duplicate-btn" title="Duplicate">📋 Duplicate</button>
          ` : `
            <button class="action-btn edit-btn" title="Edit">✏️ Edit</button>
            <button class="action-btn delete-btn" title="Delete">🗑️ Delete</button>
          `}
        </div>
      </div>
      <div class="prompt-content">${displayContent.replace(/\n/g, '<br>')}</div>
    `;
    
    // Add event listeners
    const actionsDiv = promptElement.querySelector('.prompt-actions');
    
    // Add "Set as Preferred" functionality
    const setPreferredBtn = actionsDiv.querySelector('.set-preferred-btn');
    if (setPreferredBtn) {
      setPreferredBtn.addEventListener('click', () => setPreferredPrompt(id, prompt.type));
    }
    
    if (isDefault) {
      // For default prompts, we only have the duplicate button
      const duplicateBtn = actionsDiv.querySelector('.duplicate-btn');
      duplicateBtn.addEventListener('click', () => duplicatePrompt(id, prompt));
    } else {
      // For custom prompts, we have edit and delete
      const editBtn = actionsDiv.querySelector('.edit-btn');
      const deleteBtn = actionsDiv.querySelector('.delete-btn');
      
      editBtn.addEventListener('click', () => editPrompt(id, prompt));
      deleteBtn.addEventListener('click', () => deletePrompt(id, prompt.name, prompt.type));
    }
    
    return promptElement;
  }
  
  /**
   * Set a prompt as preferred for its type
   */
  function setPreferredPrompt(promptId, promptType) {
    // Update preferred prompt ID
    customPromptsByType[promptType].preferredPromptId = promptId;
    
    // Save changes
    saveCustomPrompts().then(() => {
      showNotification('Preferred prompt updated');
      renderPromptList(promptType);
    }).catch(error => {
      showNotification('Error updating preferred prompt: ' + error.message, 5000);
    });
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
  function deletePrompt(id, name, type) {
    if (confirm(`Are you sure you want to delete the prompt "${name}"?`)) {
      // Check if this is the preferred prompt
      const isPreferred = customPromptsByType[type].preferredPromptId === id;
      
      // Delete the prompt
      delete customPromptsByType[type].prompts[id];
      
      // If this was the preferred prompt, reset preferred ID
      if (isPreferred) {
        customPromptsByType[type].preferredPromptId = type; // Default to the default prompt
      }
      
      saveCustomPrompts().then(() => {
        showNotification(`Prompt "${name}" has been deleted`);
        renderPromptList(type);
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
    
    // Make sure the type category exists
    if (!customPromptsByType[type]) {
      customPromptsByType[type] = {
        prompts: {},
        preferredPromptId: null
      };
    }
    
    // Create/update the prompt
    customPromptsByType[type].prompts[promptId] = {
      id: promptId,
      name,
      type,
      content,
      updatedAt: new Date().toISOString()
    };
    
    // If this is the first custom prompt of this type, make it preferred
    if (!customPromptsByType[type].preferredPromptId || 
        (customPromptsByType[type].preferredPromptId === type && mode === 'add')) {
      customPromptsByType[type].preferredPromptId = promptId;
    }
    
    // Save to storage
    saveCustomPrompts().then(() => {
      // Reset the form
      promptForm.reset();
      document.getElementById('promptId').value = '';
      document.getElementById('formMode').value = 'add';
      document.getElementById('savePromptBtn').textContent = 'Save Prompt';
      
      // Show notification and switch to the appropriate type tab
      showNotification(`Prompt ${mode === 'edit' ? 'updated' : 'saved'} successfully`);
      switchToTypeTab(type);
    }).catch(error => {
      showNotification('Error saving prompt: ' + error.message, 5000);
    });
  }
  
  /**
   * Switch to a specific type tab and render its prompts
   */
  function switchToTypeTab(type) {
    // Find the tab button for this type and activate it
    tabButtons.forEach(button => {
      if (button.dataset.type === type) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Show the all-prompts tab and render prompts for this type
    tabContents.forEach(content => {
      if (content.id === 'all-prompts') {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    renderPromptList(type);
  }
  
  /**
   * Switch between tabs
   */
  function switchTab(tabId) {
    // Update active tab button
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabId) {
        button.classList.add('active');
      } else if (!button.dataset.type) {
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
      
      // Set up type tabs
      createTypeTabs();
      
      // Start with general tab
      switchToTypeTab(CONTENT_TYPES.GENERAL);
      
      // Set up form submission
      promptForm.addEventListener('submit', handleFormSubmit);
      
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
        switchToTypeTab(contentTypeSelect.value);
      });
      
    } catch (error) {
      console.error('Error initializing settings page:', error);
      showNotification('Error loading prompts. Please try again.', 5000);
    }
  }
  
  /**
   * Create tabs for each content type
   */
  function createTypeTabs() {
    const tabNav = document.querySelector('.tab-nav');
    
    // Remove existing type tabs if any
    document.querySelectorAll('.tab-btn[data-type]').forEach(btn => btn.remove());
    
    // Create a tab for each content type
    Object.values(CONTENT_TYPES).forEach(type => {
      const typeBtn = document.createElement('button');
      typeBtn.className = 'tab-btn';
      typeBtn.dataset.type = type;
      typeBtn.dataset.tab = 'all-prompts';
      typeBtn.textContent = type === CONTENT_TYPES.GENERAL ? 'Web Content' :
                           type === CONTENT_TYPES.REDDIT ? 'Reddit Posts' :
                           'YouTube Videos';
      
      typeBtn.addEventListener('click', () => {
        switchToTypeTab(type);
      });
      
      // Insert before the Add New Prompt tab
      const addTab = document.querySelector('.tab-btn[data-tab="add-prompt"]');
      tabNav.insertBefore(typeBtn, addTab);
    });
  }
  
  // Initialize the page
  initialize();
});