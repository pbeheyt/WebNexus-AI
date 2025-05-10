// src/services/UserDataService.js
import { STORAGE_KEYS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { ensureDefaultPrompts } from '../shared/utils/prompt-utils.js';
import {
  validateCredentialsData,
  validateModelParametersSettingsData,
  validatePromptsData,
  validateAllSettingsData,
} from '../shared/utils/importValidationUtils.js';

class UserDataService {
  _generateFilename(baseName) {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    return `webnexus-ai-${baseName}-settings-${dateSuffix}.json`;
  }

  async _handleExport(dataToExport, dataType, baseFilename) {
    logger.service.info(`Exporting data type: ${dataType}`);
    try {
      const exportObject = {
        version: 1,
        dataType: `${dataType}_v1`,
        exportedAt: new Date().toISOString(),
        data: dataToExport,
      };

      const jsonString = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = this._generateFilename(baseFilename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.service.info(`${dataType} exported successfully.`);
      return { success: true };
    } catch (error) {
      logger.service.error(`Error exporting ${dataType}:`, error);
      return { success: false, error: error.message || `Unknown ${dataType} export error` };
    }
  }

  async _handleImport(fileObject, expectedDataType, storageKey = null) {
    logger.service.info(`Importing data type: ${expectedDataType}`);
    if (!fileObject) {
      return { success: false, error: 'No file provided for import.' };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileContent = event.target.result;
          const parsedJson = JSON.parse(fileContent);

          if (
            !parsedJson ||
            typeof parsedJson.data === 'undefined'
          ) {
            throw new Error(
              `Invalid file format: Missing essential data structure.`
            );
          }

          // Validate that the dataType in the file matches what we expect for this import operation.
          // For 'AllSettings', expectedDataType is already versioned from the direct call.
          // For single settings, expectedDataType is now versioned by importSingleSetting.
          if (parsedJson.dataType !== expectedDataType) {
            throw new Error(
              `Invalid file content: Data type mismatch. Expected "${expectedDataType}" but file contains "${parsedJson.dataType || 'unknown'}".`
            );
          }

          // Run validation based on import type
          let validationResult;
          if (expectedDataType === 'WebNexusAI-AllSettings_v1') {
            validationResult = validateAllSettingsData(parsedJson.data);
          } else if (expectedDataType === 'WebNexusAI-Prompts_v1') {
            validationResult = validatePromptsData(parsedJson.data);
          } else if (expectedDataType === 'WebNexusAI-Credentials_v1') {
            validationResult = validateCredentialsData(parsedJson.data);
          } else if (expectedDataType === 'WebNexusAI-ModelParameters_v1') {
            validationResult = validateModelParametersSettingsData(parsedJson.data);
          } else {
            throw new Error(`Unknown expectedDataType for validation: ${expectedDataType}`);
          }

          if (!validationResult.isValid) {
            throw new Error(`Import validation failed: ${validationResult.error}`);
          }

          if (storageKey) { // Single setting import
            if (typeof parsedJson.data !== 'object') {
              throw new Error('Data for single setting import must be an object.');
            }
            await chrome.storage.local.set({ [storageKey]: parsedJson.data || {} });
            if (storageKey === STORAGE_KEYS.PROMPTS) {
              await ensureDefaultPrompts();
            }
          } else { // All settings import
            const { prompts, credentials, modelParametersSettings } = parsedJson.data;
            await chrome.storage.local.set({
              [STORAGE_KEYS.PROMPTS]: prompts || {},
              [STORAGE_KEYS.API_CREDENTIALS]: credentials || {},
              [STORAGE_KEYS.MODEL_PARAMETER_SETTINGS]: modelParametersSettings || {},
            });
            await ensureDefaultPrompts();
          }

          logger.service.info(`${expectedDataType} imported successfully.`);
          resolve({ success: true });
        } catch (error) {
          logger.service.error(`Error importing ${expectedDataType}:`, error);
          resolve({
            success: false,
            error: error.message || `Unknown ${expectedDataType} import error`,
          });
        }
      };
      reader.onerror = (error) => {
        logger.service.error(`Error reading file for ${expectedDataType} import:`, error);
        resolve({ success: false, error: 'Failed to read the import file.' });
      };
      reader.readAsText(fileObject);
    });
  }

  async exportAllSettings() {
    const keysToExport = [
      STORAGE_KEYS.PROMPTS,
      STORAGE_KEYS.API_CREDENTIALS,
      STORAGE_KEYS.MODEL_PARAMETER_SETTINGS,
    ];
    const storedData = await chrome.storage.local.get(keysToExport);
    const dataBundle = {
      prompts: storedData[STORAGE_KEYS.PROMPTS] || {},
      credentials: storedData[STORAGE_KEYS.API_CREDENTIALS] || {},
      modelParametersSettings: storedData[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {},
    };
    return this._handleExport(dataBundle, 'WebNexusAI-AllSettings', 'all');
  }

  async importAllSettings(fileObject) {
    return this._handleImport(fileObject, 'WebNexusAI-AllSettings');
  }

  async exportSingleSetting(storageKey, settingNameForFileAndType) {
    const result = await chrome.storage.local.get(storageKey);
    const dataToExport = result[storageKey] || {};
    // Construct dataType like "WebNexusAI-Prompts"
    const dataType = `WebNexusAI-${settingNameForFileAndType.charAt(0).toUpperCase() + settingNameForFileAndType.slice(1)}`;
    return this._handleExport(dataToExport, dataType, settingNameForFileAndType.toLowerCase());
  }

  async importSingleSetting(storageKey, fileObject) {
    // Determine settingNameFromFileAndType based on storageKey for dataType validation
    let settingNameForType;
    if (storageKey === STORAGE_KEYS.PROMPTS) settingNameForType = 'Prompts';
    else if (storageKey === STORAGE_KEYS.API_CREDENTIALS) settingNameForType = 'Credentials';
    else if (storageKey === STORAGE_KEYS.MODEL_PARAMETER_SETTINGS) settingNameForType = 'ModelParameters';
    else throw new Error('Invalid storage key for single import.');
    
    const expectedDataType = `WebNexusAI-${settingNameForType}_v1`;
    return this._handleImport(fileObject, expectedDataType, storageKey);
  }

  async _resetPrompts() {
    logger.service.info('Resetting all prompts and triggering repopulation...');
    try {
      // Remove prompts and the population flag
      await chrome.storage.local.remove([
        STORAGE_KEYS.PROMPTS,
        STORAGE_KEYS.INITIAL_PROMPTS_POPULATED, // Clear the flag
      ]);
      logger.service.info(
        'Prompts and initial population flag cleared from storage.'
      );

      // Send a message to the background to repopulate prompts
      // This will also call ensureDefaultPrompts() after repopulation.
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'triggerPromptRepopulation' },
          (response) => {
            if (chrome.runtime.lastError) {
              logger.service.error(
                'Error sending triggerPromptRepopulation message:',
                chrome.runtime.lastError.message
              );
              reject(
                new Error(
                  `Failed to trigger prompt repopulation: ${chrome.runtime.lastError.message}`
                )
              );
            } else if (response && response.success) {
              logger.service.info(
                'Background prompt repopulation triggered successfully.'
              );
              resolve();
            } else {
              logger.service.error(
                'Background prompt repopulation failed or no response.',
                response
              );
              reject(
                new Error(
                  response?.error ||
                    'Background prompt repopulation failed or no response.'
                )
              );
            }
          }
        );
      });

      logger.service.info(
        'Prompts reset and repopulation triggered successfully.'
      );
      // No need to call ensureDefaultPrompts() here anymore,
      // as populateInitialPromptsAndSetDefaults in background will handle it.
    } catch (error) {
      logger.service.error('Error during prompt reset and repopulation trigger:', error);
      // Re-throw to be caught by the calling function in DataManagementTab
      throw error;
    }
  }

  async _resetCredentials() {
    logger.service.info('Resetting API credentials...');
    await chrome.storage.local.remove(STORAGE_KEYS.API_CREDENTIALS);
    logger.service.info('API credentials reset.');
  }

  async _resetModelParameters() {
    logger.service.info('Resetting model parameters...');
    await chrome.storage.local.remove(STORAGE_KEYS.MODEL_PARAMETER_SETTINGS);
    logger.service.info('Model parameters reset.');
  }

  async resetSelectedSettings(dataType) {
    logger.service.info(`Attempting to reset settings for data type: ${dataType}`);
    try {
      if (dataType === 'all') {
        logger.service.info('Resetting all settings...');
        await this._resetPrompts();
        await this._resetCredentials();
        await this._resetModelParameters();
        logger.service.info('All settings reset successfully.');
      } else if (dataType === 'prompts') {
        await this._resetPrompts();
      } else if (dataType === 'credentials') {
        await this._resetCredentials();
      } else if (dataType === 'model-parameters') {
        await this._resetModelParameters();
      } else {
        throw new Error(`Invalid data type "${dataType}" specified for reset.`);
      }
      return { success: true };
    } catch (error) {
      logger.service.error(`Error resetting settings for ${dataType}:`, error);
      return { success: false, error: error.message || `Unknown reset error for ${dataType}` };
    }
  }
}

const userDataService = new UserDataService();
export default userDataService;
