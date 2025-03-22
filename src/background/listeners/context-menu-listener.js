// src/background/listeners/context-menu-listener.js - Context menu handling

import { processContent } from '../services/content-processing.js';
import logger from '../../utils/logger.js';

/**
 * Set up context menu listener
 */
export function setupContextMenuListener() {
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
  logger.background.info('Context menu listener initialized');
}

/**
 * Create extension context menus
 * @returns {Promise<void>}
 */
export async function createContextMenus() {
  // Clear existing context menus first to avoid duplicates
  await chrome.contextMenus.removeAll();
  
  // Create context menus
  chrome.contextMenus.create({
    id: 'processContent',
    title: 'process with AI',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'processSelection',
    title: 'process Selection with AI',
    contexts: ['selection']
  });
  
  logger.background.info('Context menus created');
}

/**
 * Handle context menu click
 * @param {Object} info - Click information
 * @param {Object} tab - Tab information
 */
async function handleContextMenuClick(info, tab) {
  logger.background.info('Context menu clicked', { info, tabId: tab.id });

  // Determine if there's a text selection
  const hasSelection = info.menuItemId === 'processSelection' || !!info.selectionText;
  
  logger.background.info(`process content request from menu context`);

  // Use centralized content processing
  const result = await processContent({
    tabId: tab.id,
    url: tab.url,
    hasSelection
    // No promptId/platformId to use user's preferred defaults
  });
  
  // Handle any errors that need UI feedback
  if (!result.success) {
    logger.background.error('Context menu action failed:', result);
  }
}