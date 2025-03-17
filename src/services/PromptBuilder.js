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
    
    // Add type-specific instructions if available (now as a single-value parameter)
    if (template.parameters?.typeSpecificInstructions?.type === 'single' && 
        template.parameters?.typeSpecificInstructions?.value) {
      prompt += '\n' + template.parameters.typeSpecificInstructions.value;
      logger.service.info('Added type-specific instructions to prompt');
    }
    
    // Process shared parameters
    logger.service.info(`Processing ${Object.keys(config.sharedParameters || {}).length} shared parameters`);
    for (const [paramKey, paramConfig] of Object.entries(config.sharedParameters || {})) {
      const userValue = preferences[paramKey];
      logger.service.info(`Processing shared parameter: ${paramKey}`, {
        paramKey,
        paramType: paramConfig.type,
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
    
    // Process content-specific parameters
    if (template.parameters) {
      const specificParamKeys = Object.keys(template.parameters).filter(
        k => k !== 'typeSpecificInstructions'
      );
      
      logger.service.info(`Processing ${specificParamKeys.length} content-specific parameters`);
      
      for (const [paramKey, paramConfig] of Object.entries(template.parameters)) {
        // Skip type-specific instructions as they're always added
        if (paramKey === 'typeSpecificInstructions') {
          continue;
        }
        
        const userValue = preferences[paramKey];
        logger.service.info(`Processing content-specific parameter: ${paramKey}`, {
          paramKey,
          paramType: paramConfig.type,
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
   * Append parameter value to prompt text based on parameter type
   * @private
   * @param {string} prompt - Current prompt text
   * @param {string|boolean} userValue - User preference value
   * @param {Object} paramConfig - Parameter configuration
   * @param {string} paramKey - Parameter key
   * @returns {string} Updated prompt text
   */
  _appendParameterValue(prompt, userValue, paramConfig, paramKey) {
    // Handle based on parameter type
    const paramType = paramConfig.type || 'list';
    
    switch (paramType) {
      case 'single':
        // Single value parameters are always included
        logger.service.info(`Appending single value parameter ${paramKey}`);
        return prompt + '\n' + paramConfig.value;
      
      case 'checkbox':
        // Checkbox parameters (true/false)
        if (typeof userValue === 'boolean') {
          if (userValue === true && paramConfig.values?.true) {
            logger.service.info(`Appending checkbox parameter ${paramKey}=true`);
            return prompt + '\n' + paramConfig.values.true;
          }
          logger.service.info(`Checkbox parameter ${paramKey}=${userValue} not appended (false value)`);
          return prompt;
        }
        // Default to false if not explicitly set
        logger.service.info(`Checkbox parameter ${paramKey} defaulting to false`);
        return prompt;
      
      case 'list':
      default:
        // List parameters (multiple options)
        if (userValue && paramConfig.values?.[userValue]) {
          logger.service.info(`Appending list parameter ${paramKey}=${userValue}`);
          return prompt + '\n' + paramConfig.values[userValue];
        }
        
        // Default to first value if no preference specified
        const firstValue = Object.keys(paramConfig.values || {})[0];
        if (firstValue && paramConfig.values[firstValue]) {
          logger.service.info(`Using default value for list parameter ${paramKey}=${firstValue}`, {
            reason: userValue ? 'Value not found in config' : 'No user preference specified'
          });
          return prompt + '\n' + paramConfig.values[firstValue];
        }
        
        logger.service.warn(`No valid value found for parameter ${paramKey}`);
        return prompt;
    }
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
    
    // Remove non-configurable parameters (typeSpecificInstructions is single-value)
    delete orderedParams.typeSpecificInstructions;
    
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
    
    // Create defaults based on parameter type
    const defaults = {};
    for (const [paramKey, paramConfig] of Object.entries(paramOptions)) {
      const paramType = paramConfig.type || 'list';
      
      switch (paramType) {
        case 'single':
          // Single value parameters don't need preferences as they're always included
          logger.service.info(`Single value parameter ${paramKey} - no preference needed`);
          break;
          
        case 'checkbox':
          // Default checkbox parameters to false
          defaults[paramKey] = false;
          logger.service.info(`Setting default for checkbox parameter ${paramKey}=false`);
          break;
          
        case 'list':
        default:
          // For list parameters, use first value as default
          if (paramConfig.values && Object.keys(paramConfig.values).length > 0) {
            const defaultKey = Object.keys(paramConfig.values)[0];
            defaults[paramKey] = defaultKey;
            logger.service.info(`Setting default for list parameter ${paramKey}=${defaultKey}`);
          } else {
            logger.service.warn(`No default value available for list parameter ${paramKey}`);
          }
          break;
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