import { logger } from '../../shared/logger.js';
import { processWithSpecificPromptWebUI } from '../services/content-processing.js';
import { STORAGE_KEYS, CONTENT_TYPE_LABELS } from '../../shared/constants.js';
import {
  determineContentType,
  isSidePanelAllowedPage,
} from '../../shared/utils/content-utils.js';
import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
import { debounce } from '../../shared/utils/debounce-utils.js';

const PARENT_CONTEXT_MENU_ID = 'parent-menu';

/**
 * Updates the context menu with relevant prompts for the given tab ID.
 * This function uses an atomic remove-and-recreate strategy and fetches fresh tab data
 * to ensure resilience against stale state from an idle service worker.
 * @param {number} tabId - The ID of the tab to create the context menu for.
 */
export async function updateContextMenuForTab(tabId) {
  logger.background.info(
    `[ContextMenu] Starting update for tabId: ${tabId}`
  );
  // Atomically remove the parent menu and all its children.
  // Use a try-catch to handle the first run where the menu doesn't exist.
  try {
    await chrome.contextMenus.remove(PARENT_CONTEXT_MENU_ID);
    logger.background.info('[ContextMenu] Successfully removed old parent menu.');
  } catch (e) {
    // It's safe to ignore "No such context menu item" errors here.
    logger.background.info(
      '[ContextMenu] Old parent menu did not exist, proceeding to create.'
    );
  }

  // Fetch the latest tab data to ensure the URL is current.
  const tab = await chrome.tabs.get(tabId);
  logger.background.info(`[ContextMenu] Fetched tab data. URL: ${tab.url}`);

  // Do not show the menu on pages where the side panel is not allowed (e.g., chrome://)
  if (!tab || !tab.id || !isSidePanelAllowedPage(tab.url)) {
    logger.background.info(
      `[ContextMenu] Skipping menu creation for restricted URL: ${tab.url}`
    );
    // By not recreating the menu, it remains hidden.
    return;
  }

  const selectionResult = await chrome.storage.local.get(
    STORAGE_KEYS.TAB_SELECTION_STATES
  );
  const hasSelection = !!(selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES] ||
    {})[tab.id];
  logger.background.info(`[ContextMenu] Text selection state: ${hasSelection}`);

  const contentType = determineContentType(tab.url, hasSelection);
  logger.background.info(`[ContextMenu] Determined content type: ${contentType}`);

  // Generate a dynamic title based on the content type
  const label = CONTENT_TYPE_LABELS[contentType] || 'Content';
  const dynamicTitle = `Process ${label} (Web UI)`;
  logger.background.info(`[ContextMenu] Generated dynamic title: "${dynamicTitle}"`);

  // Recreate the parent menu item with the dynamic title.
  await chrome.contextMenus.create({
    id: PARENT_CONTEXT_MENU_ID,
    title: dynamicTitle,
    contexts: ['page', 'selection'],
  });
  logger.background.info('[ContextMenu] Parent menu item created successfully.');

  const prompts = await loadRelevantPrompts(contentType);
  logger.background.info(
    `[ContextMenu] Found ${prompts.length} relevant prompts for type: ${contentType}.`
  );

  if (prompts.length > 0) {
    for (const prompt of prompts) {
      // Create children under the newly created parent menu.
      await chrome.contextMenus.create({
        id: `prompt-item-${prompt.id}`,
        title: prompt.name,
        parentId: PARENT_CONTEXT_MENU_ID,
        contexts: ['page', 'selection'],
      });
    }
  } else {
    // Add a disabled item to inform the user if no prompts are available.
    await chrome.contextMenus.create({
      id: 'no-prompts-item',
      title: 'No prompts for this content type',
      enabled: false,
      parentId: PARENT_CONTEXT_MENU_ID,
      contexts: ['page', 'selection'],
    });
  }
  logger.background.info(
    `[ContextMenu] Finished updating menu for tabId: ${tabId}`
  );
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
