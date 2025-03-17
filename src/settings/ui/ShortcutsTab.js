// src/settings/ui/ShortcutsTab.js
export default class ShortcutsTab {
  constructor(shortcutsController, eventBus, notificationManager) {
    this.shortcutsController = shortcutsController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.container = null;
    this.settings = null;
    this.commands = [];
    this.isSaving = false; // Flag to prevent concurrent saves
    
    // Subscribe to settings updates
    this.eventBus.subscribe('shortcuts:updated', this.handleSettingsUpdate.bind(this));
  }
  
  async initialize(container) {
    this.container = container;
    
    // Load settings
    this.settings = await this.shortcutsController.loadSettings();
    
    // Get commands info
    this.commands = await this.shortcutsController.getExtensionCommands();
    
    // Render initial UI
    this.render();
    
    return true;
  }
  
  handleSettingsUpdate(settings) {
    this.settings = settings;
    // Only update our local state, don't re-render to avoid UI jumps
  }
  
  render() {
    if (!this.container || !this.settings) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create tab structure
    const tabContent = document.createElement('div');
    tabContent.className = 'shortcuts-tab-content';
    
    // Add header with description
    const header = document.createElement('div');
    header.className = 'shortcuts-header';
    header.innerHTML = `
      <h2 class="type-heading">Keyboard Shortcuts</h2>
      <p class="section-description">
        Configure how the extension's keyboard shortcuts behave. To change the actual key combinations, 
        use Chrome's built-in shortcuts manager.
      </p>
    `;
    tabContent.appendChild(header);
    
    // Current shortcuts section
    const currentShortcuts = document.createElement('div');
    currentShortcuts.className = 'shortcuts-section settings-section';
    
    const shortcutsTitle = document.createElement('h3');
    shortcutsTitle.textContent = 'Current Shortcuts';
    shortcutsTitle.className = 'section-subtitle';
    currentShortcuts.appendChild(shortcutsTitle);
    
    // Table of current shortcuts
    const shortcutsTable = document.createElement('table');
    shortcutsTable.className = 'shortcuts-table';
    shortcutsTable.innerHTML = `
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    
    const tableBody = shortcutsTable.querySelector('tbody');
    
    // Add rows for each command
    this.commands.forEach(command => {
      const row = document.createElement('tr');
      
      const actionCell = document.createElement('td');
      actionCell.textContent = command.description || 
        (command.name === '_execute_action' ? 'Activate the extension' : command.name);
      
      const shortcutCell = document.createElement('td');
      shortcutCell.textContent = command.shortcut || 'Not set';
      
      row.appendChild(actionCell);
      row.appendChild(shortcutCell);
      tableBody.appendChild(row);
    });
        
    // If no commands, show message
    if (this.commands.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 2;
      cell.textContent = 'No shortcuts configured';
      row.appendChild(cell);
      tableBody.appendChild(row);
    }
    
    currentShortcuts.appendChild(shortcutsTable);
    
    // Add button to open Chrome's shortcuts page
    const openShortcutsBtn = document.createElement('button');
    openShortcutsBtn.className = 'btn shortcuts-config-btn';
    openShortcutsBtn.textContent = 'Change Keyboard Shortcuts';
    openShortcutsBtn.addEventListener('click', () => {
      this.shortcutsController.openChromeShortcutsPage();
    });
    
    currentShortcuts.appendChild(openShortcutsBtn);
    tabContent.appendChild(currentShortcuts);
    
    // Behavior settings section
    const behaviorSettings = document.createElement('div');
    behaviorSettings.className = 'settings-section';
    
    const behaviorTitle = document.createElement('h3');
    behaviorTitle.textContent = 'Shortcut Behavior';
    behaviorTitle.className = 'section-subtitle';
    behaviorSettings.appendChild(behaviorTitle);
    
    // Summarization behavior
    const summarizeSection = document.createElement('div');
    summarizeSection.className = 'shortcut-option-group';
    
    const summarizeLabel = document.createElement('h4');
    summarizeLabel.className = 'option-title';
    summarizeLabel.textContent = 'Summarization Shortcut Behavior';
    summarizeSection.appendChild(summarizeLabel);
    
    const radioGroup = document.createElement('div');
    radioGroup.className = 'radio-group-setting';
    
    // Page summarization option
    const pageRadioDiv = document.createElement('div');
    pageRadioDiv.className = 'radio-option';
    
    const pageRadio = document.createElement('input');
    pageRadio.type = 'radio';
    pageRadio.id = 'page-summarize';
    pageRadio.name = 'summarize-behavior';
    pageRadio.value = 'page';
    pageRadio.checked = this.settings.summarization_behavior === 'page';
    
    // Add auto-save functionality
    pageRadio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        await this.autoSaveSettings('page');
      }
    });
    
    const pageLabel = document.createElement('label');
    pageLabel.htmlFor = 'page-summarize';
    pageLabel.textContent = 'Summarize entire page';
    
    pageRadioDiv.appendChild(pageRadio);
    pageRadioDiv.appendChild(pageLabel);
    
    // Selection summarization option
    const selectionRadioDiv = document.createElement('div');
    selectionRadioDiv.className = 'radio-option';
    
    const selectionRadio = document.createElement('input');
    selectionRadio.type = 'radio';
    selectionRadio.id = 'selection-summarize';
    selectionRadio.name = 'summarize-behavior';
    selectionRadio.value = 'selection';
    selectionRadio.checked = this.settings.summarization_behavior === 'selection';
    
    // Add auto-save functionality
    selectionRadio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        await this.autoSaveSettings('selection');
      }
    });
    
    const selectionLabel = document.createElement('label');
    selectionLabel.htmlFor = 'selection-summarize';
    selectionLabel.textContent = 'Summarize selected text (if no selection, falls back to page)';
    
    selectionRadioDiv.appendChild(selectionRadio);
    selectionRadioDiv.appendChild(selectionLabel);
    
    radioGroup.appendChild(pageRadioDiv);
    radioGroup.appendChild(selectionRadioDiv);
    
    summarizeSection.appendChild(radioGroup);
    behaviorSettings.appendChild(summarizeSection);
    
    tabContent.appendChild(behaviorSettings);
    
    // Append to container
    this.container.appendChild(tabContent);
  }
  
  async autoSaveSettings(value) {
    // Prevent concurrent saves
    if (this.isSaving) return;
    
    try {
      this.isSaving = true;
      
      // Ensure UI reflects what we're saving
      const pageRadio = document.getElementById('page-summarize');
      const selectionRadio = document.getElementById('selection-summarize');
      
      if (pageRadio && selectionRadio) {
        pageRadio.checked = value === 'page';
        selectionRadio.checked = value === 'selection';
      }
      
      // Save the settings
      await this.shortcutsController.updateSettings({
        summarization_behavior: value
      });
      
      // Show success message
      this.notificationManager.success('Setting saved');
    } catch (error) {
      console.error('Error auto-saving shortcut settings:', error);
      this.notificationManager.error(`Error saving setting: ${error.message}`);
      
      // Revert UI to match actual settings
      this.updateRadioState();
    } finally {
      this.isSaving = false;
    }
  }
  
  // Ensure radio buttons match our settings state
  updateRadioState() {
    const pageRadio = document.getElementById('page-summarize');
    const selectionRadio = document.getElementById('selection-summarize');
    
    if (pageRadio && selectionRadio && this.settings) {
      pageRadio.checked = this.settings.summarization_behavior === 'page';
      selectionRadio.checked = this.settings.summarization_behavior === 'selection';
    }
  }
}