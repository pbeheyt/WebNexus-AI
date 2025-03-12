// src/settings/controllers/PromptController.js
export default class PromptController {
  constructor(promptService, notificationManager) {
    this.promptService = promptService;
    this.notificationManager = notificationManager;
  }

  async getPromptsByType(contentType) {
    try {
      return await this.promptService.getPromptsByType(contentType);
    } catch (error) {
      console.error('Error getting prompts by type:', error);
      this.notificationManager.error(`Error loading prompts: ${error.message}`);
      throw error;
    }
  }

  // Add similar delegating methods for other prompt operations
  async createPrompt(name, content, contentType) {
    try {
      return await this.promptService.createPrompt(name, content, contentType);
    } catch (error) {
      this.notificationManager.error(`Error creating prompt: ${error.message}`);
      throw error;
    }
  }

  async updatePrompt(id, promptData) {
    try {
      return await this.promptService.updatePrompt(id, promptData);
    } catch (error) {
      this.notificationManager.error(`Error updating prompt: ${error.message}`);
      throw error;
    }
  }

  async deletePrompt(id, contentType) {
    try {
      return await this.promptService.deletePrompt(id, contentType);
    } catch (error) {
      this.notificationManager.error(`Error deleting prompt: ${error.message}`);
      throw error;
    }
  }

  async setPreferredPrompt(id, contentType) {
    try {
      return await this.promptService.setPreferredPrompt(id, contentType);
    } catch (error) {
      this.notificationManager.error(`Error setting preferred prompt: ${error.message}`);
      throw error;
    }
  }
}