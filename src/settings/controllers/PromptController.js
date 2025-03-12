// Controller for prompt operations
export default class PromptController {
  constructor(promptService, notificationManager) {
    this.promptService = promptService;
    this.notificationManager = notificationManager;
  }

  async getPromptsByType(contentType) {
    try {
      return await this.promptService.getPromptsByType(contentType);
    } catch (error) {
      console.error('Error getting prompts:', error);
      this.notificationManager.error(`Error loading prompts: ${error.message}`);
      throw error;
    }
  }

  async createPrompt(name, content, contentType) {
    try {
      const prompt = await this.promptService.createPrompt(name, content, contentType);
      return prompt;
    } catch (error) {
      console.error('Error creating prompt:', error);
      this.notificationManager.error(`Error creating prompt: ${error.message}`);
      throw error;
    }
  }

  async updatePrompt(id, promptData) {
    try {
      const prompt = await this.promptService.updatePrompt(id, promptData);
      return prompt;
    } catch (error) {
      console.error('Error updating prompt:', error);
      this.notificationManager.error(`Error updating prompt: ${error.message}`);
      throw error;
    }
  }

  async deletePrompt(id, contentType) {
    try {
      const result = await this.promptService.deletePrompt(id, contentType);
      return result;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      this.notificationManager.error(`Error deleting prompt: ${error.message}`);
      throw error;
    }
  }

  async setPreferredPrompt(id, contentType) {
    try {
      const result = await this.promptService.setPreferredPrompt(id, contentType);
      return result;
    } catch (error) {
      console.error('Error setting preferred prompt:', error);
      this.notificationManager.error(`Error setting preferred prompt: ${error.message}`);
      throw error;
    }
  }
}