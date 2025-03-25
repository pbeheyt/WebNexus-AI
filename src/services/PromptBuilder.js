/**
 * PromptBuilder.js - Builds prompts from templates and preferences
 * Responsible for dynamically constructing prompt templates with parameter substitution and instruction formatting
 */
const configManager = require('./ConfigManager');
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
    if (!template) {
      logger.service.error(`Template not found for content type: ${contentType}`);
      throw new Error(`No template found for content type: ${contentType}`);
    }
    
    logger.service.info(`Template found for ${contentType}`, {
      templateName: template.name,
      hasParameters: !!template.parameters
    });
    
    // Initialize prompt as empty string
    let prompt = '';
    
    // Initialize instruction counter
    let instructionCounter = 1;
    
    // Get all parameters in the correct order
    let allParameters = await this._getOrderedParameters(contentType, config);
    
    // Process each parameter in order
    for (const paramEntry of allParameters) {
      const { key, paramConfig, source } = paramEntry;
      const userValue = preferences[key];
      
      logger.service.info(`Processing parameter: ${key}`, {
        paramKey: key,
        paramType: paramConfig.type,
        source: source,
        userValue: userValue !== undefined ? (typeof userValue === 'boolean' ? userValue.toString() : userValue) : 'undefined'
      });
      
      const paramValue = this._getParameterValue(paramConfig, userValue, key);
      
      // Only add if there's a value to add
      if (paramValue) {
        // Add instruction header with the format "## INSTRUCTION X"
        const header = `## INSTRUCTION ${instructionCounter}`;
        
        // Add to prompt with a newline between instruction header and content
        prompt += `${prompt ? '\n' : ''}${header}\n${paramValue}`;
        instructionCounter++;
        
        logger.service.info(`Added parameter: ${key} with instruction #${instructionCounter - 1}`);
      }
    }
    
    logger.service.info(`Prompt building complete for ${contentType}`, {
      promptLength: prompt.length,
      parameterCount: Object.keys(preferences).length,
      instructionsCount: instructionCounter - 1
    });
    
    return prompt;
  }
  
  /**
   * Get all parameters in the correct order
   * @private
   * @param {string} contentType - Content type
   * @param {Object} config - Configuration object
   * @returns {Promise<Array>} Ordered parameters
   */
  async _getOrderedParameters(contentType, config) {
    // Get content-specific parameters
    const contentParams = Object.entries(config.defaultPrompts[contentType]?.parameters || {})
      .map(([key, param]) => ({
        key,
        paramConfig: param,
        source: 'content',
        order: param.order || 0
      }));
    
    // Get shared parameters
    const sharedParams = Object.entries(config.sharedParameters || {})
      .map(([key, param]) => ({
        key,
        paramConfig: param,
        source: 'shared',
        order: param.order || 0
      }));
    
    // Sort each set of parameters internally
    contentParams.sort((a, b) => a.order - b.order);
    sharedParams.sort((a, b) => a.order - b.order);
    
    // Combine with content-specific parameters first
    return [...contentParams, ...sharedParams];
  }

  /**
   * Get parameter value based on user preference and parameter configuration
   * @private
   * @param {Object} paramConfig - Parameter configuration
   * @param {any} userValue - User preference value
   * @param {string} paramKey - Parameter key
   * @returns {string} Parameter value or empty string
   */
  _getParameterValue(paramConfig, userValue, paramKey) {
    // Handle based on parameter type
    const paramType = paramConfig.type || 'list';
    
    switch (paramType) {
      case 'single':
        // Single value parameters are always included
        logger.service.info(`Using single value parameter ${paramKey}`);
        return paramConfig.value || '';
      
      case 'checkbox':
        // Checkbox parameters (true/false)
        if (typeof userValue === 'boolean') {
          if (userValue === true && paramConfig.values?.true) {
            logger.service.info(`Using checkbox parameter ${paramKey}=true`);
            return paramConfig.values.true;
          }
          logger.service.info(`Checkbox parameter ${paramKey}=${userValue} not used (false value)`);
          return '';
        }
        // Default to false if not explicitly set
        logger.service.info(`Checkbox parameter ${paramKey} defaulting to false`);
        return '';
      
      case 'list':
      default:
        // List parameters (multiple options)
        if (userValue && paramConfig.values?.[userValue]) {
          logger.service.info(`Using list parameter ${paramKey}=${userValue}`);
          return paramConfig.values[userValue];
        }
        
        // Default to first value if no preference specified
        const firstValue = Object.keys(paramConfig.values || {})[0];
        if (firstValue && paramConfig.values[firstValue]) {
          logger.service.info(`Using default value for list parameter ${paramKey}=${firstValue}`, {
            reason: userValue ? 'Value not found in config' : 'No user preference specified'
          });
          return paramConfig.values[firstValue];
        }
        
        logger.service.warn(`No valid value found for parameter ${paramKey}`);
        return '';
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
    
    // Remove non-configurable parameters
    delete orderedParams.baseInstruction;
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
module.exports = promptBuilder;