import { logger } from '../../shared/logger.js';
import { processWithSpecificPromptWebUI } from '../services/content-processing.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import {
  determineContentType,
  isSidePanelAllowedPage,
} from '../../shared/utils/content-utils.js';
import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
import { debounce } from '../../shared/utils/debounce-utils.js';

/**
 * Handles clicks on the context menu item.
 */
// In-memory store for dynamically created context menu item IDs
let createdMenuIDs = [];

/**
 * Updates the context menu with relevant prompts for the given tab.
 * @param {chrome.tabs.Tab} tab - The tab object to create the context menu for.
 */
async function updateContextMenuForTab(tab) {
  // Clear previous dynamic items to prevent duplicates
  for (const id of createdMenuIDs) {
    try {
      // Use a simple try-catch as remove can fail if the item was already removed
      await chrome.contextMenus.remove(id);
    } catch (e) {
      // It's safe to ignore "No such context menu item" errors here.
    }
  }
  createdMenuIDs = []; // Reset the list of created IDs

  // Do not show the menu on pages where the side panel is not allowed (e.g., chrome://)
  if (!tab || !tab.id || !isSidePanelAllowedPage(tab.url)) {
    await chrome.contextMenus.update('parent-menu', { visible: false });
    return;
  }
  // Ensure the parent menu is visible for allowed pages
  await chrome.contextMenus.update('parent-menu', { visible: true });

  const selectionResult = await chrome.storage.local.get(
    STORAGE_KEYS.TAB_SELECTION_STATES
  );
  const hasSelection = !!(
    selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES] || {}
  )[tab.id];
  const contentType = determineContentType(tab.url, hasSelection);
  const prompts = await loadRelevantPrompts(contentType);

  if (prompts.length > 0) {
    for (const prompt of prompts) {
      const menuId = `prompt-item-${prompt.id}`;
      createdMenuIDs.push(menuId);
      await chrome.contextMenus.create({
        id: menuId,
        title: prompt.name,
        parentId: 'parent-menu',
        contexts: ['page', 'selection'],
      });
    }
  } else {
    // Add a disabled item to inform the user if no prompts are available
    const menuId = 'no-prompts-item';
    createdMenuIDs.push(menuId);
    await chrome.contextMenus.create({
      id: menuId,
      title: 'No prompts for this content type',
      enabled: false,
      parentId: 'parent-menu',
      contexts: ['page', 'selection'],
    });
  }
}

// Create a debounced version of the context menu update function to prevent race conditions
export const debouncedUpdateContextMenuForTab = debounce(async (tab) => {
  // Use a try-catch block as this is an async operation that can fail
  try {
    if (tab) { // Add a guard to ensure tab object is valid
      await updateContextMenuForTab(tab);
    }
  } catch (error) {
    logger.background.error('Error in debounced context menu update:', error);
  }
}, 150); // 150ms delay is a good balance
async function handleContextMenuClick(info, tab) {
  // Handle clicks on dynamically created prompt items
  if (info.menuItemId.startsWith('prompt-item-')) {
    const promptId = info.menuItemId.replace('prompt-item-', '');
    logger.background.info(`Context menu prompt [${promptId}] clicked:`, {
      tabId: tab?.id,
      url: tab?.url,
    });

    if (!tab || !tab.id || !tab.url) {
      logger.background.error('Context menu click missing tab information.');
      return;
    }

    try {
      await processWithSpecificPromptWebUI(tab, promptId);
    } catch (error) {
      logger.background.error(
        `Error handling context menu action for prompt ${promptId}:`,
        error
      );
    }
  }
}

/**
 * Sets up the listener for context menu item clicks.
 */
export function setupContextMenuListener() {
  // Ensure the contextMenus API is available before adding listener
  if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    // Use the handleContextMenuClick function defined in this file
    chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
    logger.background.info('Context menu click listener registered.');
  } else {
    logger.background.error(
      'Context Menus API not available, cannot register click listener.'
    );
  }
}
