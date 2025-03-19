// src/content/sidebar-injector.js

// State management
let sidebarContainer = null;
let sidebarFrame = null;
let sidebarVisible = false;
let sidebarInitialized = false;
let sidebarWidth = 350; // Default width in pixels

// Create and inject the sidebar container
function createSidebar() {
  if (sidebarContainer) return;
  
  // Create container
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'ai-extension-sidebar-container';
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: ${sidebarWidth}px;
    z-index: 2147483647;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  `;
  
  // Create iframe to host sidebar
  sidebarFrame = document.createElement('iframe');
  sidebarFrame.id = 'ai-extension-sidebar-frame';
  sidebarFrame.style.cssText = `
    border: none;
    width: 100%;
    height: 100%;
    background-color: white;
  `;
  
  // Add resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'ai-extension-sidebar-resize';
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 2147483647;
    background-color: transparent;
  `;
  
  // Add components to DOM
  sidebarContainer.appendChild(sidebarFrame);
  sidebarContainer.appendChild(resizeHandle);
  document.body.appendChild(sidebarContainer);
  
  // Set up resize functionality
  setupResizeHandle(resizeHandle);
  
  console.log('AI Extension sidebar container created');
}

// Initialize sidebar content with Preact app
async function initializeSidebar(conversationData = null) {
  if (!sidebarContainer || !sidebarFrame || sidebarInitialized) return;
  
  try {
    // Create URL for sidebar HTML
    const sidebarUrl = chrome.runtime.getURL('sidebar.html');
    
    // Set iframe src
    sidebarFrame.src = sidebarUrl;
    
    // Wait for iframe to load
    await new Promise(resolve => {
      sidebarFrame.onload = resolve;
    });
    
    // Initialize Preact app in iframe
    const frameWindow = sidebarFrame.contentWindow;
    if (frameWindow && frameWindow.sidebarApp) {
      const rootElement = frameWindow.document.getElementById('sidebar-root');
      if (rootElement) {
        frameWindow.sidebarApp.initialize(rootElement, {
          conversation: conversationData || [],
          platformInfo: await getPlatformInfo()
        });
        sidebarInitialized = true;
        console.log('AI Extension sidebar initialized');
      } else {
        console.error('Sidebar root element not found in iframe');
      }
    } else {
      console.error('sidebarApp not found in iframe window');
    }
  } catch (error) {
    console.error('Error initializing sidebar:', error);
  }
}

// Set up sidebar resize handle functionality
function setupResizeHandle(resizeHandle) {
  let startX = 0;
  let startWidth = 0;
  let dragging = false;
  
  const onMouseDown = (e) => {
    dragging = true;
    startX = e.clientX;
    startWidth = sidebarWidth;
    document.documentElement.style.cursor = 'col-resize';
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
    e.stopPropagation();
  };
  
  const onMouseMove = (e) => {
    if (!dragging) return;
    
    // Calculate new width (resizing from right edge)
    const newWidth = startWidth - (e.clientX - startX);
    
    // Enforce min/max width
    if (newWidth >= 250 && newWidth <= 800) {
      sidebarWidth = newWidth;
      sidebarContainer.style.width = `${newWidth}px`;
    }
    
    e.preventDefault();
  };
  
  const onMouseUp = () => {
    if (dragging) {
      dragging = false;
      document.documentElement.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save the width preference
      try {
        chrome.storage.sync.set({ 'sidebar_width': sidebarWidth });
      } catch (error) {
        console.warn('Failed to save sidebar width preference:', error);
      }
    }
  };
  
  // Add event listeners
  resizeHandle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  // Clean up for future improvements
  return () => {
    resizeHandle.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

// Show the sidebar
function showSidebar() {
  if (!sidebarContainer) return;
  
  sidebarContainer.style.transform = 'translateX(0)';
  sidebarVisible = true;
  
  // Notify background script that sidebar is visible
  chrome.runtime.sendMessage({ 
    action: 'sidebarStateChanged', 
    visible: true 
  });
}

// Hide the sidebar
function hideSidebar() {
  if (!sidebarContainer) return;
  
  sidebarContainer.style.transform = 'translateX(100%)';
  sidebarVisible = false;
  
  // Notify background script that sidebar is hidden
  chrome.runtime.sendMessage({ 
    action: 'sidebarStateChanged', 
    visible: false 
  });
}

// Toggle sidebar visibility
function toggleSidebar() {
  if (sidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

// Clean up sidebar resources
function cleanupSidebar() {
  if (sidebarFrame && sidebarFrame.contentWindow && sidebarFrame.contentWindow.sidebarApp) {
    sidebarFrame.contentWindow.sidebarApp.cleanup(
      sidebarFrame.contentWindow.document.getElementById('sidebar-root')
    );
  }
  
  if (sidebarContainer && sidebarContainer.parentNode) {
    sidebarContainer.parentNode.removeChild(sidebarContainer);
    sidebarContainer = null;
    sidebarFrame = null;
  }
  
  sidebarInitialized = false;
  console.log('AI Extension sidebar cleaned up');
}

// Get stored width preference
async function loadWidthPreference() {
  try {
    const result = await chrome.storage.sync.get('sidebar_width');
    if (result.sidebar_width) {
      sidebarWidth = result.sidebar_width;
    }
  } catch (error) {
    console.warn('Failed to load sidebar width preference:', error);
  }
}

// Get platform and model information
async function getPlatformInfo() {
  try {
    const result = await chrome.storage.local.get([
      'apiSummarizationPlatform',
      'selectedApiModel'
    ]);
    
    const platformId = result.apiSummarizationPlatform || 'unknown';
    const modelId = result.selectedApiModel || 'unknown';
    
    // Get platform name from platform ID
    let platformName = platformId.charAt(0).toUpperCase() + platformId.slice(1);
    
    return {
      platformId,
      platformName,
      modelId
    };
  } catch (error) {
    console.error('Error getting platform info:', error);
    return {
      platformId: 'unknown',
      platformName: 'AI Platform',
      modelId: 'unknown'
    };
  }
}

// Set up message listener
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showSidebar') {
      createSidebar();
      initializeSidebar(message.conversationData);
      showSidebar();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.action === 'hideSidebar') {
      hideSidebar();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.action === 'toggleSidebar') {
      toggleSidebar();
      sendResponse({ success: true, visible: sidebarVisible });
      return true;
    }
    
    if (message.action === 'updateConversation' && 
        sidebarFrame && 
        sidebarFrame.contentWindow) {
      
      // Forward to sidebar app
      sidebarFrame.contentWindow.dispatchEvent(
        new CustomEvent('sidebar:updateConversation', { 
          detail: message.conversation 
        })
      );
      
      sendResponse({ success: true });
      return true;
    }
    
    return false;
  });
}

// Initialize the sidebar injector
async function initialize() {
  await loadWidthPreference();
  setupMessageListener();
  console.log('AI Extension sidebar injector initialized');
}

// Initialize on load
initialize();

// Export API for debugging
window.aiExtensionSidebar = {
  create: createSidebar,
  initialize: initializeSidebar,
  show: showSidebar,
  hide: hideSidebar,
  toggle: toggleSidebar,
  cleanup: cleanupSidebar,
  isVisible: () => sidebarVisible
};