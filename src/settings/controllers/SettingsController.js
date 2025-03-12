// Controller for settings operations
export default class SettingsController {
  constructor(contentTypeService, notificationManager) {
    this.contentTypeService = contentTypeService;
    this.notificationManager = notificationManager;
  }

  async getSettings(contentType) {
    try {
      return await this.contentTypeService.getSettings(contentType);
    } catch (error) {
      console.error('Error getting settings:', error);
      this.notificationManager.error(`Error loading settings: ${error.message}`);
      throw error;
    }
  }

  async updateSettings(contentType, settings) {
    try {
      const result = await this.contentTypeService.updateSettings(contentType, settings);
      return result;
    } catch (error) {
      console.error('Error updating settings:', error);
      this.notificationManager.error(`Error updating settings: ${error.message}`);
      throw error;
    }
  }

  getDefaultSettings(contentType) {
    return this.contentTypeService.getDefaultSettings(contentType);
  }
}