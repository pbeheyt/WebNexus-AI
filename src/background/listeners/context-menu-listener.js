// src/background/listeners/context-menu-listener.js - Context menu handling

import { summarizeContent } from '../services/summarization.js';
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
    id: 'summarizeContent',
    title: 'Summarize with AI',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: 'Summarize Selection with AI',
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
  const hasSelection = info.menuItemId === 'summarizeSelection' || !!info.selectionText;
  
  logger.background.info(`Summarize content request from menu context`);

  // Use centralized summarization process
  const result = await summarizeContent({
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