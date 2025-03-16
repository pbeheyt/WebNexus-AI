/**
 * TemplateService.js - Template operations service
 * Manages all template-related functionality
 */
import configManager from './ConfigManager.js';

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
   * BACKWARD COMPATIBILITY: Get sorted parameters for a content type
   * @param {string} contentType - Content type or 'shared' for shared parameters
   * @returns {Promise<Array>} Array of parameters
   */
  async getSortedParameters(contentType) {
    console.warn('Deprecated: Use getParameters() instead');
    return this.getParameters(contentType);
  }

  /**
   * BACKWARD COMPATIBILITY: Reset all customizations to defaults
   * @returns {Promise<Object>} The default configuration
   */
  async resetAllCustomizations() {
    console.warn('Deprecated: Use configManager.resetConfig() instead');
    return this.configManager.resetConfig();
  }

  /**
   * BACKWARD COMPATIBILITY: Get a specific parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} paramId - Parameter ID
   * @returns {Promise<Object>} The parameter object
   */
  async getParameter(contentType, paramId) {
    console.warn('Deprecated: Use getParameters() and filter by ID instead');
    const parameters = await this.getParameters(contentType);
    return parameters.find(param => param.id === paramId) || null;
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
   * Update parameter value
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - Value key to update
   * @param {string} newValue - New value content
   * @returns {Promise<Object>} Updated configuration
   */
  async updateParameterValue(contentType, parameterId, valueKey, newValue) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (contentType === 'shared') {
        if (newConfig.sharedParameters[parameterId]?.values?.[valueKey] !== undefined) {
          newConfig.sharedParameters[parameterId].values[valueKey] = newValue;
        }
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]?.values?.[valueKey] !== undefined) {
        newConfig.defaultPrompts[contentType].parameters[parameterId].values[valueKey] = newValue;
      }
      
      return newConfig;
    });
  }

  /**
   * Add new value to parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - New value key
   * @param {string} value - Value content
   * @returns {Promise<Object>} Updated configuration
   */
  async addParameterValue(contentType, parameterId, valueKey, value) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      if (contentType === 'shared') {
        if (newConfig.sharedParameters[parameterId]) {
          newConfig.sharedParameters[parameterId].values[valueKey] = value;
        }
      } else if (newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]) {
        newConfig.defaultPrompts[contentType].parameters[parameterId].values[valueKey] = value;
      }
      
      return newConfig;
    });
  }

  /**
   * Delete parameter value
   * @param {string} contentType - Content type or 'shared'
   * @param {string} parameterId - Parameter ID
   * @param {string} valueKey - Value key to delete
   * @returns {Promise<Object>} Updated configuration
   */
  async deleteParameterValue(contentType, parameterId, valueKey) {
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      let paramValues;
      if (contentType === 'shared') {
        paramValues = newConfig.sharedParameters[parameterId]?.values;
      } else {
        paramValues = newConfig.defaultPrompts[contentType]?.parameters?.[parameterId]?.values;
      }
      
      if (paramValues && valueKey in paramValues) {
        // Check there's at least one other value
        if (Object.keys(paramValues).length <= 1) {
          throw new Error('Cannot delete the last value of a parameter');
        }
        
        delete paramValues[valueKey];
      }
      
      return newConfig;
    });
  }

  /**
   * Add new parameter
   * @param {string} contentType - Content type or 'shared'
   * @param {Object} paramData - Parameter data with name and default value
   * @returns {Promise<Object>} Updated configuration with new parameter ID
   */
  async addParameter(contentType, paramData) {
    const paramId = `param_${Date.now()}`;
    
    return this.configManager.updateConfig(config => {
      const newConfig = { ...config };
      
      const newParam = {
        param_name: paramData.param_name || 'New Parameter',
        values: paramData.values || { default: 'Default Value' },
      };
      
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
        .map(([id, param]) => ({ id, ...param }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
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
   * Convert parameter object to array with IDs
   * @private
   * @param {Object} parameters - Parameters object
   * @returns {Array} Array of parameters with IDs
   */
  _convertParametersToArray(parameters) {
    return Object.entries(parameters).map(([id, param]) => ({
      id,
      ...param
    })).sort((a, b) => {
      // Sort by order if present, otherwise alphabetically by name
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return (a.param_name || '').localeCompare(b.param_name || '');
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
export default templateService;