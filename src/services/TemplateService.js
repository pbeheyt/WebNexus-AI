/**
 * TemplateService.js - Template operations service
 * Manages all template-related functionality
 */
const configManager = require('./ConfigManager');

class TemplateService {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Get all parameters for a content type
   * @param {string} contentType - Content type or 'shared' for shared parameters
   * @returns {Promise<Array>} Array of parameters
   */
  async getParameters(contentType) {
    const config = await this.configManager.getConfig();
    
    if (contentType === 'shared') {
      return this._convertParametersToArray(config.sharedParameters);
    }
    
    // Content type specific parameters
    const template = config.defaultPrompts[contentType];
    if (template && template.parameters) {
      return this._convertParametersToArray(template.parameters);
    }
    
    return [];
  }

  /**
   * Update parameter name
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} newName - New parameter name
   * @returns {Promise<Object>} Updated parameter
   */
  async updateParameterName(contentType, parameterId, newName) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (contentType === 'shared') {
        if (newConfig.sharedParameters[parameterId]) {
          newConfig.sharedParameters[parameterId].param_name = newName;
        }
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]) {
        newConfig.defaultPrompts[contentType].parameters[parameterId].param_name = newName;
      }
      
      return newConfig;
    });
  }

  /**
   * Update parameter value for list and checkbox types
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - Value key to update
   * @param {string} newValue - New value content
   * @returns {Promise<Object>} Updated configuration
   */
  async updateParameterValue(contentType, parameterId, valueKey, newValue) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      let parameter;
      if (contentType === 'shared') {
        parameter = newConfig.sharedParameters[parameterId];
      } else {
        parameter = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId];
      }
      
      if (parameter) {
        // Ensure values object exists for list and checkbox types
        if (['list', 'checkbox'].includes(parameter.type)) {
          if (!parameter.values) {
            parameter.values = {};
          }
          // Add or update the value regardless of whether it existed before
          parameter.values[valueKey] = newValue;
        }
      }
      
      return newConfig;
    });
  }
  
  /**
   * Update single value parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} newValue - New value content
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSingleValue(contentType, parameterId, newValue) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (contentType === 'shared') {
        if (newConfig.sharedParameters[parameterId]) {
          newConfig.sharedParameters[parameterId].value = newValue;
        }
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]) {
        newConfig.defaultPrompts[contentType].parameters[parameterId].value = newValue;
      }
      
      return newConfig;
    });
  }

  /**
   * Add new value to list or checkbox parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - New value key
   * @param {string} value - Value content
   * @returns {Promise<Object>} Updated configuration
   */
  async addParameterValue(contentType, parameterId, valueKey, value) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      let parameter;
      if (contentType === 'shared') {
        parameter = newConfig.sharedParameters[parameterId];
      } else {
        parameter = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId];
      }
      
      if (parameter) {
        // Only applicable to list and checkbox types
        if (['list', 'checkbox'].includes(parameter.type) && parameter.values) {
          parameter.values[valueKey] = value;
        } else {
          throw new Error(`Cannot add values to parameter of type '${parameter.type}'`);
        }
      }
      
      return newConfig;
    });
  }

  /**
   * Delete parameter value (only for list type)
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - Value key to delete
   * @returns {Promise<Object>} Updated configuration
   */
  async deleteParameterValue(contentType, parameterId, valueKey) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      let parameter;
      if (contentType === 'shared') {
        parameter = newConfig.sharedParameters[parameterId];
      } else {
        parameter = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId];
      }
      
      if (parameter?.values && valueKey in parameter.values) {
        // Only allow deleting values from list type
        if (parameter.type === 'list') {
          // Check there's at least one other value
          if (Object.keys(parameter.values).length <= 1) {
            throw new Error('Cannot delete the last value of a list parameter');
          }
          
          delete parameter.values[valueKey];
        } else if (parameter.type === 'checkbox') {
          throw new Error('Cannot delete values from checkbox parameters');
        }
      }
      
      return newConfig;
    });
  }

  /**
   * Add new parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {Object} paramData - Parameter data
   * @returns {Promise<Object>} Updated configuration with new parameter ID
   */
  async addParameter(contentType, paramData) {
    const paramId = `param_${Date.now()}`;
    
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      // Validate parameter data
      if (!paramData.param_name) {
        throw new Error('Parameter name is required');
      }
      
      if (!paramData.type || !['list', 'checkbox', 'single'].includes(paramData.type)) {
        throw new Error('Valid parameter type (list, checkbox, or single) is required');
      }
      
      // Create parameter object based on type
      const newParam = {
        param_name: paramData.param_name,
        type: paramData.type
      };
      
      // Add type-specific properties
      switch (paramData.type) {
        case 'list':
          if (!paramData.values || Object.keys(paramData.values).length === 0) {
            throw new Error('List parameters must have at least one value');
          }
          newParam.values = paramData.values;
          break;
          
        case 'checkbox':
          if (!paramData.values?.true || paramData.values?.false === undefined) {
            throw new Error('Checkbox parameters must have true and false values');
          }
          newParam.values = {
            true: paramData.values.true,
            false: paramData.values.false
          };
          break;
          
        case 'single':
          if (paramData.value === undefined) {
            throw new Error('Single parameters must have a value');
          }
          newParam.value = paramData.value;
          break;
      }
      
      // Add parameter to configuration
      if (contentType === 'shared') {
        if (!newConfig.sharedParameters) {
          newConfig.sharedParameters = {};
        }
        newConfig.sharedParameters[paramId] = newParam;
      } else {
        if (!newConfig.defaultPrompts[contentType]) {
          newConfig.defaultPrompts[contentType] = {
            name: this._getContentTypeName(contentType),
            baseTemplate: `Analyze this ${this._getContentTypeName(contentType)}`,
            parameters: {}
          };
        }
        
        if (!newConfig.defaultPrompts[contentType].parameters) {
          newConfig.defaultPrompts[contentType].parameters = {};
        }
        
        newConfig.defaultPrompts[contentType].parameters[paramId] = newParam;
      }
      
      return newConfig;
    });
  }

  /**
   * Delete parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID to delete
   * @returns {Promise<Object>} Updated configuration
   */
  async deleteParameter(contentType, parameterId) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (contentType === 'shared') {
        if (newConfig.sharedParameters[parameterId]) {
          delete newConfig.sharedParameters[parameterId];
        }
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]) {
        delete newConfig.defaultPrompts[contentType].parameters[parameterId];
      }
      
      return newConfig;
    });
  }

  /**
   * Update base template for a content type
   * @param {string} contentType - Content type
   * @param {string} template - New base template text
   * @returns {Promise<Object>} Updated configuration
   */
  async updateBaseTemplate(contentType, template) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (newConfig.defaultPrompts[contentType]) {
        newConfig.defaultPrompts[contentType].baseTemplate = template;
      }
      
      return newConfig;
    });
  }

  /**
   * Reorder parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {number} newOrder - New order position
   * @returns {Promise<Object>} Updated configuration
   */
  async reorderParameter(contentType, parameterId, newOrder) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      // Determine which parameter collection to modify
      const paramCollection = contentType === 'shared' 
        ? newConfig.sharedParameters 
        : (newConfig.defaultPrompts[contentType]?.parameters);
      
      if (!paramCollection) return newConfig;
      
      // Convert parameters to array with current ordering
      const paramsArray = Object.entries(paramCollection)
        .map(([id, param]) => ({ id, ...param }));
      
      // Ensure every parameter has an order value
      paramsArray.forEach((param, idx) => {
        if (param.order === undefined) {
          param.order = idx;
        }
      });
      
      // Sort by current order
      paramsArray.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Find target parameter
      const paramIndex = paramsArray.findIndex(p => p.id === parameterId);
      if (paramIndex === -1) return newConfig;
      
      // Remove parameter from array
      const [paramToMove] = paramsArray.splice(paramIndex, 1);
      
      // Insert at new position (clamped to valid range)
      const targetIndex = Math.max(0, Math.min(newOrder, paramsArray.length));
      paramsArray.splice(targetIndex, 0, paramToMove);
      
      // Update explicit order values
      paramsArray.forEach((param, idx) => {
        param.order = idx;
      });
      
      // Convert back to object structure
      const updatedParams = {};
      paramsArray.forEach(param => {
        const { id, ...paramData } = param;
        updatedParams[id] = paramData;
      });
      
      // Update appropriate section
      if (contentType === 'shared') {
        newConfig.sharedParameters = updatedParams;
      } else if (newConfig.defaultPrompts[contentType]) {
        newConfig.defaultPrompts[contentType].parameters = updatedParams;
      }
      
      return newConfig;
    });
  }

  /**
   * Reorder parameter value (only applicable to list type)
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - Value key to reorder
   * @param {number} newPosition - New position index
   * @returns {Promise<Object>} Updated configuration
   */
  async reorderParameterValue(contentType, parameterId, valueKey, newPosition) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      // Get parameter
      let parameter;
      if (contentType === 'shared') {
        parameter = newConfig.sharedParameters[parameterId];
      } else {
        parameter = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId];
      }
      
      if (!parameter || !parameter.values) return newConfig;
      
      // Only allow reordering list type values
      if (parameter.type !== 'list') {
        throw new Error(`Cannot reorder values for parameter type '${parameter.type}'`);
      }
      
      // Convert to ordered array
      const valuesArray = Object.entries(parameter.values).map(([key, value], index) => ({
        key,
        value,
        order: index
      }));
      
      // Find target value
      const valueIndex = valuesArray.findIndex(v => v.key === valueKey);
      if (valueIndex === -1) return newConfig;
      
      // Remove value
      const [valueToMove] = valuesArray.splice(valueIndex, 1);
      
      // Insert at new position
      const targetIndex = Math.max(0, Math.min(newPosition, valuesArray.length));
      valuesArray.splice(targetIndex, 0, valueToMove);
      
      // Convert back to object
      const updatedValues = {};
      valuesArray.forEach(({key, value}) => {
        updatedValues[key] = value;
      });
      
      // Update config
      if (contentType === 'shared') {
        newConfig.sharedParameters[parameterId].values = updatedValues;
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]) {
        newConfig.defaultPrompts[contentType].parameters[parameterId].values = updatedValues;
      }
      
      return newConfig;
    });
  }
  
  /**
   * Change parameter type
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} newType - New parameter type
   * @param {Object} defaultValues - Default values for the new type
   * @returns {Promise<Object>} Updated configuration
   */
  async changeParameterType(contentType, parameterId, newType, defaultValues) {
    if (!['list', 'checkbox', 'single'].includes(newType)) {
      throw new Error(`Invalid parameter type: ${newType}`);
    }
    
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      let parameter;
      if (contentType === 'shared') {
        parameter = newConfig.sharedParameters[parameterId];
      } else {
        parameter = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId];
      }
      
      if (!parameter) {
        throw new Error('Parameter not found');
      }
      
      // Save parameter name
      const paramName = parameter.param_name;
      
      // Create new parameter structure based on type
      const updatedParam = {
        param_name: paramName,
        type: newType,
        order: parameter.order
      };
      
      switch (newType) {
        case 'list':
          // List needs at least one key-value pair
          updatedParam.values = defaultValues?.values || { 'default': 'Default list value' };
          break;
          
        case 'checkbox':
          // Checkbox needs true and false values
          updatedParam.values = {
            true: defaultValues?.values?.true || 'True value',
            false: defaultValues?.values?.false || ''
          };
          break;
          
        case 'single':
          // Single just needs a value
          updatedParam.value = defaultValues?.value || 'Default single value';
          break;
      }
      
      // Update parameter in config
      if (contentType === 'shared') {
        newConfig.sharedParameters[parameterId] = updatedParam;
      } else {
        newConfig.defaultPrompts[contentType].parameters[parameterId] = updatedParam;
      }
      
      return newConfig;
    });
  }

  /**
   * Convert parameter object to array with IDs
   * @private
   * @param {Object} parameters - Parameters object
   * @returns {Array} Array of parameters with IDs
   */
  _convertParametersToArray(parameters) {
    return Object.entries(parameters).map(([id, param], index) => ({
      id,
      order: param.order !== undefined ? param.order : index, // Ensure order exists
      ...param
    })).sort((a, b) => {
      // Sort by order value
      return (a.order) - (b.order);
    });
  }

  /**
   * Get friendly name for content type
   * @private
   * @param {string} contentType - Content type
   * @returns {string} Friendly name
   */
  _getContentTypeName(contentType) {
    const names = {
      general: 'Web Content',
      reddit: 'Reddit Post',
      youtube: 'YouTube Video',
      pdf: 'PDF Document',
      selected_text: 'Selected Text'
    };
    return names[contentType] || contentType;
  }
}

// Create singleton instance
const templateService = new TemplateService(configManager);
module.exports = templateService;