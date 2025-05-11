// sidepanel_loader.js
(async function() {
  console.log('[Sidepanel Loader] Script started.');

  // Attempt to apply dark mode based on system preference immediately
  // This also handles the case where documentElement might not be fully ready for classList
  try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
      }
  } catch (e) {
      console.warn('[Sidepanel Loader] Could not apply initial dark mode via matchMedia:', e);
  }


  // Function to get tabId and current URL for the main page this panel is attached to.
  async function getLoaderContext() {
    return new Promise((resolve, reject) => {
      // A script in a side panel can message the background to get its tab context.
      // However, chrome.tabs.getCurrent() is not available in side panels.
      // The most reliable way is for the background to tell it, or for the
      // side panel to be opened with its tabId in the URL.
      // Since the global command just calls open({tabId}), the loader's URL
      // won't have query params from that initial open.
      // We rely on the background to know which tab the global command was for.
      // The background command handler should have passed tabId and currentUrl when opening this loader.
      // Let's try to get it from URL params first, assuming background set it.
      // If not, we have a problem as the loader won't know its context.
      // For this plan, we assume the background's handleGlobalOpenOrToggleCommand
      // will open sidepanel_loader.html?tabId=X&currentUrl=Y

      const urlParams = new URLSearchParams(window.location.search);
      const tabIdStr = urlParams.get('tabId');
      const currentUrl = urlParams.get('currentUrl'); // URL of the main page

      if (tabIdStr && currentUrl) {
        const tabId = parseInt(tabIdStr, 10);
        if (!isNaN(tabId)) {
          console.log(`[Sidepanel Loader] Context from URL params: tabId=${tabId}, currentUrl=${currentUrl}`);
          resolve({ tabId, currentUrl });
          return;
        }
      }

      // Fallback: if not in URL, ask background. This is less ideal as it's another async step.
      // This part is tricky because the loader needs to identify itself.
      // For now, we will strongly rely on the background command handler to open the loader with context in URL.
      // If it's not there, it's an issue with the calling logic.
      console.error('[Sidepanel Loader] CRITICAL: tabId or currentUrl not found in loader URL query parameters.');
      reject(new Error('Loader context (tabId, currentUrl) not found in URL.'));
    });
  }

  try {
    const { tabId, currentUrl } = await getLoaderContext();

    if (!tabId || isNaN(tabId) || !currentUrl) {
      console.error('[Sidepanel Loader] Failed to get valid context (tabId, currentUrl).');
      document.body.textContent = 'Error: Could not initialize sidebar context.';
      return;
    }

    console.log(`[Sidepanel Loader] Context: tabId=${tabId}, currentUrl=${currentUrl}. Requesting final state.`);

    chrome.runtime.sendMessage(
      {
        action: 'resolveSidePanelStateAndFinalize',
        tabId: tabId,
        currentUrl: currentUrl
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Sidepanel Loader] Error sending/receiving resolveSidePanelStateAndFinalize:', chrome.runtime.lastError.message);
          document.body.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        if (response && response.error) {
          console.error('[Sidepanel Loader] Error from background:', response.error);
          document.body.textContent = 'Error: ' + response.error;
        } else if (response && response.status) {
          console.log('[Sidepanel Loader] Background status:', response.status);
          // If the panel was closed by the background, this loader instance will become defunct.
          // If navigated, this loader page will be replaced.
          if (response.status === 'closed_not_allowed' || response.status === 'closed_on_toggle') {
            // Optional: change text or do nothing as panel will be closed by background.
            document.body.textContent = 'Sidebar closed.';
          }
        } else {
            console.warn('[Sidepanel Loader] Unexpected response from background:', response);
        }
      }
    );
  } catch (e) {
    console.error('[Sidepanel Loader] Initialization error:', e);
    document.body.textContent = 'Error: Sidebar failed to load. ' + e.message;
  }
})();
