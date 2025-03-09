/**
 * Popup Script
 * 
 * Handles the popup UI and interactions.
 */

// Import modules
const promptManager = require('../utils/promptManager');
const storageManager = require('../utils/storageManager');

document.addEventListener('DOMContentLoaded', async () => {
  // Get UI elements
  const contentTypeDisplay = document.getElementById('contentTypeDisplay');
  const promptTypeSelect = document.getElementById('promptType');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  const customizePromptsBtn = document.getElementById('customizePromptsBtn');
  const promptSettingsPanel = document.getElementById('promptSettingsPanel');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const addPromptButtons = document.querySelectorAll('.add-prompt-btn');
  const addPromptForm = document.getElementById('addPromptForm');
  const newPromptType = document.getElementById('newPromptType');
  const newPromptId = document.getElementById('newPromptId');
  const newPromptName = document.getElementById('newPromptName');
  const newPromptContent = document.getElementById('newPromptContent');
  const saveNewPromptBtn = document.getElementById('saveNewPromptBtn');
  const cancelNewPromptBtn = document.getElementById('cancelNewPromptBtn');
  
  // Import/Export elements
  const exportPromptsBtn = document.getElementById('exportPromptsBtn');
  const importPromptsBtn = document.getElementById('importPromptsBtn');
  const resetPromptsBtn = document.getElementById('resetPromptsBtn');
  const fileInput = document.getElementById('fileInput');
  const importOptions = document.getElementById('importOptions');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  const notificationArea = document.getElementById('notificationArea');
  
  // Store selected file for import
  let selectedFile = null;
  
  /**
   * Detect content type from current tab URL
   * @returns {Promise<string>} The detected content type
   */
  async function detectContentType() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url) {
        return promptManager.CONTENT_TYPES.GENERAL;
      }
      
      if (tab.url.includes('youtube.com/watch')) {
        return promptManager.CONTENT_TYPES.YOUTUBE;
      } else if (tab.url.includes('reddit.com/r/') && tab.url.includes('/comments/')) {
        return promptManager.CONTENT_TYPES.REDDIT;
      } else {
        return promptManager.CONTENT_TYPES.GENERAL;
      }
    } catch (error) {
      console.error('Error detecting content type:', error);
      return promptManager.CONTENT_TYPES.GENERAL;
    }
  }
  
  /**
   * Update content type display in UI
   * @param {string} contentType - The content type to display
   */
  function updateContentTypeDisplay(contentType) {
    let displayText = 'General Web Content';
    let displayColor = '#4A90E2';
    
    if (contentType === promptManager.CONTENT_TYPES.YOUTUBE) {
      displayText = 'YouTube Video';
      displayColor = '#FF0000';
    } else if (contentType === promptManager.CONTENT_TYPES.REDDIT) {
      displayText = 'Reddit Post';
      displayColor = '#FF4500';
    }
    
    contentTypeDisplay.textContent = displayText;
    contentTypeDisplay.style.backgroundColor = displayColor;
  }
  
  /**
   * Populate prompt select dropdown for a content type
   * @param {string} contentType - The content type
   * @returns {Promise<void>}
   */
  async function populatePromptSelect(contentType) {
    try {
      const prompts = await promptManager.loadPromptsByType(contentType);
      const selectedPromptId = await storageManager.getSelectedPrompt(contentType);
      
      // Clear existing options
      promptTypeSelect.innerHTML = '';
      
      // Add options for each prompt
      Object.entries(prompts).forEach(([id, prompt]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = prompt.name;
        promptTypeSelect.appendChild(option);
      });
      
      // Set selected option
      if (selectedPromptId && prompts[selectedPromptId]) {
        promptTypeSelect.value = selectedPromptId;
      } else if (Object.keys(prompts).length > 0) {
        // Set first option as default if previous selection is invalid
        const firstKey = Object.keys(prompts)[0];
        promptTypeSelect.value = firstKey;
        await storageManager.saveSelectedPrompt(contentType, firstKey);
      }
    } catch (error) {
      console.error('Error populating prompt select:', error);
      showNotification('Failed to load prompts: ' + error.message, 'error');
    }
  }
  
  /**
   * Check if content script is loaded in current tab
   * @returns {Promise<boolean>} Whether the content script is loaded
   */
  async function isContentScriptLoaded() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return false;
      }
      
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not loaded:', chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log('Content script is loaded:', response);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error checking content script:', error);
      return false;
    }
  }
  
  /**
   * Inject content script into current tab
   * @returns {Promise<boolean>} Whether the injection was successful
   */
  async function injectContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return false;
      }
      
      // Determine which content script to inject
      let scriptFile = 'dist/general-content.bundle.js';
      
      if (tab.url.includes('youtube.com/watch')) {
        scriptFile = 'dist/youtube-content.bundle.js';
      } else if (tab.url.includes('reddit.com/r/') && tab.url.includes('/comments/')) {
        scriptFile = 'dist/reddit-content.bundle.js';
      }
      
      console.log('Injecting content script:', scriptFile);
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [scriptFile]
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
    } catch (error) {
      console.error('Error injecting content script:', error);
      return false;
    }
  }
  
  /**
   * Extract content from current tab
   * @returns {Promise<boolean>} Whether the extraction was successful
   */
  async function extractContent() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        statusMessage.textContent = 'No active tab found';
        return false;
      }
      
      // Check if content script is loaded
      let contentScriptReady = await isContentScriptLoaded();
      
      // If not loaded, inject it
      if (!contentScriptReady) {
        statusMessage.textContent = 'Initializing content extractor...';
        const injected = await injectContentScript();
        
        if (!injected) {
          statusMessage.textContent = 'Failed to initialize content extractor';
          return false;
        }
        
        contentScriptReady = await isContentScriptLoaded();
      }
      
      if (!contentScriptReady) {
        statusMessage.textContent = 'Content extractor not ready. Please refresh the page and try again.';
        return false;
      }
      
      // Clear any existing content
      await storageManager.clearContent();
      
      // Send message to extract content
      chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      // Wait for content to be extracted (with timeout)
      statusMessage.textContent = 'Extracting content...';
      let extractionSuccess = false;
      let retryCount = 0;
      const MAX_RETRIES = 15;
      
      while (!extractionSuccess && retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { contentReady } = await chrome.storage.local.get(['contentReady']);
        
        if (contentReady) {
          extractionSuccess = true;
          statusMessage.textContent = 'Content extracted successfully';
          break;
        }
        
        retryCount++;
        statusMessage.textContent = `Extracting content... (${retryCount}/${MAX_RETRIES})`;
      }
      
      if (!extractionSuccess) {
        statusMessage.textContent = 'Extraction timed out. Please try again.';
      }
      
      return extractionSuccess;
    } catch (error) {
      console.error('Error extracting content:', error);
      statusMessage.textContent = 'Error: ' + error.message;
      return false;
    }
  }
  
  /**
   * Open Claude with extracted content
   * @param {string} contentType - The content type
   * @returns {Promise<void>}
   */
  async function openClaudeWithContent(contentType) {
    try {
      // Get selected prompt ID
      const selectedPromptId = promptTypeSelect.value;
      
      // Save selected prompt
      await storageManager.saveSelectedPrompt(contentType, selectedPromptId);
      
      // Get prompt content
      const promptContent = await promptManager.getPromptContent(contentType, selectedPromptId);
      
      // Get Claude URL from config
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      const claudeUrl = config.claudeUrl;
      
      // Save prompt to storage
      await chrome.storage.local.set({ prePrompt: promptContent });
      
      // Create new tab with Claude
      const newTab = await chrome.tabs.create({ url: claudeUrl });
      
      // Save Claude state
      await storageManager.saveClaudeState({
        tabId: newTab.id,
        scriptInjected: false
      });
      
      // Close popup
      window.close();
    } catch (error) {
      console.error('Error opening Claude with content:', error);
      statusMessage.textContent = 'Error: ' + error.message;
    }
  }
  
  /**
   * Load and display prompts for a content type
   * @param {string} contentType - The content type
   * @returns {Promise<void>}
   */
  async function loadPromptsList(contentType) {
    try {
      const promptsList = document.getElementById(`${contentType}PromptsList`);
      if (!promptsList) return;
      
      const prompts = await promptManager.loadPromptsByType(contentType);
      
      // Clear current list
      promptsList.innerHTML = '';
      
      // Add each prompt to the list
      Object.entries(prompts).forEach(([id, prompt]) => {
        const promptItem = document.createElement('div');
        promptItem.className = 'prompt-item';
        promptItem.dataset.id = id;
        promptItem.dataset.type = contentType;
        
        const header = document.createElement('div');
        header.className = 'prompt-item-header';
        
        const nameElem = document.createElement('div');
        nameElem.className = 'prompt-name';
        nameElem.textContent = prompt.name;
        
        const actionsElem = document.createElement('div');
        actionsElem.className = 'prompt-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => togglePromptEditor(id, contentType));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deletePrompt(id, contentType));
        
        // Only allow deletion if there's more than one prompt
        if (Object.keys(prompts).length <= 1) {
          deleteBtn.disabled = true;
          deleteBtn.title = 'Cannot delete the only prompt';
        }
        
        actionsElem.appendChild(editBtn);
        actionsElem.appendChild(deleteBtn);
        
        header.appendChild(nameElem);
        header.appendChild(actionsElem);
        
        promptItem.appendChild(header);
        
        // Create editor (hidden by default)
        const editorContainer = document.createElement('div');
        editorContainer.className = 'prompt-editor-container hidden';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'prompt-name-input';
        nameInput.value = prompt.name;
        nameInput.placeholder = 'Prompt Display Name';
        
        const editor = document.createElement('textarea');
        editor.className = 'prompt-editor';
        editor.value = prompt.content;
        
        const editorActions = document.createElement('div');
        editorActions.className = 'button-group';
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Changes';
        saveBtn.className = 'save-prompt-btn';
        saveBtn.addEventListener('click', () => savePromptChanges(id, contentType, nameInput.value, editor.value));
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-btn';
        cancelBtn.addEventListener('click', () => togglePromptEditor(id, contentType));
        
        editorActions.appendChild(saveBtn);
        editorActions.appendChild(cancelBtn);
        
        editorContainer.appendChild(nameInput);
        editorContainer.appendChild(editor);
        editorContainer.appendChild(editorActions);
        
        promptItem.appendChild(editorContainer);
        promptsList.appendChild(promptItem);
      });
    } catch (error) {
      console.error(`Error loading prompts for ${contentType}:`, error);
      showNotification(`Failed to load ${contentType} prompts: ${error.message}`, 'error');
    }
  }
  
  /**
   * Toggle prompt editor visibility
   * @param {string} promptId - The prompt ID
   * @param {string} contentType - The content type
   */
  function togglePromptEditor(promptId, contentType) {
    const promptsList = document.getElementById(`${contentType}PromptsList`);
    const promptItem = promptsList.querySelector(`.prompt-item[data-id="${promptId}"]`);
    
    if (promptItem) {
      const editorContainer = promptItem.querySelector('.prompt-editor-container');
      editorContainer.classList.toggle('hidden');
    }
  }
  
  /**
   * Save edited prompt
   * @param {string} promptId - The prompt ID
   * @param {string} contentType - The content type
   * @param {string} newName - The new prompt name
   * @param {string} newContent - The new prompt content
   * @returns {Promise<void>}
   */
  async function savePromptChanges(promptId, contentType, newName, newContent) {
    try {
      if (!newName.trim() || !newContent.trim()) {
        showNotification('Prompt name and content cannot be empty', 'error');
        return;
      }
      
      // Update prompt
      await promptManager.updatePrompt(contentType, promptId, {
        name: newName.trim(),
        content: newContent.trim()
      });
      
      // Reload prompts list
      await loadPromptsList(contentType);
      
      // Reload prompt select if this is the current content type
      const currentContentType = await detectContentType();
      if (currentContentType === contentType) {
        await populatePromptSelect(contentType);
      }
      
      showNotification('Prompt updated successfully', 'success');
    } catch (error) {
      console.error('Error saving prompt changes:', error);
      showNotification('Failed to save changes: ' + error.message, 'error');
    }
  }
  
  /**
   * Delete a prompt
   * @param {string} promptId - The prompt ID
   * @param {string} contentType - The content type
   * @returns {Promise<void>}
   */
  async function deletePrompt(promptId, contentType) {
    try {
      // Load current prompts
      const prompts = await promptManager.loadPromptsByType(contentType);
      
      // Don't allow deleting the only prompt
      if (Object.keys(prompts).length <= 1) {
        showNotification('Cannot delete the only prompt', 'error');
        return;
      }
      
      // Confirm deletion
      if (!confirm(`Are you sure you want to delete the "${prompts[promptId].name}" prompt?`)) {
        return;
      }
      
      // Delete prompt
      await promptManager.deletePrompt(contentType, promptId);
      
      // Check if this was the selected prompt
      const selectedPromptId = await storageManager.getSelectedPrompt(contentType);
      if (promptId === selectedPromptId) {
        // Select a different prompt
        const newSelectedId = Object.keys(prompts).find(id => id !== promptId);
        if (newSelectedId) {
          await storageManager.saveSelectedPrompt(contentType, newSelectedId);
        }
      }
      
      // Reload prompts list
      await loadPromptsList(contentType);
      
      // Reload prompt select if this is the current content type
      const currentContentType = await detectContentType();
      if (currentContentType === contentType) {
        await populatePromptSelect(contentType);
      }
      
      showNotification('Prompt deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showNotification('Failed to delete prompt: ' + error.message, 'error');
    }
  }
  
  /**
   * Add a new prompt
   * @returns {Promise<void>}
   */
  async function addNewPrompt() {
    try {
      const contentType = newPromptType.value;
      const id = newPromptId.value.trim().replace(/\s+/g, '_').toLowerCase();
      const name = newPromptName.value.trim();
      const content = newPromptContent.value.trim();
      
      // Validate inputs
      if (!id) {
        showNotification('Prompt ID is required', 'error');
        return;
      }
      
      if (!name) {
        showNotification('Prompt name is required', 'error');
        return;
      }
      
      if (!content) {
        showNotification('Prompt content is required', 'error');
        return;
      }
      
      // Check if ID already exists
      const prompts = await promptManager.loadPromptsByType(contentType);
      if (prompts[id]) {
        showNotification('A prompt with this ID already exists. Please choose a different ID.', 'error');
        return;
      }
      
      // Add prompt
      await promptManager.addPrompt(contentType, id, {
        name,
        content
      });
      
      // Reload prompts list
      await loadPromptsList(contentType);
      
      // Reload prompt select if this is the current content type
      const currentContentType = await detectContentType();
      if (currentContentType === contentType) {
        await populatePromptSelect(contentType);
      }
      
      // Reset form and hide it
      newPromptId.value = '';
      newPromptName.value = '';
      newPromptContent.value = '';
      addPromptForm.classList.add('hidden');
      
      showNotification('New prompt added successfully', 'success');
    } catch (error) {
      console.error('Error adding new prompt:', error);
      showNotification('Failed to add new prompt: ' + error.message, 'error');
    }
  }
  
  /**
   * Show a notification message
   * @param {string} message - The message to show
   * @param {string} type - The notification type (success, error)
   */
  function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Clear previous notifications
    notificationArea.innerHTML = '';
    
    // Add notification to the notification area
    notificationArea.appendChild(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
  
  /**
   * Initialize the popup
   * @returns {Promise<void>}
   */
  async function initializePopup() {
    try {
      // Detect content type
      const contentType = await detectContentType();
      
      // Update content type display
      updateContentTypeDisplay(contentType);
      
      // Populate prompt select
      await populatePromptSelect(contentType);
      
      // Set active tab
      tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === contentType) {
          button.classList.add('active');
        }
      });
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${contentType}Tab`) {
          content.classList.add('active');
        }
      });
      
      // Load prompts for all content types
      await loadPromptsList(promptManager.CONTENT_TYPES.GENERAL);
      await loadPromptsList(promptManager.CONTENT_TYPES.REDDIT);
      await loadPromptsList(promptManager.CONTENT_TYPES.YOUTUBE);
      
      // Check if summarize button should be enabled
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.startsWith('http')) {
        summarizeBtn.disabled = true;
        statusMessage.textContent = 'Please navigate to a web page to summarize content';
      } else {
        summarizeBtn.disabled = false;
        statusMessage.textContent = 'Ready to summarize';
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      statusMessage.textContent = 'Error initializing: ' + error.message;
    }
  }
  
  // Event Listeners
  
  // Tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      
      // Update active tab button
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      // Update active tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tab}Tab`).classList.add('active');
    });
  });
  
  // Add prompt buttons
  addPromptButtons.forEach(button => {
    button.addEventListener('click', () => {
      const contentType = button.dataset.type;
      
      // Set form content type
      newPromptType.value = contentType;
      
      // Show form
      addPromptForm.classList.remove('hidden');
      
      // Hide import options
      importOptions.classList.add('hidden');
    });
  });
  
  // Save prompt button
  saveNewPromptBtn.addEventListener('click', addNewPrompt);
  
  // Cancel new prompt button
  cancelNewPromptBtn.addEventListener('click', () => {
    addPromptForm.classList.add('hidden');
  });
  
  // Prompt type select
  promptTypeSelect.addEventListener('change', async () => {
    const contentType = await detectContentType();
    await storageManager.saveSelectedPrompt(contentType, promptTypeSelect.value);
  });
  
  // Settings button
  customizePromptsBtn.addEventListener('click', () => {
    promptSettingsPanel.classList.toggle('hidden');
  });
  
  // Export prompts button
  exportPromptsBtn.addEventListener('click', async () => {
    try {
      await promptManager.exportPrompts();
      showNotification('Prompts exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting prompts:', error);
      showNotification('Failed to export prompts: ' + error.message, 'error');
    }
  });
  
  // Import prompts button
  importPromptsBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  // File input change
  fileInput.addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    
    if (selectedFile) {
      // Show import options
      importOptions.classList.remove('hidden');
      
      // Hide add prompt form
      addPromptForm.classList.add('hidden');
    }
  });
  
  // Confirm import button
  confirmImportBtn.addEventListener('click', async () => {
    try {
      if (!selectedFile) {
        showNotification('No file selected', 'error');
        return;
      }
      
      // Get selected import mode
      const importMode = document.querySelector('input[name="importMode"]:checked').value;
      const overwrite = importMode === 'overwrite';
      
      // Import prompts
      const importedPrompts = await promptManager.importPromptsFromFile(selectedFile);
      
      // Merge prompts
      await promptManager.mergePrompts(importedPrompts, overwrite);
      
      // Reload prompts lists
      await loadPromptsList(promptManager.CONTENT_TYPES.GENERAL);
      await loadPromptsList(promptManager.CONTENT_TYPES.REDDIT);
      await loadPromptsList(promptManager.CONTENT_TYPES.YOUTUBE);
      
      // Reload prompt select
      const contentType = await detectContentType();
      await populatePromptSelect(contentType);
      
      // Hide import options
      importOptions.classList.add('hidden');
      
      // Clear selected file
      fileInput.value = '';
      selectedFile = null;
      
      showNotification(`Prompts imported successfully (${Object.keys(importedPrompts).length} total)`, 'success');
    } catch (error) {
      console.error('Error importing prompts:', error);
      showNotification('Failed to import prompts: ' + error.message, 'error');
    }
  });
  
  // Cancel import button
  cancelImportBtn.addEventListener('click', () => {
    importOptions.classList.add('hidden');
    fileInput.value = '';
    selectedFile = null;
  });
  
  // Reset prompts button
  resetPromptsBtn.addEventListener('click', async () => {
    try {
      // Confirm reset
      if (!confirm('Are you sure you want to reset all prompts to default? This will delete all custom prompts.')) {
        return;
      }
      
      // Reset prompts
      await promptManager.resetPromptsToDefault();
      
      // Reload prompts lists
      await loadPromptsList(promptManager.CONTENT_TYPES.GENERAL);
      await loadPromptsList(promptManager.CONTENT_TYPES.REDDIT);
      await loadPromptsList(promptManager.CONTENT_TYPES.YOUTUBE);
      
      // Reload prompt select
      const contentType = await detectContentType();
      await populatePromptSelect(contentType);
      
      showNotification('Prompts reset to default', 'success');
    } catch (error) {
      console.error('Error resetting prompts:', error);
      showNotification('Failed to reset prompts: ' + error.message, 'error');
    }
  });
  
  // Summarize button
  summarizeBtn.addEventListener('click', async () => {
    try {
      // Disable button
      summarizeBtn.disabled = true;
      
      // Extract content
      statusMessage.textContent = 'Extracting content...';
      const extracted = await extractContent();
      
      if (!extracted) {
        summarizeBtn.disabled = false;
        return;
      }
      
      // Get content type
      const contentType = await detectContentType();
      
      // Open Claude with content
      statusMessage.textContent = 'Opening Claude...';
      await openClaudeWithContent(contentType);
    } catch (error) {
      console.error('Error in summarize button click:', error);
      statusMessage.textContent = 'Error: ' + error.message;
      summarizeBtn.disabled = false;
    }
  });
  
  // Initialize popup
  await initializePopup();
});
