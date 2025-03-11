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
        preferredPromptId: null,
        settings: {}
      },
      [CONTENT_TYPES.REDDIT]: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 200 // Default value
        }
      },
      [CONTENT_TYPES.YOUTUBE]: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 50 // Default value
        }
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
   * Create settings section for content type tabs
   * @param {string} type - The content type
   * @returns {HTMLElement} The settings section element
   */
  function createSettingsSection(type) {
    // Only create settings for Reddit and YouTube
    if (type !== CONTENT_TYPES.REDDIT && type !== CONTENT_TYPES.YOUTUBE) {
      return document.createElement('div'); // Return empty div for other types
    }

    const section = document.createElement('div');
    section.className = 'settings-section';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = 'Content Settings';
    
    const settingsForm = document.createElement('div');
    settingsForm.className = 'settings-form';
    
    // Create max comments input
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.htmlFor = `${type}-max-comments`;
    label.textContent = 'Maximum Comments to Extract:';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `${type}-max-comments`;
    input.className = 'settings-input';
    input.min = '1';
    input.max = '1000';
    input.value = customPromptsByType[type]?.settings?.maxComments || 
                  (type === CONTENT_TYPES.REDDIT ? 200 : 50);
    
    input.addEventListener('change', () => saveContentTypeSettings(type));
    
    const helpText = document.createElement('p');
    helpText.className = 'help-text';
    helpText.textContent = 'Set the maximum number of comments to extract. Higher values may increase processing time.';
    
    // Assemble the form
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    formGroup.appendChild(helpText);
    
    settingsForm.appendChild(formGroup);
    
    section.appendChild(heading);
    section.appendChild(settingsForm);
    
    return section;
  }

  /**
   * Save content type specific settings
   * @param {string} type - The content type
   */
  function saveContentTypeSettings(type) {
    try {
      const maxCommentsInput = document.getElementById(`${type}-max-comments`);
      
      if (!maxCommentsInput) return;
      
      // Parse and validate input
      let maxComments = parseInt(maxCommentsInput.value, 10);
      
      // Ensure value is within valid range
      if (isNaN(maxComments) || maxComments < 1) maxComments = 1;
      if (maxComments > 1000) maxComments = 1000;
      
      // Update input with validated value
      maxCommentsInput.value = maxComments;
      
      // Ensure settings object exists
      if (!customPromptsByType[type].settings) {
        customPromptsByType[type].settings = {};
      }
      
      // Update settings
      customPromptsByType[type].settings.maxComments = maxComments;
      
      // Save to storage
      saveCustomPrompts().then(() => {
        // Show brief flash feedback instead of notification
        const input = document.getElementById(`${type}-max-comments`);
        if (input) {
          const originalBg = input.style.backgroundColor;
          input.style.backgroundColor = '#e6f4ea'; // Light green
          setTimeout(() => {
            input.style.backgroundColor = originalBg;
          }, 500);
        }
      }).catch(error => {
        showNotification('Error saving settings: ' + error.message, 5000);
      });
    } catch (error) {
      console.error('Error saving content type settings:', error);
      showNotification('Error saving settings', 5000);
    }
  }
  
  /**
   * Render the prompt list for a specific type
   */
  function renderPromptList(type) {
    promptList.innerHTML = '';
    
    // Create and add settings section for this type
    const settingsSection = createSettingsSection(type);
    promptList.appendChild(settingsSection);
    
    // Add a divider if settings were added (for Reddit and YouTube)
    if (type === CONTENT_TYPES.REDDIT || type === CONTENT_TYPES.YOUTUBE) {
      const divider = document.createElement('hr');
      divider.className = 'settings-divider';
      promptList.appendChild(divider);
    }
    
    // Add the prompts section heading
    const promptsHeading = document.createElement('h3');
    promptsHeading.className = 'type-heading';
    promptsHeading.textContent = 'Prompts';
    promptList.appendChild(promptsHeading);
    
    // Get preferred prompt ID for this type
    const preferredPromptId = customPromptsByType[type]?.preferredPromptId || type;
    
    // Get all prompts for this type
    const typePrompts = getPromptsByType(type);
    
    // Display message if no prompts
    if (typePrompts.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <p>No prompts available for ${type}. Add your first prompt below.</p>
      `;
      
      promptList.appendChild(emptyState);
    } else {
      // Render each prompt
      typePrompts.forEach(({ id, prompt, isDefault }) => {
        promptList.appendChild(createPromptElement(id, prompt, isDefault, id === preferredPromptId));
      });
    }
    
    // Add another divider
    const addPromptDivider = document.createElement('hr');
    addPromptDivider.className = 'settings-divider';
    promptList.appendChild(addPromptDivider);
    
    // Add the add prompt form
    const addPromptForm = createAddPromptForm(type);
    promptList.appendChild(addPromptForm);
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
    
    // Display full content without truncation
    const displayContent = prompt.content;
    
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
          ${isDefault ? `` : `
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
      // No action for default prompts
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
   * Create an add prompt form for a specific type
   * @param {string} type - The content type
   * @returns {HTMLElement} - The form element
   */
  function createAddPromptForm(type) {
    const formSection = document.createElement('div');
    formSection.className = 'add-prompt-section';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = 'Add New Prompt';
    
    const form = document.createElement('form');
    form.className = 'add-prompt-form';
    form.dataset.type = type;
    
    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = `${type}-prompt-name`;
    nameLabel.textContent = 'Prompt Name';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `${type}-prompt-name`;
    nameInput.className = 'prompt-name-input';
    nameInput.placeholder = 'Give your prompt a descriptive name';
    nameInput.required = true;
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Content textarea
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = `${type}-prompt-content`;
    contentLabel.textContent = 'Prompt Content';
    
    const contentInput = document.createElement('textarea');
    contentInput.id = `${type}-prompt-content`;
    contentInput.className = 'prompt-content-input';
    contentInput.placeholder = 'Enter your prompt content here...';
    contentInput.required = true;
    contentInput.rows = 10;
    
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentInput);
    
    // Hidden fields
    const promptIdInput = document.createElement('input');
    promptIdInput.type = 'hidden';
    promptIdInput.id = `${type}-prompt-id`;
    promptIdInput.value = '';
    
    const formModeInput = document.createElement('input');
    formModeInput.type = 'hidden';
    formModeInput.id = `${type}-form-mode`;
    formModeInput.value = 'add';
    
    // Buttons
    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.dataset.type = type;
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn save-btn';
    saveBtn.textContent = 'Save Prompt';
    saveBtn.id = `${type}-save-prompt-btn`;
    
    formActions.appendChild(cancelBtn);
    formActions.appendChild(saveBtn);
    
    // Assemble form
    form.appendChild(nameGroup);
    form.appendChild(contentGroup);
    form.appendChild(promptIdInput);
    form.appendChild(formModeInput);
    form.appendChild(formActions);
    
    // Add event listeners
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleTypeFormSubmit(type);
    });
    
    cancelBtn.addEventListener('click', () => {
      resetTypeForm(type);
    });
    
    // Assemble section
    formSection.appendChild(heading);
    formSection.appendChild(form);
    
    return formSection;
  }
  
  /**
   * Reset a type-specific form
   * @param {string} type - The content type
   */
  function resetTypeForm(type) {
    const form = document.querySelector(`.add-prompt-form[data-type="${type}"]`);
    if (!form) return;
    
    form.reset();
    document.getElementById(`${type}-prompt-id`).value = '';
    document.getElementById(`${type}-form-mode`).value = 'add';
    document.getElementById(`${type}-save-prompt-btn`).textContent = 'Save Prompt';
    
    // Hide the form
    form.classList.remove('editing');
    
    // If there's a toggle button, update its state
    const toggleBtn = document.getElementById(`${type}-add-prompt-toggle`);
    if (toggleBtn) {
      toggleBtn.textContent = '+ Add New Prompt';
      toggleBtn.classList.remove('active');
    }
  }
  
  /**
   * Handle type-specific form submission
   * @param {string} type - The content type
   */
  function handleTypeFormSubmit(type) {
    const nameInput = document.getElementById(`${type}-prompt-name`);
    const contentInput = document.getElementById(`${type}-prompt-content`);
    const promptIdInput = document.getElementById(`${type}-prompt-id`);
    const formModeInput = document.getElementById(`${type}-form-mode`);
    
    if (!nameInput || !contentInput || !promptIdInput || !formModeInput) {
      showNotification('Form elements not found', 3000);
      return;
    }
    
    const name = nameInput.value;
    const content = contentInput.value;
    const promptId = promptIdInput.value || generateId();
    const mode = formModeInput.value;
    
    if (!name || !content) {
      showNotification('Please fill in all required fields', 3000);
      return;
    }
    
    // Make sure the type category exists
    if (!customPromptsByType[type]) {
      customPromptsByType[type] = {
        prompts: {},
        preferredPromptId: null,
        settings: type === CONTENT_TYPES.REDDIT ? { maxComments: 200 } : 
                 type === CONTENT_TYPES.YOUTUBE ? { maxComments: 50 } : {}
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
      resetTypeForm(type);
      
      // Show notification
      showNotification(`Prompt ${mode === 'edit' ? 'updated' : 'saved'} successfully`);
      
      // Refresh the prompt list
      renderPromptList(type);
    }).catch(error => {
      showNotification('Error saving prompt: ' + error.message, 5000);
    });
  }
  
  /**
   * Edit an existing prompt
   */
  function editPrompt(id, prompt) {
    const type = prompt.type;
    
    // Set up the form for editing
    document.getElementById(`${type}-prompt-name`).value = prompt.name;
    document.getElementById(`${type}-prompt-content`).value = prompt.content;
    document.getElementById(`${type}-prompt-id`).value = id;
    document.getElementById(`${type}-form-mode`).value = 'edit';
    
    // Update button text
    document.getElementById(`${type}-save-prompt-btn`).textContent = 'Update Prompt';
    
    // Add editing class to show the form is in edit mode
    const form = document.querySelector(`.add-prompt-form[data-type="${type}"]`);
    if (form) {
      form.classList.add('editing');
      
      // Scroll to the form
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Update toggle button if exists
    const toggleBtn = document.getElementById(`${type}-add-prompt-toggle`);
    if (toggleBtn) {
      toggleBtn.textContent = 'Editing Prompt';
      toggleBtn.classList.add('active');
    }
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
      
      // Set up back button
      backBtn.addEventListener('click', () => {
        window.close();
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
    document.querySelectorAll('.tab-btn').forEach(btn => btn.remove());
    
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
      
      tabNav.appendChild(typeBtn);
    });
  }
  
  // Initialize the page
  initialize();
});