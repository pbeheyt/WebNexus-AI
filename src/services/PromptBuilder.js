/**
 * PromptBuilder.js - Builds prompts from templates and preferences
 * Responsible for dynamically constructing prompt templates with parameter substitution
 */
import configManager from './ConfigManager.js';
const logger = require('../utils/logger');

class PromptBuilder {
  constructor(configManager) {
    logger.service.info('Initializing PromptBuilder instance');
    this.configManager = configManager;
  }

  /**
   * Build prompt for a content type
   * @param {string} contentType - Content type (e.g., 'general', 'youtube')
   * @param {Object} preferences - User preferences for parameter values
   * @returns {Promise<string>} Built prompt text
   */
  async buildPrompt(contentType, preferences = {}) {
    logger.service.info(`Building prompt for content type: ${contentType}`, {
      contentType,
      preferencesKeys: Object.keys(preferences)
    });

    // Get the configuration
    const config = await this.configManager.getConfig();
    logger.service.info('Configuration retrieved successfully', config);
    
    // Get the template for this content type
    const template = config.defaultPrompts[contentType];
    if (!template || !template.baseTemplate) {
      logger.service.error(`Template not found for content type: ${contentType}`);
      throw new Error(`No template found for content type: ${contentType}`);
    }
    
    logger.service.info(`Template found for ${contentType}`, {
      templateName: template.name,
      hasParameters: !!template.parameters
    });
    
    // Start with the base template
    let prompt = template.baseTemplate;
    
    // Add type-specific instructions if available
    if (template.parameters?.typeSpecificInstructions?.values?.default) {
      prompt += '\n' + template.parameters.typeSpecificInstructions.values.default;
      logger.service.info('Added type-specific instructions to prompt');
    }
    
    // Process shared parameters
    logger.service.info(`Processing ${Object.keys(config.sharedParameters || {}).length} shared parameters`);
    for (const [paramKey, paramConfig] of Object.entries(config.sharedParameters || {})) {
      const userValue = preferences[paramKey];
      logger.service.info(`Processing shared parameter: ${paramKey}`, {
        paramKey,
        userValue: userValue !== undefined ? (typeof userValue === 'boolean' ? userValue.toString() : userValue) : 'undefined'
      });
      
      const originalLength = prompt.length;
      prompt = this._appendParameterValue(prompt, userValue, paramConfig, paramKey);
      
      if (prompt.length > originalLength) {
        logger.service.info(`Appended shared parameter value for: ${paramKey}`, {
          addedLength: prompt.length - originalLength
        });
      }
    }
    
    // Process content-specific parameters (except typeSpecificInstructions)
    if (template.parameters) {
      const specificParamKeys = Object.keys(template.parameters).filter(
        k => k !== 'typeSpecificInstructions' && !(k === 'commentAnalysis' && contentType !== 'youtube')
      );
      
      logger.service.info(`Processing ${specificParamKeys.length} content-specific parameters`);
      
      for (const [paramKey, paramConfig] of Object.entries(template.parameters)) {
        // Skip type-specific instructions as they're always added
        if (paramKey === 'typeSpecificInstructions') {
          continue;
        }
        
        // Skip commentAnalysis for non-YouTube content
        if (paramKey === 'commentAnalysis' && contentType !== 'youtube') {
          continue;
        }
        
        const userValue = preferences[paramKey];
        logger.service.info(`Processing content-specific parameter: ${paramKey}`, {
          paramKey,
          userValue: userValue !== undefined ? (typeof userValue === 'boolean' ? userValue.toString() : userValue) : 'undefined'
        });
        
        const originalLength = prompt.length;
        prompt = this._appendParameterValue(prompt, userValue, paramConfig, paramKey);
        
        if (prompt.length > originalLength) {
          logger.service.info(`Appended content-specific parameter value for: ${paramKey}`, {
            addedLength: prompt.length - originalLength
          });
        }
      }
    }
    
    logger.service.info(`Prompt building complete for ${contentType}`, {
      promptLength: prompt.length,
      parameterCount: Object.keys(preferences).length
    });
    
    return prompt;
  }

  /**
   * Append parameter value to prompt text
   * @private
   * @param {string} prompt - Current prompt text
   * @param {string|boolean} userValue - User preference value
   * @param {Object} paramConfig - Parameter configuration
   * @param {string} paramKey - Parameter key
   * @returns {string} Updated prompt text
   */
  _appendParameterValue(prompt, userValue, paramConfig, paramKey) {
    // Handle boolean parameters (true/false)
    if (typeof userValue === 'boolean') {
      if (userValue === true && paramConfig.values?.true) {
        logger.service.info(`Appending boolean parameter ${paramKey}=true`);
        return prompt + '\n' + paramConfig.values.true;
      }
      logger.service.info(`Boolean parameter ${paramKey}=${userValue} not appended`);
      return prompt;
    }
    
    // Handle regular parameters with string values
    if (userValue && paramConfig.values?.[userValue]) {
      logger.service.info(`Appending value for parameter ${paramKey}=${userValue}`);
      return prompt + '\n' + paramConfig.values[userValue];
    }
    
    // Default to first value if no preference specified
    const firstValue = Object.keys(paramConfig.values || {})[0];
    if (firstValue && paramConfig.values[firstValue]) {
      logger.service.info(`Using default value for parameter ${paramKey}=${firstValue}`, {
        reason: userValue ? 'Value not found in config' : 'No user preference specified'
      });
      return prompt + '\n' + paramConfig.values[firstValue];
    }
    
    logger.service.warn(`No valid value found for parameter ${paramKey}`);
    return prompt;
  }

  /**
   * Get available parameter options for a content type
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Parameter options by parameter key
   */
  async getParameterOptions(contentType) {
    logger.service.info(`Retrieving parameter options for content type: ${contentType}`);
    
    const config = await this.configManager.getConfig();
    
    // Get parameters with their keys
    const sharedParamsEntries = Object.entries(config.sharedParameters || {});
    
    const template = config.defaultPrompts[contentType];
    const contentParamsEntries = Object.entries(template?.parameters || {});
    
    // Create combined array of parameter entries with source information
    const allParamsEntries = [
      ...sharedParamsEntries.map(([key, param]) => ({ 
        key, 
        param, 
        order: param.order || 0,
        source: 'shared' 
      })),
      ...contentParamsEntries.map(([key, param]) => ({ 
        key, 
        param, 
        order: param.order || 0,
        source: 'content' 
      }))
    ];
    
    // Group by key to handle duplicates (content overrides shared)
    const groupedByKey = {};
    allParamsEntries.forEach(entry => {
      // If entry doesn't exist yet, or this is from content (which overrides shared)
      if (!groupedByKey[entry.key] || entry.source === 'content') {
        groupedByKey[entry.key] = entry;
      }
    });
    
    // Convert to array and sort by order
    const sortedEntries = Object.values(groupedByKey)
      .sort((a, b) => a.order - b.order);
    
    // Convert back to object
    const orderedParams = {};
    sortedEntries.forEach(entry => {
      orderedParams[entry.key] = entry.param;
    });
    
    // Remove non-configurable parameters
    delete orderedParams.typeSpecificInstructions;
    if (contentType !== 'youtube') {
      delete orderedParams.commentAnalysis;
    }
    
    logger.service.info(`Final parameter options count for ${contentType}: ${Object.keys(orderedParams).length}`);
    return orderedParams;
  }

  /**
   * Get default preferences for a content type
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Default preferences
   */
  async getDefaultPreferences(contentType) {
    logger.service.info(`Generating default preferences for content type: ${contentType}`);
    
    const paramOptions = await this.getParameterOptions(contentType);
    
    // Use first value of each parameter as default
    const defaults = {};
    for (const [paramKey, paramConfig] of Object.entries(paramOptions)) {
      // For boolean parameters
      if (paramConfig.values && 
          Object.keys(paramConfig.values).length === 2 &&
          'true' in paramConfig.values && 'false' in paramConfig.values) {
        defaults[paramKey] = false; // Default to false for boolean params
        logger.service.info(`Setting default for boolean parameter ${paramKey}=false`);
      } 
      // For regular parameters
      else if (paramConfig.values && Object.keys(paramConfig.values).length > 0) {
        const defaultKey = Object.keys(paramConfig.values)[0];
        defaults[paramKey] = defaultKey;
        logger.service.info(`Setting default for parameter ${paramKey}=${defaultKey}`);
      } else {
        logger.service.warn(`No default value available for parameter ${paramKey}`);
      }
    }
    
    logger.service.info(`Default preferences generated for ${contentType}`, {
      parametersCount: Object.keys(defaults).length
    });
    
    return defaults;
  }
}

// Create singleton instance
const promptBuilder = new PromptBuilder(configManager);
export default promptBuilder;