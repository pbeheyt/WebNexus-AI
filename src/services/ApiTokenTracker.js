// src/services/ApiTokenTracker.js

const { STORAGE_KEYS } = require('../shared/constants');
const logger = require('../utils/logger');

/**
 * Comprehensive service for API token tracking, prompt storage, and cost accounting
 */
class ApiTokenTracker {
  //=========================================================================
  // TOKEN ESTIMATION METHODS
  //=========================================================================
  
  /**
   * Estimate tokens for a string using character-based approximation
   * @param {string} text - Input text
   * @returns {number} - Estimated token count
   */
  static estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Approx 4 chars per token
  }
  
  /**
   * Estimate tokens for a JSON object (serializes then counts)
   * @param {Object} object - Object to estimate tokens for
   * @returns {number} - Estimated token count
   */
  static estimateObjectTokens(object) {
    if (!object) return 0;
    try {
      const serialized = JSON.stringify(object);
      return this.estimateTokens(serialized);
    } catch (error) {
      logger.service.warn('ApiTokenTracker: Error estimating object tokens', { error });
      return 0;
    }
  }
  
  /**
   * Calculate pricing for token usage
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Object} - Pricing information
   */
  static calculateCost(inputTokens, outputTokens, modelConfig) {
    if (!modelConfig) return { totalCost: 0 };
    
    const inputPrice = modelConfig.inputTokenPrice || 0;
    const outputPrice = modelConfig.outputTokenPrice || 0;
    
    // Convert from price per million tokens (standard industry pricing)
    const inputCost = (inputTokens / 1000000) * inputPrice;
    const outputCost = (outputTokens / 1000000) * outputPrice;
    const totalCost = inputCost + outputCost;
    
    return {
      inputCost,
      outputCost,
      totalCost,
      inputTokenPrice: inputPrice,
      outputTokenPrice: outputPrice
    };
  }
  
  /**
   * Extract pricing information from model configuration
   * @param {Object} modelConfig - Model configuration 
   * @returns {Object|null} - Pricing information object or null
   */
  static getPricingInfo(modelConfig) {
    if (!modelConfig) return null;
    
    return {
      inputTokenPrice: modelConfig.inputTokenPrice || 0,
      outputTokenPrice: modelConfig.outputTokenPrice || 0
    };
  }
  
  //=========================================================================
  // PROMPT STORAGE METHODS
  //=========================================================================
  
  /**
   * Store an API prompt with metadata for a specific tab
   * @param {number} tabId - Tab ID
   * @param {string} promptText - The full text sent to API
   * @param {Object} params - Additional parameters
   * @returns {Promise<boolean>} - Success indicator
   */
  static async storePrompt(tabId, promptText, params = {}) {
    if (!tabId || !promptText) {
      logger.service.error('ApiTokenTracker: Missing required parameters for prompt storage');
      return false;
    }
    
    try {
      logger.service.info('Storing API prompt', { tabId });
      
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      
      // Initialize tab entry if needed
      if (!allPrompts[tabId]) {
        allPrompts[tabId] = [];
      }
      
      // Add new prompt record
      allPrompts[tabId].push({
        structuredPrompt: promptText,
        platformId: params.platformId || 'unknown',
        modelId: params.modelId || 'unknown',
        messageId: params.messageId || `msg_${Date.now()}`,
        timestamp: Date.now(),
        tokensUsed: params.tokensUsed || { input: 0, output: 0 },
        metadata: params.metadata || {}
      });
      
      // Save to storage
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts });
      
      // Initialize token metadata if needed (without adding tokens yet)
      await this.initializeTokenMetadata(tabId, {
        platformId: params.platformId,
        modelId: params.modelId
      });
      
      logger.service.info('API prompt stored successfully', { tabId });
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error storing prompt', { error });
      return false;
    }
  }
  
  /**
   * Get all stored prompts for a specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Array>} - Array of prompt records with metadata
   */
  static async getPrompts(tabId) {
    if (!tabId) return [];
    
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      return allPrompts[tabId] || [];
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error retrieving prompts', { error });
      return [];
    }
  }
  
  //=========================================================================
  // TOKEN TRACKING METHODS
  //=========================================================================
  
  /**
   * Initialize token metadata for a tab (without adding tokens)
   * @param {number} tabId - Tab ID
   * @param {Object} params - Basic metadata parameters
   * @returns {Promise<boolean>} - Success indicator
   */
  static async initializeTokenMetadata(tabId, params = {}) {
    if (!tabId) return false;
    
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      const allMetadata = result[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      
      // Only create new entry if it doesn't exist
      if (!allMetadata[tabId]) {
        allMetadata[tabId] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          promptTokens: 0,
          historyTokens: 0,
          systemTokens: 0,
          lastUpdated: Date.now(),
          platformId: params.platformId || 'unknown',
          modelId: params.modelId || 'unknown'
        };
        
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata });
      }
      
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error initializing token metadata', { error });
      return false;
    }
  }
  
  /**
   * Track tokens for a specific message and update metadata
   * @param {number} tabId - Tab ID
   * @param {string} messageId - Message ID
   * @param {Object} tokenInfo - Token counts to record
   * @param {Object} metadata - Additional metadata including pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  static async trackMessageTokens(tabId, messageId, tokenInfo, metadata = {}) {
    if (!tabId || !messageId || !tokenInfo) {
      logger.service.error('ApiTokenTracker: Missing required parameters for token tracking');
      return false;
    }
    
    try {
      // Update message-specific token info
      const messageUpdated = await this._updateMessageTokens(tabId, messageId, tokenInfo);
      if (!messageUpdated) return false;
      
      // Create token info with detailed breakdown
      const tokensUsed = {
        input: tokenInfo.input || 0,
        output: tokenInfo.output || 0,
        details: {
          promptTokens: tokenInfo.promptTokens || 0,
          historyTokens: tokenInfo.historyTokens || 0,
          systemTokens: tokenInfo.systemTokens || 0
        }
      };
      
      // Update tab-level token accounting with the enhanced token info
      await this._updateTokenMetadata(tabId, {
        tokensUsed,
        ...metadata
      });
      
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error tracking message tokens', { error });
      return false;
    }
  }
  
  /**
   * Get token usage statistics for a tab
   * @param {number} tabId - Tab ID 
   * @returns {Promise<Object>} - Token statistics
   */
  static async getTokenStatistics(tabId) {
    if (!tabId) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        promptTokens: 0,
        historyTokens: 0,
        systemTokens: 0,
        isCalculated: false
      };
    }
    
    try {
      const metadata = await this._getTokenMetadata(tabId);
      
      if (!metadata) {
        return {
          inputTokens: 0,
          outputTokens: 0, 
          totalCost: 0,
          promptTokens: 0,
          historyTokens: 0,
          systemTokens: 0,
          isCalculated: false
        };
      }
      
      return {
        inputTokens: metadata.totalInputTokens || 0,
        outputTokens: metadata.totalOutputTokens || 0,
        totalCost: metadata.totalCost || 0,
        promptTokens: metadata.promptTokens || 0,
        historyTokens: metadata.historyTokens || 0,
        systemTokens: metadata.systemTokens || 0,
        platformId: metadata.platformId,
        modelId: metadata.modelId,
        lastUpdated: metadata.lastUpdated,
        isCalculated: true
      };
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error getting token statistics', { error });
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        promptTokens: 0,
        historyTokens: 0,
        systemTokens: 0,
        isCalculated: false
      };
    }
  }
  
  /**
   * Calculate context window usage status
   * @param {number} tabId - Tab ID
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status
   */
  static async calculateContextStatus(tabId, modelConfig) {
    if (!tabId || !modelConfig || !modelConfig.contextWindow) {
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
    
    try {
      const tokenStats = await this.getTokenStatistics(tabId);
      
      if (!tokenStats.isCalculated) {
        return { 
          warningLevel: 'none',
          percentage: 0,
          tokensRemaining: 0,
          exceeds: false
        };
      }
      
      const totalTokens = tokenStats.inputTokens + tokenStats.outputTokens;
      const contextWindow = modelConfig.contextWindow;
      const tokensRemaining = Math.max(0, contextWindow - totalTokens);
      const percentage = (totalTokens / contextWindow) * 100;
      const exceeds = totalTokens > contextWindow;
      
      // Determine warning level
      let warningLevel = 'none';
      if (percentage > 90) {
        warningLevel = 'critical';
      } else if (percentage > 75) {
        warningLevel = 'warning';
      } else if (percentage > 50) {
        warningLevel = 'notice';
      }
      
      return {
        warningLevel,
        percentage,
        tokensRemaining,
        exceeds,
        totalTokens
      };
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error calculating context status', { error });
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
  }
  
  //=========================================================================
  // DATA MANAGEMENT METHODS
  //=========================================================================
  
  /**
   * Clear all token and prompt data for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success indicator
   */
  static async clearTabData(tabId) {
    if (!tabId) {
      logger.service.error('ApiTokenTracker: Missing tabId for clearing data');
      return false;
    }
    
    try {
      logger.service.info('Clearing tab token data', { tabId });
      
      // Get current data
      const promptsResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const metadataResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      
      // Remove tab entries
      const allPrompts = promptsResult[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      const allMetadata = metadataResult[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      
      delete allPrompts[tabId];
      delete allMetadata[tabId];
      
      // Save updated data
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts,
        [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata
      });
      
      logger.service.info('Tab data cleared successfully', { tabId });
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error clearing tab data', { error });
      return false;
    }
  }
  
  /**
   * Clean up data for closed tabs
   * @param {Array<number>} activeTabIds - Array of active tab IDs
   * @returns {Promise<boolean>} - Success indicator
   */
  static async cleanupInactiveTabs(activeTabIds) {
    if (!activeTabIds || !Array.isArray(activeTabIds)) {
      logger.service.error('ApiTokenTracker: Invalid activeTabIds for cleanup');
      return false;
    }
    
    try {
      // Create a Set for faster lookups
      const activeTabsSet = new Set(activeTabIds.map(id => id.toString()));
      
      // Get all data
      const promptsResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const metadataResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      
      const allPrompts = promptsResult[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      const allMetadata = metadataResult[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      
      // Check if any cleanup is needed
      let needsCleanup = false;
      
      // Clean up prompts
      for (const tabId of Object.keys(allPrompts)) {
        if (!activeTabsSet.has(tabId)) {
          delete allPrompts[tabId];
          needsCleanup = true;
        }
      }
      
      // Clean up metadata
      for (const tabId of Object.keys(allMetadata)) {
        if (!activeTabsSet.has(tabId)) {
          delete allMetadata[tabId];
          needsCleanup = true;
        }
      }
      
      // Update storage if needed
      if (needsCleanup) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts,
          [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata
        });
        
        logger.service.info('Cleaned up data for inactive tabs');
      }
      
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error cleaning up inactive tabs', { error });
      return false;
    }
  }
  
  //=========================================================================
  // PRIVATE IMPLEMENTATION METHODS
  //=========================================================================
  
  /**
   * Update token metadata for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {Object} params - Token parameters
   * @returns {Promise<boolean>} - Success indicator
   */
  static async _updateTokenMetadata(tabId, params = {}) {
    if (!tabId) return false;
    
    try {
      // Get current token metadata
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      const allMetadata = result[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      
      // Create or update tab entry
      if (!allMetadata[tabId]) {
        allMetadata[tabId] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          promptTokens: 0,
          historyTokens: 0,
          systemTokens: 0,
          lastUpdated: Date.now(),
          platformId: params.platformId || 'unknown',
          modelId: params.modelId || 'unknown'
        };
      }
      
      // Update with new token information if provided
      if (params.tokensUsed) {
        const inputTokens = params.tokensUsed.input || 0;
        const outputTokens = params.tokensUsed.output || 0;
        
        // Add to running totals
        allMetadata[tabId].totalInputTokens += inputTokens;
        allMetadata[tabId].totalOutputTokens += outputTokens;
        
        // Update detailed token breakdown if available
        if (params.tokensUsed.details) {
          allMetadata[tabId].promptTokens += params.tokensUsed.details.promptTokens || 0;
          allMetadata[tabId].historyTokens += params.tokensUsed.details.historyTokens || 0;
          allMetadata[tabId].systemTokens += params.tokensUsed.details.systemTokens || 0;
        }
        
        // Calculate cost if pricing info available
        if (params.pricing) {
          const inputCost = (inputTokens / 1000000) * (params.pricing.inputTokenPrice || 0);
          const outputCost = (outputTokens / 1000000) * (params.pricing.outputTokenPrice || 0);
          allMetadata[tabId].totalCost += (inputCost + outputCost);
        }
      }
      
      // Update metadata fields
      allMetadata[tabId].lastUpdated = Date.now();
      if (params.platformId) allMetadata[tabId].platformId = params.platformId;
      if (params.modelId) allMetadata[tabId].modelId = params.modelId;
      
      // Store updated metadata
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata });
      
      return true;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error updating token metadata', { error });
      return false;
    }
  }
  
  /**
   * Update token information for a specific message
   * @private
   * @param {number} tabId - Tab ID
   * @param {string} messageId - Message ID to update
   * @param {Object} tokenInfo - Token information
   * @returns {Promise<boolean>} - Success indicator
   */
  static async _updateMessageTokens(tabId, messageId, tokenInfo) {
    if (!tabId || !messageId || !tokenInfo) return false;
    
    try {
      // Get current prompts
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      
      // Find and update the specific message
      if (allPrompts[tabId]) {
        const promptIndex = allPrompts[tabId].findIndex(p => p.messageId === messageId);
        
        if (promptIndex >= 0) {
          // Update token information with detailed breakdown
          allPrompts[tabId][promptIndex].tokensUsed = {
            ...allPrompts[tabId][promptIndex].tokensUsed,
            ...tokenInfo,
            details: {
              promptTokens: tokenInfo.promptTokens || 0,
              historyTokens: tokenInfo.historyTokens || 0,
              systemTokens: tokenInfo.systemTokens || 0
            }
          };
          
          // Store updated data
          await chrome.storage.local.set({ [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error updating message tokens', { error });
      return false;
    }
  }
  
  /**
   * Get token metadata for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object|null>} - Token metadata object
   */
  static async _getTokenMetadata(tabId) {
    if (!tabId) return null;
    
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      const allMetadata = result[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      return allMetadata[tabId] || null;
    } catch (error) {
      logger.service.error('ApiTokenTracker: Error getting token metadata', { error });
      return null;
    }
  }
}

module.exports = ApiTokenTracker;