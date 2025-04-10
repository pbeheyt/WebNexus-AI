import React from 'react';
import { createRoot } from 'react-dom/client';
import FloatingActionButton from './components/FloatingActionButton';
import { MESSAGE_ACTIONS } from '../shared/constants';
import logger from '../shared/logger.js';

// Global FAB state
let fabRoot = null;
let fabContainer = null;
let currentVisibleState = false;
let currentTabId = null;
let isInitializing = false;

/**
 * Ensure FAB container exists and is ready for rendering
 * @returns {ReactRoot|null} The React root instance or null if failed
 */
function ensureFabContainer() {
    if (fabContainer) return fabRoot;

    fabContainer = document.getElementById('nexus-ai-fab-root');
    if (!fabContainer) {
        logger.content.info('Creating FAB container...');
        fabContainer = document.createElement('div');
        fabContainer.id = 'nexus-ai-fab-root';
        fabContainer.style.position = 'fixed';
        fabContainer.style.bottom = '0';
        fabContainer.style.right = '0';
        fabContainer.style.width = '0';
        fabContainer.style.height = '0';
        fabContainer.style.zIndex = '2147483646';
        fabContainer.style.pointerEvents = 'none';
        fabContainer.style.display = 'none';
        document.body.appendChild(fabContainer);
        try {
            fabRoot = createRoot(fabContainer);
            logger.content.info('FAB container created and root initialized.');
        } catch (error) {
            logger.content.error('Error creating React root:', error);
            fabRoot = null;
        }
    } else if (!fabRoot) {
        try {
            fabRoot = createRoot(fabContainer);
            logger.content.info('FAB root re-initialized on existing container.');
        } catch (error) {
            logger.content.error('Error re-initializing React root:', error);
            fabRoot = null;
        }
    }
    return fabRoot;
}

/**
 * Render or update the FAB component
 */
function renderFab() {
    if (!fabRoot) {
        logger.content.error("Attempted to render FAB before root was created");
        return;
    }
    if (fabContainer) {
        fabContainer.style.display = currentVisibleState ? 'block' : 'none';
        fabContainer.style.pointerEvents = currentVisibleState ? 'auto' : 'none';
        if (currentVisibleState) {
            fabContainer.style.width = 'auto';
            fabContainer.style.height = 'auto';
        } else {
            fabContainer.style.width = '0';
            fabContainer.style.height = '0';
        }
    }

    try {
        fabRoot.render(
            <React.StrictMode>
                <FloatingActionButton onClick={handleFabClick} isVisible={currentVisibleState} />
            </React.StrictMode>
        );
        logger.content.info(`Rendered FAB with isVisible: ${currentVisibleState}`);
    } catch (error) {
        logger.content.error("Error rendering FAB component:", error);
        if(fabContainer) fabContainer.style.display = 'none';
        currentVisibleState = false;
    }
}

/**
 * Handle FAB click to toggle sidebar
 */
const handleFabClick = async () => {
    logger.content.info('FAB clicked.');
    if (!currentTabId) {
        logger.content.warn('currentTabId not set, attempting to fetch...');
        try {
            const response = await chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.GET_CURRENT_TAB_ID });
            if (response && response.tabId) {
                currentTabId = response.tabId;
                logger.content.info('Fetched tabId on demand:', currentTabId);
            } else {
                logger.content.error('Failed to fetch tabId on demand.');
                return;
            }
        } catch(error) {
            logger.content.error('Error fetching tabId on demand:', error);
            return;
        }
    }

    logger.content.info(`Using tabId ${currentTabId}, sending toggle request...`);
    chrome.runtime.sendMessage({ 
        action: MESSAGE_ACTIONS.TOGGLE_SIDEBAR_FROM_FAB, 
        tabId: currentTabId 
    }).then(toggleResponse => {
        if (!toggleResponse || !toggleResponse.success) {
            logger.content.error('Error toggling sidebar:', toggleResponse?.error);
        } else {
            logger.content.info('Sidebar toggle request sent successfully.');
        }
    }).catch(err => {
        logger.content.error('Error sending toggle message:', err);
    });
};

// Message handler for FAB visibility
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === MESSAGE_ACTIONS.SHOW_FAB) {
        logger.content.info('Received showFab message.');
        ensureFabContainer();
        currentVisibleState = true;
        renderFab();
        sendResponse({ success: true });
        return true;
    } else if (message.action === MESSAGE_ACTIONS.HIDE_FAB) {
        logger.content.info('Received hideFab message.');
        ensureFabContainer();
        currentVisibleState = false;
        renderFab();
        sendResponse({ success: true });
        return true;
    }
    return false;
});

/**
 * Initialize content script and FAB
 */
async function initializeContentScript() {
    if (isInitializing || window.nexusAIContentScriptInitialized) return;
    isInitializing = true;
    window.nexusAIContentScriptInitialized = true;
    logger.content.info('Initializing content script...');

    // Get current tab ID
    try {
        const response = await chrome.runtime.sendMessage({ action: MESSAGE_ACTIONS.GET_CURRENT_TAB_ID });
        if (response && response.tabId) {
            currentTabId = response.tabId;
            logger.content.info('Initial tabId set:', currentTabId);
        } else {
            logger.content.error('Failed to get initial tabId from background.', response?.error);
        }
    } catch (error) {
        if (!error.message.includes('Receiving end does not exist')) {
            logger.content.error('Error requesting initial tabId:', error);
        } else {
            logger.content.info('Could not connect to background for initial tabId (likely page unloading).');
        }
    }

    // Initialize FAB container (starts hidden)
    ensureFabContainer();
    logger.content.info('Content script initialization complete.');
    isInitializing = false;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    if (!window.nexusAIContentScriptInitialized) {
        initializeContentScript();
    }
}
