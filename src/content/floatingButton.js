// src/content/floatingButton.js
import { STORAGE_KEYS } from '../shared/constants';
import { logger } from '../shared/logger';
import { robustSendMessage } from '../shared/utils/message-utils';

(function () {
  // Prevent multiple injections
  if (window.hasRunFloatingButtonScript) {
    return;
  }
  window.hasRunFloatingButtonScript = true;

  logger.content.info('Floating button script injected.');

  const HOST_ELEMENT_ID = 'webnexus-fab-host';
  let fabHost = null;
  let fab = null;

  // CSS for the button and its host
  // Styles are injected into the Shadow DOM for encapsulation
  const styles = `
    :host {
      all: initial; /* Reset all inherited styles for the host */
      position: fixed;
      bottom: 25px;
      right: 25px;
      z-index: 2147483647; /* Max z-index */
      display: none; /* Initially hidden */
    }
    button {
      all: unset; /* Reset all button styles */
      background-color: #FF7B00; /* Extension primary color */
      color: white;
      border-radius: 50%;
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease-out, background-color 0.2s;
      border: none; /* Ensure no default border */
      padding: 0; /* Ensure no default padding */
      box-sizing: border-box; /* Consistent box model */
    }
    button:hover {
      background-color: #E06E00; /* Darker shade for hover */
      transform: scale(1.05);
    }
    button:active {
      transform: scale(0.95);
    }
    svg {
      width: 28px;
      height: 28px;
      pointer-events: none; /* Make SVG non-interactive */
    }
  `;

  // SVG icon for the button (Side Panel Icon)
  const buttonIconSvg = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
      <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/>
    </svg>
  `;

  function createFloatingButton() {
    // Create host element for Shadow DOM
    fabHost = document.createElement('div');
    fabHost.id = HOST_ELEMENT_ID;
    document.body.appendChild(fabHost);

    const shadowRoot = fabHost.attachShadow({ mode: 'open' });

    // Create style element
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadowRoot.appendChild(styleEl);

    // Create button element
    fab = document.createElement('button');
    fab.innerHTML = buttonIconSvg;
    fab.setAttribute('title', 'Toggle WebNexus AI Side Panel');
    fab.setAttribute('aria-label', 'Toggle WebNexus AI Side Panel');

    fab.addEventListener('click', async () => {
      logger.content.info('Floating action button clicked.');
      try {
        const response = await robustSendMessage({
          action: 'toggleNativeSidePanelAction',
        });
        logger.content.info('Toggle side panel message sent, response:', response);
        // The side panel itself might close the popup, or the background script handles visibility.
        // No need to explicitly open/close the panel from here, just toggle its state.
      } catch (error) {
        logger.content.error('Error sending toggle side panel message:', error);
      }
    });

    shadowRoot.appendChild(fab);
    return fabHost; // Return the host element
  }

  function updateButtonVisibility(visible) {
    if (fabHost) {
      fabHost.style.display = visible ? 'block' : 'none'; // Use block as host is a div
      logger.content.info(`Floating button visibility set to: ${visible}`);
    }
  }

  // Initialize the button
  if (!document.getElementById(HOST_ELEMENT_ID)) {
    fabHost = createFloatingButton();
  } else {
    fabHost = document.getElementById(HOST_ELEMENT_ID);
    // fab = fabHost.shadowRoot.querySelector('button'); // Not strictly needed here if fabHost is used for visibility
  }

  // Load initial preference and set visibility
  chrome.storage.sync.get(STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON, (result) => {
    const shouldShow = result[STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON] === true;
    updateButtonVisibility(shouldShow);
  });

  // Listen for preference changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON]) {
      const newVisibility = changes[STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON].newValue === true;
      updateButtonVisibility(newVisibility);
    }
  });
})();
