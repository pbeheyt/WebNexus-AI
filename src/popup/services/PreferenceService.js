// src/popup/services/PreferenceService.js
export default class PreferenceService {
  constructor(storageService) {
    this.storageService = storageService;
    this.STORAGE_KEYS = {
      PROMPT_TYPE_PREFERENCE: 'prompt_type_preference',
      SELECTED_PROMPT_IDS: 'selected_prompt_ids'
    };
  }

  /**
   * Get saved prompt type preference (default or custom) for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @returns {Promise<string>} - 'default' or 'custom'
   */
  async getPromptTypePreference(contentType) {
    const preferences = await this.storageService.get(this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE) || {};
    return preferences[contentType] || 'default';
  }

  /**
   * Save prompt type preference for a content type
   * @param {string} contentType - The content type (general, reddit, youtube)
   * @param {boolean} isDefault - Whether to use default (true) or custom (false) prompt
   * @returns {Promise<string>} - Saved preference value
   */
  async savePromptTypePreference(contentType, isDefault) {
    const preferences = await this.storageService.get(this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE) || {};
    preferences[contentType] = isDefault ? 'default' : 'custom';
    await this.storageService.set({ [this.STORAGE_KEYS.PROMPT_TYPE_PREFERENCE]: preferences });
    return preferences[contentType];
  }

  /**
   * Get selected prompt ID for a content type and prompt type
   * @param {string} contentType - Content type (general, reddit, youtube)
   * @param {boolean} isDefault - Whether using default (true) or custom (false) prompt
   * @returns {Promise<string>} - The prompt ID
   */
  async getSelectedPromptId(contentType, isDefault) {
    const selections = await this.storageService.get(this.STORAGE_KEYS.SELECTED_PROMPT_IDS) || {};
    const key = `${contentType}-${isDefault ? 'default' : 'custom'}`;
    
    // For default prompts, return content type as fallback
    if (isDefault && !selections[key]) {
      return contentType;
    }
    
    return selections[key];
  }

  /**
   * Save selected prompt ID for a content type and prompt type
   * @param {string} contentType - Content type (general, reddit, youtube)
   * @param {boolean} isDefault - Whether using default (true) or custom (false) prompt
   * @param {string} promptId - The prompt ID to save
   * @returns {Promise<string>} - The saved prompt ID
   */
  async saveSelectedPromptId(contentType, isDefault, promptId) {
    const selections = await this.storageService.get(this.STORAGE_KEYS.SELECTED_PROMPT_IDS) || {};
    const key = `${contentType}-${isDefault ? 'default' : 'custom'}`;
    selections[key] = promptId;
    await this.storageService.set({ [this.STORAGE_KEYS.SELECTED_PROMPT_IDS]: selections });
    return promptId;
  }
}