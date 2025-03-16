// src/popup/services/PreferenceService.js
export default class PreferenceService {
  constructor(storageService) {
    this.storageService = storageService;
    this.STORAGE_KEYS = {
      PROMPT_TYPE_PREFERENCE: 'prompt_type_preference',
      SELECTED_PROMPT_IDS: 'selected_prompt_ids',
      QUICK_PROMPTS: 'quick_prompts'
    };
  }

  /**
   * Get saved prompt type preference (default, custom, or quick) for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @returns {Promise<string>} - 'default', 'custom', or 'quick'
   */
  async getPromptTypePreference(contentType) {
    const preferences = await this.storageService.get(this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE) || {};
    return preferences[contentType] || 'default';
  }

  /**
   * Save prompt type preference for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @param {string} promptType - The prompt type ('default', 'custom', or 'quick')
   * @returns {Promise<string>} - Saved preference value
   */
  async savePromptTypePreference(contentType, promptType) {
    const preferences = await this.storageService.get(this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE) || {};
    preferences[contentType] = promptType;
    await this.storageService.set({ [this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE]: preferences });
    return preferences[contentType];
  }

  /**
   * Get selected prompt ID for a content type and prompt type
   * @param {string} contentType - Content type (general, reddit, youtube)
   * @param {string} promptType - Prompt type ('default', 'custom', or 'quick')
   * @returns {Promise<string>} - The prompt ID
   */
  async getSelectedPromptId(contentType, promptType) {
    const selections = await this.storageService.get(this.STORAGE_KEYS.SELECTED_PROMPT_IDS) || {};
    const key = `${contentType}-${promptType}`;
    
    // For default prompts, return content type as fallback
    if (promptType === 'default' && !selections[key]) {
      return contentType;
    }
    
    // For quick prompts, return 'quick' as fallback
    if (promptType === 'quick' && !selections[key]) {
      return 'quick';
    }
    
    return selections[key];
  }

  /**
   * Save selected prompt ID for a content type and prompt type
   * @param {string} contentType - Content type (general, reddit, youtube)
   * @param {string} promptType - Prompt type ('default', 'custom', or 'quick')
   * @param {string} promptId - The prompt ID to save
   * @returns {Promise<string>} - The saved prompt ID
   */
  async saveSelectedPromptId(contentType, promptType, promptId) {
    const selections = await this.storageService.get(this.STORAGE_KEYS.SELECTED_PROMPT_IDS) || {};
    const key = `${contentType}-${promptType}`;
    selections[key] = promptId;
    await this.storageService.set({ [this.STORAGE_KEYS.SELECTED_PROMPT_IDS]: selections });
    return promptId;
  }
  
  /**
   * Get saved quick prompt text for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @returns {Promise<string>} - The saved quick prompt text
   */
  async getQuickPromptText(contentType) {
    const quickPrompts = await this.storageService.get(this.STORAGE_KEYS.QUICK_PROMPTS) || {};
    return quickPrompts[contentType] || '';
  }

  /**
   * Save quick prompt text for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @param {string} text - The quick prompt text
   * @returns {Promise<string>} - The saved quick prompt text
   */
  async saveQuickPromptText(contentType, text) {
    const quickPrompts = await this.storageService.get(this.STORAGE_KEYS.QUICK_PROMPTS) || {};
    quickPrompts[contentType] = text;
    await this.storageService.set({ [this.STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts });
    return text;
  }
  
  /**
   * Clear the quick prompt text for a content type
   * @param {string} contentType - The content type to clear quick prompt for
   * @returns {Promise<boolean>} - Whether a prompt was cleared
   */
  async clearQuickPromptText(contentType) {
    try {
      console.log(`Attempting to clear quick prompt for ${contentType}`);
      const quickPrompts = await this.storageService.get(this.STORAGE_KEYS.QUICK_PROMPTS) || {};
      console.log(`Current quick prompts state:`, quickPrompts);
      
      // Check if we have quick prompts and if there's content for this type
      if (quickPrompts && quickPrompts[contentType]) {
        console.log(`Found existing prompt for ${contentType}, clearing it`);
        quickPrompts[contentType] = '';
        await this.storageService.set({ [this.STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts });
        console.log(`Successfully cleared quick prompt for ${contentType}`);
        return true;
      } else {
        console.log(`No quick prompt found for ${contentType}, nothing to clear`);
        return false;
      }
    } catch (error) {
      console.error(`Error clearing quick prompt for ${contentType}:`, error);
      // Don't throw, as this is cleanup code that shouldn't break the main flow
      return false;
    }
  }
}