// src/settings/controllers/ConfigImportExportController.js
import configManager from '../../services/ConfigManager.js';

export default class ConfigImportExportController {
  constructor(notificationManager) {
    this.configManager = configManager;
    this.notificationManager = notificationManager;
    this.container = null;
  }

  initialize(container) {
    this.container = container;
    this.render();
  }

  render() {
    if (!this.container) return;

    // Clear container
    this.container.innerHTML = '';

    // Create export section
    const exportSection = document.createElement('div');
    exportSection.className = 'import-export-section';
    
    const exportHeading = document.createElement('h3');
    exportHeading.className = 'section-heading';
    exportHeading.textContent = 'Export Configuration';
    
    const exportDescription = document.createElement('p');
    exportDescription.className = 'section-description';
    exportDescription.textContent = 'Download the current prompt configuration as a JSON file.';
    
    const exportButton = document.createElement('button');
    exportButton.className = 'btn';
    exportButton.textContent = 'Export Configuration';
    exportButton.addEventListener('click', () => this.handleExport());
    
    exportSection.appendChild(exportHeading);
    exportSection.appendChild(exportDescription);
    exportSection.appendChild(exportButton);
    
    // Create import section
    const importSection = document.createElement('div');
    importSection.className = 'import-export-section';
    
    const importHeading = document.createElement('h3');
    importHeading.className = 'section-heading';
    importHeading.textContent = 'Import Configuration';
    
    const importDescription = document.createElement('p');
    importDescription.className = 'section-description';
    importDescription.textContent = 'Upload a prompt configuration JSON file to replace the current configuration.';
    
    const importWarning = document.createElement('div');
    importWarning.className = 'import-warning';
    importWarning.innerHTML = `
      <p><strong>⚠️ Warning:</strong> Importing a configuration will replace the current prompt templates and settings. 
      Your custom prompts will not be affected.</p>
    `;
    
    const fileInputContainer = document.createElement('div');
    fileInputContainer.className = 'file-input-container';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'config-file-input';
    fileInput.accept = 'application/json';
    fileInput.className = 'file-input';
    
    const fileLabel = document.createElement('label');
    fileLabel.htmlFor = 'config-file-input';
    fileLabel.className = 'file-input-label';
    fileLabel.textContent = 'Choose Configuration File';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = 'No file selected';
    
    fileInputContainer.appendChild(fileInput);
    fileInputContainer.appendChild(fileLabel);
    fileInputContainer.appendChild(fileName);
    
    // Update filename display when file is selected
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileName.textContent = file.name;
      } else {
        fileName.textContent = 'No file selected';
      }
    });
    
    const importButton = document.createElement('button');
    importButton.className = 'btn';
    importButton.textContent = 'Import Configuration';
    importButton.disabled = true;
    importButton.addEventListener('click', () => this.handleImport(fileInput.files[0]));
    
    // Enable import button when file is selected
    fileInput.addEventListener('change', (e) => {
      importButton.disabled = !e.target.files.length;
    });
    
    importSection.appendChild(importHeading);
    importSection.appendChild(importDescription);
    importSection.appendChild(importWarning);
    importSection.appendChild(fileInputContainer);
    importSection.appendChild(importButton);
    
    // Create reset section
    const resetSection = document.createElement('div');
    resetSection.className = 'import-export-section';
    
    const resetHeading = document.createElement('h3');
    resetHeading.className = 'section-heading';
    resetHeading.textContent = 'Reset Configuration';
    
    const resetDescription = document.createElement('p');
    resetDescription.className = 'section-description';
    resetDescription.textContent = 'Restore the original prompt configuration that came with the extension.';
    
    const resetButton = document.createElement('button');
    resetButton.className = 'btn btn-danger';
    resetButton.textContent = 'Reset to Default';
    resetButton.addEventListener('click', () => this.handleReset());
    
    resetSection.appendChild(resetHeading);
    resetSection.appendChild(resetDescription);
    resetSection.appendChild(resetButton);
    
    // Add dividers between sections
    const divider1 = document.createElement('hr');
    divider1.className = 'settings-divider';
    
    const divider2 = document.createElement('hr');
    divider2.className = 'settings-divider';
    
    // Assemble container
    this.container.appendChild(exportSection);
    this.container.appendChild(divider1);
    this.container.appendChild(importSection);
    this.container.appendChild(divider2);
    this.container.appendChild(resetSection);
    
    // Add styles
    this.addStyles();
  }

  async handleExport() {
    try {
      // Get current configuration
      const config = await this.configManager.getConfig();
      
      // Convert to JSON string with pretty formatting
      const configJson = JSON.stringify(config, null, 2);
      
      // Create download
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `prompt-config-${timestamp}.json`;
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      this.notificationManager.success('Configuration exported successfully');
    } catch (error) {
      console.error('Error exporting configuration:', error);
      this.notificationManager.error(`Export failed: ${error.message}`);
    }
  }

  async handleImport(file) {
    if (!file) {
      this.notificationManager.error('No file selected');
      return;
    }
    
    try {
      // Read file
      const fileContent = await this.readFileAsText(file);
      
      // Parse JSON
      let importedConfig;
      try {
        importedConfig = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON file format');
      }
      
      // Confirm import
      if (!confirm('WARNING: Importing this configuration will replace your current settings.\n\nAre you sure you want to proceed?')) {
        return;
      }
      
      // Import configuration
      await this.configManager.importConfig(importedConfig);
      
      this.notificationManager.success('Configuration imported successfully');
      
      // Reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error importing configuration:', error);
      this.notificationManager.error(`Import failed: ${error.message}`);
    }
  }

  async handleReset() {
    try {
      if (!confirm('Are you sure you want to reset to the default configuration? This cannot be undone.')) {
        return;
      }
      
      // Reset configuration
      await this.configManager.resetConfig();
      
      this.notificationManager.success('Configuration reset to default successfully');
      
      // Reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error resetting configuration:', error);
      this.notificationManager.error(`Reset failed: ${error.message}`);
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  addStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .import-export-section {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--bg-surface);
        border-radius: 6px;
      }
      
      .section-heading {
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 16px;
      }
      
      .section-description {
        color: var(--text-secondary);
        margin-bottom: 16px;
      }
      
      .import-warning {
        background: rgba(255, 193, 7, 0.1);
        border-left: 3px solid var(--warning-color);
        padding: 10px 12px;
        margin-bottom: 16px;
        font-size: 13px;
      }
      
      .file-input-container {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      
      .file-input {
        width: 0.1px;
        height: 0.1px;
        opacity: 0;
        overflow: hidden;
        position: absolute;
        z-index: -1;
      }
      
      .file-input-label {
        cursor: pointer;
        background: var(--bg-surface-hover);
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        display: inline-block;
        transition: all var(--transition-fast);
        font-size: 14px;
      }
      
      .file-input-label:hover {
        background: var(--bg-surface-active);
        border-color: var(--color-primary);
      }
      
      .file-name {
        margin-left: 10px;
        color: var(--text-secondary);
        font-size: 14px;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
}