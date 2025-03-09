/**
 * Prompt Management Module
 * 
 * Handles all operations related to prompt storage, import, export, and management.
 * Provides a unified API for prompt management across all content types.
 */

// Import content types
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

/**
 * Load all prompts from Chrome storage or initialize with defaults
 * @returns {Promise<Object>} Object containing all prompts by content type
 */
async function loadAllPrompts() {
  try {
    console.log('Loading all prompts from storage...');
    const { prompts } = await chrome.storage.local.get(['prompts']);
    console.log('Prompts from storage:', prompts);
    
    if (!prompts || Object.keys(prompts).length === 0) {
      console.log('No prompts found in storage, loading defaults from config.json...');
      // Initialize with default prompts from config
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      console.log('Config loaded:', config);
      
      if (!config.defaultPrompts) {
        console.error('config.json does not contain defaultPrompts!');
        return {};
      }
      
      const defaultPrompts = config.defaultPrompts;
      console.log('Default prompts from config:', defaultPrompts);
      
      // Create properly formatted prompts object
      const formattedPrompts = {};
      
      for (const contentType of Object.values(CONTENT_TYPES)) {
        if (defaultPrompts[contentType]) {
          formattedPrompts[contentType] = {};
          
          // Create a default prompt entry with the content type as the ID
          formattedPrompts[contentType][contentType] = {
            name: defaultPrompts[contentType].name || `Default ${contentType}`,
            content: defaultPrompts[contentType].content || ''
          };
        } else {
          console.warn(`No default prompt found for ${contentType}`);
          formattedPrompts[contentType] = {};
        }
      }
      
      console.log('Formatted prompts:', formattedPrompts);
      await saveAllPrompts(formattedPrompts);
      return formattedPrompts;
    }
    
    return prompts;
  } catch (error) {
    console.error('Error loading prompts:', error);
    
    // Fallback to default prompts from config
    console.log('Error occurred, falling back to default prompts...');
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    
    if (!config.defaultPrompts) {
      console.error('config.json does not contain defaultPrompts!');
      return {};
    }
    
    const defaultPrompts = config.defaultPrompts;
    
    // Create properly formatted prompts object
    const formattedPrompts = {};
    
    for (const contentType of Object.values(CONTENT_TYPES)) {
      if (defaultPrompts[contentType]) {
        formattedPrompts[contentType] = {};
        
        // Create a default prompt entry with the content type as the ID
        formattedPrompts[contentType][contentType] = {
          name: defaultPrompts[contentType].name || `Default ${contentType}`,
          content: defaultPrompts[contentType].content || ''
        };
      } else {
        console.warn(`No default prompt found for ${contentType}`);
        formattedPrompts[contentType] = {};
      }
    }
    
    return formattedPrompts;
  }
}

/**
 * Load prompts for a specific content type
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @returns {Promise<Object>} Object containing prompts for the specified content type
 */
async function loadPromptsByType(contentType) {
  try {
    console.log(`Loading prompts for content type: ${contentType}`);
    const allPrompts = await loadAllPrompts();
    console.log(`All prompts:`, allPrompts);
    const typePrompts = allPrompts[contentType] || {};
    console.log(`Prompts for ${contentType}:`, typePrompts);
    return typePrompts;
  } catch (error) {
    console.error(`Error loading ${contentType} prompts:`, error);
    return {};
  }
}

/**
 * Save all prompts to Chrome storage
 * @param {Object} prompts - Object containing all prompts
 * @returns {Promise<void>}
 */
async function saveAllPrompts(prompts) {
  try {
    console.log('Saving all prompts:', prompts);
    await chrome.storage.local.set({ prompts });
    console.log('All prompts saved successfully');
  } catch (error) {
    console.error('Error saving prompts:', error);
    throw error;
  }
}

/**
 * Save prompts for a specific content type
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @param {Object} typePrompts - Object containing prompts for the specified content type
 * @returns {Promise<void>}
 */
async function savePromptsByType(contentType, typePrompts) {
  try {
    const allPrompts = await loadAllPrompts();
    allPrompts[contentType] = typePrompts;
    await saveAllPrompts(allPrompts);
    console.log(`${contentType} prompts saved successfully`);
  } catch (error) {
    console.error(`Error saving ${contentType} prompts:`, error);
    throw error;
  }
}

/**
 * Add a new prompt for a specific content type
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @param {string} promptId - Unique prompt identifier
 * @param {Object} promptData - Prompt data (name and content)
 * @returns {Promise<void>}
 */
async function addPrompt(contentType, promptId, promptData) {
  try {
    const typePrompts = await loadPromptsByType(contentType);
    
    // Validate the prompt data
    if (!promptData.name || !promptData.content) {
      throw new Error('Prompt must have both name and content');
    }
    
    // Add the prompt
    typePrompts[promptId] = promptData;
    
    // Save the updated prompts
    await savePromptsByType(contentType, typePrompts);
  } catch (error) {
    console.error(`Error adding prompt to ${contentType}:`, error);
    throw error;
  }
}

/**
 * Update an existing prompt
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @param {string} promptId - Unique prompt identifier
 * @param {Object} promptData - Updated prompt data (name and content)
 * @returns {Promise<void>}
 */
async function updatePrompt(contentType, promptId, promptData) {
  try {
    const typePrompts = await loadPromptsByType(contentType);
    
    // Check if the prompt exists
    if (!typePrompts[promptId]) {
      throw new Error(`Prompt '${promptId}' not found for ${contentType}`);
    }
    
    // Validate the prompt data
    if (!promptData.name || !promptData.content) {
      throw new Error('Prompt must have both name and content');
    }
    
    // Update the prompt
    typePrompts[promptId] = promptData;
    
    // Save the updated prompts
    await savePromptsByType(contentType, typePrompts);
  } catch (error) {
    console.error(`Error updating prompt '${promptId}' for ${contentType}:`, error);
    throw error;
  }
}

/**
 * Delete a prompt
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @param {string} promptId - Unique prompt identifier
 * @returns {Promise<void>}
 */
async function deletePrompt(contentType, promptId) {
  try {
    const typePrompts = await loadPromptsByType(contentType);
    
    // Check if the prompt exists
    if (!typePrompts[promptId]) {
      throw new Error(`Prompt '${promptId}' not found for ${contentType}`);
    }
    
    // Don't allow deleting the only prompt
    if (Object.keys(typePrompts).length <= 1) {
      throw new Error(`Cannot delete the only prompt for ${contentType}`);
    }
    
    // Delete the prompt
    delete typePrompts[promptId];
    
    // Save the updated prompts
    await savePromptsByType(contentType, typePrompts);
  } catch (error) {
    console.error(`Error deleting prompt '${promptId}' for ${contentType}:`, error);
    throw error;
  }
}

/**
 * Get the prompt content for a specific content type and prompt ID
 * @param {string} contentType - Content type identifier (general, reddit, youtube)
 * @param {string} promptId - Unique prompt identifier
 * @returns {Promise<string>} The prompt content
 */
async function getPromptContent(contentType, promptId) {
  try {
    const typePrompts = await loadPromptsByType(contentType);
    console.log(`Getting prompt content for ${contentType}/${promptId}:`, typePrompts);
    
    if (!promptId || !typePrompts[promptId]) {
      console.log(`Prompt ${promptId} not found, using first available prompt`);
      // Use the first available prompt if the specified one doesn't exist
      const firstPromptId = Object.keys(typePrompts)[0];
      if (!firstPromptId) {
        console.error(`No prompts found for ${contentType}!`);
        return '';
      }
      return typePrompts[firstPromptId]?.content || '';
    }
    
    return typePrompts[promptId].content;
  } catch (error) {
    console.error(`Error getting prompt content for '${promptId}' in ${contentType}:`, error);
    return '';
  }
}

/**
 * Export all prompts to a JSON file
 * @returns {Promise<boolean>} Success status
 */
async function exportPrompts() {
  try {
    const allPrompts = await loadAllPrompts();
    
    // Create export data with metadata
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      prompts: allPrompts
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a Blob with the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a download URL
    const url = URL.createObjectURL(blob);
    
    // Create date string for filename
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `ai-content-summarizer-prompts-${dateStr}.json`;
    
    // Trigger the download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error exporting prompts:', error);
    throw error;
  }
}

/**
 * Import prompts from a JSON file
 * @param {File} file - The JSON file containing prompts
 * @returns {Promise<Object>} The imported prompts
 */
async function importPromptsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        // Parse JSON
        const jsonData = JSON.parse(event.target.result);
        
        // Validate structure
        if (!jsonData.prompts) {
          reject(new Error('Invalid file format: Missing prompts object'));
          return;
        }
        
        // Extract prompts
        const importedPrompts = jsonData.prompts;
        
        // Validate content types
        for (const contentType of Object.keys(importedPrompts)) {
          if (![CONTENT_TYPES.GENERAL, CONTENT_TYPES.REDDIT, CONTENT_TYPES.YOUTUBE].includes(contentType)) {
            reject(new Error(`Invalid content type: ${contentType}`));
            return;
          }
          
          // Validate each prompt
          const typePrompts = importedPrompts[contentType];
          for (const [promptId, prompt] of Object.entries(typePrompts)) {
            if (!prompt.name || !prompt.content) {
              reject(new Error(`Invalid prompt: ${promptId} in ${contentType} is missing required fields`));
              return;
            }
          }
        }
        
        resolve(importedPrompts);
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Merge imported prompts with existing prompts
 * @param {Object} importedPrompts - The prompts from the imported file
 * @param {boolean} overwrite - Whether to overwrite existing prompts
 * @returns {Promise<Object>} The merged prompts
 */
async function mergePrompts(importedPrompts, overwrite) {
  try {
    const currentPrompts = await loadAllPrompts();
    let mergedPrompts;
    
    if (overwrite) {
      // Replace all prompts with imported ones
      mergedPrompts = importedPrompts;
    } else {
      // Merge prompts, keeping existing ones in case of conflict
      mergedPrompts = { ...currentPrompts };
      
      // Process each content type
      for (const contentType of Object.keys(importedPrompts)) {
        mergedPrompts[contentType] = mergedPrompts[contentType] || {};
        
        // Add new prompts for this content type
        for (const [promptId, prompt] of Object.entries(importedPrompts[contentType])) {
          if (!mergedPrompts[contentType][promptId]) {
            mergedPrompts[contentType][promptId] = prompt;
          }
        }
      }
    }
    
    // Ensure each content type has at least one prompt
    for (const contentType of [CONTENT_TYPES.GENERAL, CONTENT_TYPES.REDDIT, CONTENT_TYPES.YOUTUBE]) {
      if (!mergedPrompts[contentType] || Object.keys(mergedPrompts[contentType]).length === 0) {
        console.log(`No prompts found for ${contentType} after merge, loading defaults...`);
        // Fetch default prompts if needed
        const response = await fetch(chrome.runtime.getURL('config.json'));
        const config = await response.json();
        
        if (config.defaultPrompts && config.defaultPrompts[contentType]) {
          mergedPrompts[contentType] = {};
          mergedPrompts[contentType][contentType] = {
            name: config.defaultPrompts[contentType].name || `Default ${contentType}`,
            content: config.defaultPrompts[contentType].content || ''
          };
        } else {
          console.warn(`No default prompt found for ${contentType} in config.json`);
          mergedPrompts[contentType] = {};
        }
      }
    }
    
    // Save the merged prompts
    await saveAllPrompts(mergedPrompts);
    
    return mergedPrompts;
  } catch (error) {
    console.error('Error merging prompts:', error);
    throw error;
  }
}

/**
 * Reset all prompts to default
 * @returns {Promise<Object>} The default prompts
 */
async function resetPromptsToDefault() {
  try {
    console.log('Resetting prompts to default...');
    // Fetch default prompts from config
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    
    if (!config.defaultPrompts) {
      console.error('config.json does not contain defaultPrompts!');
      return {};
    }
    
    const defaultPrompts = config.defaultPrompts;
    
    // Create properly formatted prompts object
    const formattedPrompts = {};
    
    for (const contentType of Object.values(CONTENT_TYPES)) {
      if (defaultPrompts[contentType]) {
        formattedPrompts[contentType] = {};
        
        // Create a default prompt entry with the content type as the ID
        formattedPrompts[contentType][contentType] = {
          name: defaultPrompts[contentType].name || `Default ${contentType}`,
          content: defaultPrompts[contentType].content || ''
        };
      } else {
        console.warn(`No default prompt found for ${contentType}`);
        formattedPrompts[contentType] = {};
      }
    }
    
    // Save default prompts
    await saveAllPrompts(formattedPrompts);
    
    return formattedPrompts;
  } catch (error) {
    console.error('Error resetting prompts to default:', error);
    throw error;
  }
}

// Export public API
module.exports = {
  CONTENT_TYPES,
  loadAllPrompts,
  loadPromptsByType,
  saveAllPrompts,
  savePromptsByType,
  addPrompt,
  updatePrompt,
  deletePrompt,
  getPromptContent,
  exportPrompts,
  importPromptsFromFile,
  mergePrompts,
  resetPromptsToDefault
};