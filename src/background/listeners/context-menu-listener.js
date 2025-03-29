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
    contexts: ['page', 'selection'] // Allow on page and selection
  });
  
  logger.background.info('Context menu created');
}

/**
 * Handle context menu click
 * @param {Object} info - Click information
 * @param {Object} tab - Tab information
 */
async function handleContextMenuClick(info, tab) {
  logger.background.info('Context menu clicked', { info, tabId: tab.id });

  // Always process the full page, regardless of selection context
  logger.background.info(`Processing full page content request from context menu`);

  // Use centralized content processing for the full page
  const result = await processContent({
    tabId: tab.id,
    url: tab.url
    // No promptId/platformId to use user's preferred defaults
  });
  
  // Handle any errors that need UI feedback
  if (!result.success) {
    logger.background.error('Context menu action failed:', result);
  }
}
