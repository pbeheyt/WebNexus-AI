// src/sidebar/index.js
import { h, render } from 'preact';
import Sidebar from './components/Sidebar';
import './styles/sidebar.css';

// Initialize communication with background script
const port = chrome.runtime.connect({ name: 'sidebar' });

// Store message listener references for cleanup
let messageListeners = [];

// Initialize the sidebar application
function initializeSidebar(container, initialState = {}) {
  // Render Preact app to container
  render(
    <Sidebar 
      initialConversation={initialState.conversation || []} 
      platformInfo={initialState.platformInfo || {}}
      port={port}
    />, 
    container
  );

  // Set up message listeners
  setupMessageListeners();
}

// Setup communication with background script
function setupMessageListeners() {
  // Handler for new messages
  const handleNewMessage = (message) => {
    if (message.action === 'updateConversation') {
      window.dispatchEvent(new CustomEvent('sidebar:updateConversation', { 
        detail: message.conversation 
      }));
    } else if (message.action === 'appendMessage') {
      window.dispatchEvent(new CustomEvent('sidebar:appendMessage', { 
        detail: message.message 
      }));
    } else if (message.action === 'updateStatus') {
      window.dispatchEvent(new CustomEvent('sidebar:updateStatus', { 
        detail: message.status 
      }));
    }
  };

  // Add listener to port
  port.onMessage.addListener(handleNewMessage);
  messageListeners.push({ port, listener: handleNewMessage });
  
  // Add listener for runtime messages
  const runtimeHandler = (message, sender, sendResponse) => {
    if (message.target === 'sidebar') {
      handleNewMessage(message);
      sendResponse({ received: true });
    }
  };
  
  chrome.runtime.onMessage.addListener(runtimeHandler);
  messageListeners.push({ type: 'runtime', listener: runtimeHandler });
}

// Clean up resources when sidebar is destroyed
function cleanupSidebar(container) {
  // Remove Preact app
  render(null, container);
  
  // Remove message listeners
  messageListeners.forEach(listener => {
    if (listener.port) {
      listener.port.onMessage.removeListener(listener.listener);
    } else if (listener.type === 'runtime') {
      chrome.runtime.onMessage.removeListener(listener.listener);
    }
  });
  
  messageListeners = [];
}

// Expose API to content script
window.sidebarApp = {
  initialize: initializeSidebar,
  cleanup: cleanupSidebar
};

// For direct development/testing
if (document.getElementById('sidebar-root')) {
  initializeSidebar(document.getElementById('sidebar-root'));
}