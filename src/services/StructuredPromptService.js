// src/services/StructuredPromptService.js

const { STORAGE_KEYS } = require('../shared/constants');
const logger = require('../utils/logger');

/**
 * Service for managing per-tab structured prompts and token accounting
 */
class StructuredPromptService {
  /**
   * Store structured prompt for a specific tab
   * @param {number} tabId - Tab ID
   * @param {string} structuredPrompt - The full text sent to API
   * @param {Object} params - Additional parameters
   * @param {string} params.platformId - AI platform ID
   * @param {string} params.modelId - Model ID
   * @param {string} params.messageId - Associated message ID in conversation
   * @param {Object} params.tokensUsed - Token counts if available
   * @param {Object} params.metadata - Additional context information
   * @returns {Promise<boolean>} - Success indicator
   */
  static async storeStructuredPrompt(tabId, structuredPrompt, params = {}) {
    if (!tabId || !structuredPrompt) {
      logger.service.error('StructuredPromptService: Missing required parameters');
      return false;
    }

    try {
      logger.service.info('Storing structured prompt', { tabId });

      // Get current stored prompts
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};

      // Create or update tab entry
      if (!allPrompts[tabId]) {
        allPrompts[tabId] = [];
      }

      // Add new prompt with metadata
      allPrompts[tabId].push({
        structuredPrompt,
        platformId: params.platformId || 'unknown',
        modelId: params.modelId || 'unknown',
        messageId: params.messageId || `msg_${Date.now()}`,
        timestamp: Date.now(),
        tokensUsed: params.tokensUsed || { input: 0, output: 0 },
        metadata: params.metadata || {}
      });


      // Store updated data
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts });

      // Update token metadata summary
      await this.updateTokenMetadata(tabId, params);

      logger.service.info('Structured prompt stored successfully', { tabId });
      return true;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error storing structured prompt', { error });
      return false;
    }
  }

  /**
   * Update token metadata for a specific tab
   * @param {number} tabId - Tab ID
   * @param {Object} params - Token parameters
   * @returns {Promise<boolean>} - Success indicator
   */
  static async updateTokenMetadata(tabId, params = {}) {
    if (!tabId) {
      logger.service.error('StructuredPromptService: Missing tabId for token metadata update');
      return false;
    }

    try {
      logger.service.info('Updating token metadata', { tabId });

      // Get current token metadata
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      const allMetadata = result[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};

      // Create or update tab entry
      if (!allMetadata[tabId]) {
        allMetadata[tabId] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          lastUpdated: Date.now(),
          platformId: params.platformId || 'unknown',
          modelId: params.modelId || 'unknown'
        };
      }

      // Update with new token information
      if (params.tokensUsed) {
        const inputTokens = params.tokensUsed.input || 0;
        const outputTokens = params.tokensUsed.output || 0;

        // Add to running totals
        allMetadata[tabId].totalInputTokens += inputTokens;
        allMetadata[tabId].totalOutputTokens += outputTokens;

        // Calculate cost if pricing info available
        if (params.pricing) {
          const inputCost = (inputTokens / 1000000) * (params.pricing.inputTokenPrice || 0);
          const outputCost = (outputTokens / 1000000) * (params.pricing.outputTokenPrice || 0);
          allMetadata[tabId].totalCost += (inputCost + outputCost);
        }

        // Update metadata
        allMetadata[tabId].lastUpdated = Date.now();
        allMetadata[tabId].platformId = params.platformId || allMetadata[tabId].platformId;
        allMetadata[tabId].modelId = params.modelId || allMetadata[tabId].modelId;
      }

      // Store updated metadata
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata });

      logger.service.info('Token metadata updated successfully', { tabId });
      return true;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error updating token metadata', { error });
      return false;
    }
  }

  /**
   * Get all structured prompts for a specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Array>} - Array of structured prompts with metadata
   */
  static async getStructuredPrompts(tabId) {
    if (!tabId) {
      logger.service.error('StructuredPromptService: Missing tabId for getting prompts');
      return [];
    }

    try {
      logger.service.info('Retrieving structured prompts', { tabId });

      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      return allPrompts[tabId] || [];
    } catch (error) {
      logger.service.error('StructuredPromptService: Error getting structured prompts', { error });
      return [];
    }
  }

  /**
   * Get token metadata for a specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} - Token metadata object
   */
  static async getTokenMetadata(tabId) {
    if (!tabId) {
      logger.service.error('StructuredPromptService: Missing tabId for getting token metadata');
      return null;
    }

    try {
      logger.service.info('Retrieving token metadata', { tabId });

      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);
      const allMetadata = result[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};
      return allMetadata[tabId] || null;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error getting token metadata', { error });
      return null;
    }
  }

  /**
   * Get comprehensive token statistics for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} - Complete token statistics
   */
  static async getTokenStatistics(tabId) {
    if (!tabId) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        isCalculated: false
      };
    }

    try {
      // Get token metadata from storage
      const metadata = await this.getTokenMetadata(tabId);
      
      if (!metadata) {
        return {
          inputTokens: 0,
          outputTokens: 0, 
          totalCost: 0,
          isCalculated: false
        };
      }
      
      return {
        inputTokens: metadata.totalInputTokens || 0,
        outputTokens: metadata.totalOutputTokens || 0,
        totalCost: metadata.totalCost || 0,
        platformId: metadata.platformId,
        modelId: metadata.modelId,
        lastUpdated: metadata.lastUpdated,
        isCalculated: true
      };
    } catch (error) {
      logger.service.error('StructuredPromptService: Error getting token statistics', { error });
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        isCalculated: false
      };
    }
  }
  
  /**
   * Calculate context window status based on token metadata
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
      logger.service.error('StructuredPromptService: Error calculating context status', { error });
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
  }

  /**
   * Add token counts to the metadata
   * @param {number} tabId - Tab ID
   * @param {Object} newTokens - Token counts to add
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Promise<boolean>} - Success indicator
   */
  static async addTokenCounts(tabId, newTokens, modelConfig = null) {
    if (!tabId) {
      logger.service.error('StructuredPromptService: Missing tabId for adding token counts');
      return false;
    }

    try {
      logger.service.info('Adding token counts', { tabId });

      // Prepare pricing info if model config is provided
      let pricing = null;
      if (modelConfig) {
        pricing = {
          inputTokenPrice: modelConfig.inputTokenPrice || 0,
          outputTokenPrice: modelConfig.outputTokenPrice || 0
        };
      }

      // Update token metadata with the new counts
      return await this.updateTokenMetadata(tabId, {
        platformId: newTokens.platformId,
        modelId: newTokens.modelId,
        tokensUsed: {
          input: newTokens.input || 0,
          output: newTokens.output || 0
        },
        pricing
      });
    } catch (error) {
      logger.service.error('StructuredPromptService: Error adding token counts', { error });
      return false;
    }
  }

  /**
   * Update token information for a specific message
   * @param {number} tabId - Tab ID
   * @param {string} messageId - Message ID to update
   * @param {Object} tokenInfo - Token information
   * @returns {Promise<boolean>} - Success indicator
   */
  static async updateMessageTokens(tabId, messageId, tokenInfo) {
    if (!tabId || !messageId || !tokenInfo) {
      logger.service.error('StructuredPromptService: Missing parameters for updateMessageTokens');
      return false;
    }

    try {
      logger.service.info('Updating message tokens', { tabId, messageId });

      // Get current prompts
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const allPrompts = result[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};

      // Find and update the specific message
      if (allPrompts[tabId]) {
        const promptIndex = allPrompts[tabId].findIndex(p => p.messageId === messageId);

        if (promptIndex >= 0) {
          // Update token information
          allPrompts[tabId][promptIndex].tokensUsed = {
            ...allPrompts[tabId][promptIndex].tokensUsed,
            ...tokenInfo
          };

          // Store updated data
          await chrome.storage.local.set({ [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts });

          // Also update token metadata
          await this.updateTokenMetadata(tabId, {
            tokensUsed: tokenInfo,
            platformId: allPrompts[tabId][promptIndex].platformId,
            modelId: allPrompts[tabId][promptIndex].modelId
          });

          logger.service.info('Message tokens updated successfully', { tabId, messageId });
          return true;
        }
      }

      logger.service.warn('Message not found for token update', { tabId, messageId });
      return false;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error updating message tokens', { error });
      return false;
    }
  }

  /**
   * Clear all token data for a specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success indicator
   */
  static async clearTabData(tabId) {
    if (!tabId) {
      logger.service.error('StructuredPromptService: Missing tabId for clearing data');
      return false;
    }

    try {
      logger.service.info('Clearing tab data', { tabId });

      // Get current data
      const promptsResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]);
      const metadataResult = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_METADATA]);

      const allPrompts = promptsResult[STORAGE_KEYS.TAB_STRUCTURED_PROMPTS] || {};
      const allMetadata = metadataResult[STORAGE_KEYS.TAB_TOKEN_METADATA] || {};

      // Remove data for this tab
      delete allPrompts[tabId];
      delete allMetadata[tabId];

      // Store updated data
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_STRUCTURED_PROMPTS]: allPrompts,
        [STORAGE_KEYS.TAB_TOKEN_METADATA]: allMetadata
      });

      logger.service.info('Tab data cleared successfully', { tabId });
      return true;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error clearing tab data', { error });
      return false;
    }
  }

  /**
   * Clean up data for closed tabs
   * @param {Array<number>} activeTabIds - Array of active tab IDs
   * @returns {Promise<boolean>} - Success indicator
   */
  static async cleanupClosedTabs(activeTabIds) {
    if (!activeTabIds || !Array.isArray(activeTabIds)) {
      logger.service.error('StructuredPromptService: Invalid activeTabIds for cleanup');
      return false;
    }

    try {
      logger.service.info('Cleaning up data for closed tabs');

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

        logger.service.info('Cleaned up data for closed tabs');
      }

      return true;
    } catch (error) {
      logger.service.error('StructuredPromptService: Error cleaning up closed tabs', { error });
      return false;
    }
  }
}

module.exports = StructuredPromptService;