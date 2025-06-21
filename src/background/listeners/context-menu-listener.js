import { logger } from '../../shared/logger.js';
import { processWithSpecificPromptWebUI } from '../services/content-processing.js';
import { STORAGE_KEYS, CONTENT_TYPE_LABELS } from '../../shared/constants.js';
import {
  determineContentType,
  isSidePanelAllowedPage,
} from '../../shared/utils/content-utils.js';
import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
import { debounce } from '../../shared/utils/debounce-utils.js';

/**
 * Updates the context menu with relevant prompts for the given tab ID.
 * This function uses an atomic remove-and-recreate strategy and fetches fresh tab data
 * to ensure resilience against stale state from an idle service worker.
 * @param {number} tabId - The ID of the tab to create the context menu for.
 */
async function updateContextMenuForTab(tabId) {
  // Atomically remove the parent menu and all its children.
  // Use a try-catch to handle the first run where the menu doesn't exist.
  try {
    await chrome.contextMenus.remove('parent-menu');
  } catch (e) {
    // It's safe to ignore "No such context menu item" errors here.
  }

  // Fetch the latest tab data to ensure the URL is current.
  const tab = await chrome.tabs.get(tabId);

  // Do not show the menu on pages where the side panel is not allowed (e.g., chrome://)
  if (!tab || !tab.id || !isSidePanelAllowedPage(tab.url)) {
    // By not recreating the menu, it remains hidden.
    return;
  }

  const selectionResult = await chrome.storage.local.get(
    STORAGE_KEYS.TAB_SELECTION_STATES
  );
  const hasSelection = !!(selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES] ||
    {})[tab.id];
  const contentType = determineContentType(tab.url, hasSelection);

  // Generate a dynamic title based on the content type
  const label = CONTENT_TYPE_LABELS[contentType] || 'Content';
  const dynamicTitle = `Process ${label} (Web UI)`;

  // Recreate the parent menu item with the dynamic title.
  await chrome.contextMenus.create({
    id: 'parent-menu',
    title: dynamicTitle,
    contexts: ['page', 'selection'],
  });

  const prompts = await loadRelevantPrompts(contentType);

  if (prompts.length > 0) {
    for (const prompt of prompts) {
      // Create children under the newly created parent menu.
      await chrome.contextMenus.create({
        id: `prompt-item-${prompt.id}`,
        title: prompt.name,
        parentId: 'parent-menu',
        contexts: ['page', 'selection'],
      });
    }
  } else {
    // Add a disabled item to inform the user if no prompts are available.
    await chrome.contextMenus.create({
      id: 'no-prompts-item',
      title: 'No prompts for this content type',
      enabled: false,
      parentId: 'parent-menu',
      contexts: ['page', 'selection'],
    });
  }
}

/**
 * Debounced function to update the context menu for a specific tab ID.
 * This function will wait for 150ms after the last call before executing the update.
 * It helps to avoid multiple rapid updates that could lead to performance issues.
 */
export const debouncedUpdateContextMenuForTab = debounce(async (tabId) => {
  // Use a try-catch block as this is an async operation that can fail
  try {
    if (typeof tabId === 'number') {
      // Guard to ensure tabId is a valid number
      await updateContextMenuForTab(tabId);
    }
  } catch (error) {
    // Ignore "No tab with id" errors, which can happen if the tab closes
    // before the debounced function runs.
    if (error.message && !error.message.includes('No tab with id')) {
      logger.background.error(
        'Error in debounced context menu update:',
        error
      );
    }
  }
}, 150); // 150ms delay

/**
 * Handles context menu item clicks.
 * This function is called when a user clicks on a context menu item.
 * It processes clicks on dynamically created prompt items.
 * @param {chrome.contextMenus.OnClickData} info - The context menu click data.
 */
async function handleContextMenuClick(info) {
  // Handle clicks on dynamically created prompt items
  if (info.menuItemId.startsWith('prompt-item-')) {
    // 1. Reliably get the active tab, ignoring the potentially incorrect `tab` argument from the event.
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id || !tab.url) {
      logger.background.error(
        'Context menu click could not determine active tab.'
      );
      return;
    }

    const promptId = info.menuItemId.replace('prompt-item-', '');
    logger.background.info(`Context menu prompt [${promptId}] clicked:`, {
      tabId: tab.id,
      url: tab.url,
    });

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
