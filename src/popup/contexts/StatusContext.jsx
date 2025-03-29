// src/components/context/StatusContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState('Ready to process.');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [showToast, setShowToast] = useState(false);
  const [toastTimeout, setToastTimeout] = useState(null);
  
  // Clear any existing toast timeout when showing a new toast
  const clearToastTimeout = useCallback(() => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      setToastTimeout(null);
    }
  }, [toastTimeout]);
  
  // Update status without showing toast
  const updateStatus = useCallback((message, isProcessing = false) => {
    setStatusMessage(message);
  }, []);
  
  // Show toast with auto-dismiss
  const showToastMessage = useCallback((message, type = 'info', duration = 5000) => {
    clearToastTimeout();
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Auto-hide after duration
    const timeout = setTimeout(() => {
      setShowToast(false);
    }, duration);
    
    setToastTimeout(timeout);
  }, [clearToastTimeout]);
  
  const notifyCustomPromptChanged = useCallback((promptName) => {
    updateStatus(`Custom prompt changed to "${promptName}"`);
  }, [updateStatus]);
  
  const notifyPlatformChanged = useCallback((platformName) => {
    updateStatus(`Platform set to ${platformName}`);
  }, [updateStatus]);
  
  const notifyQuickPromptUpdated = useCallback(() => {
    updateStatus('Quick prompt updated');
  }, [updateStatus]);
  
  // YouTube-specific notifications
  const notifyYouTubeError = useCallback((errorMessage) => {
    updateStatus(errorMessage || 'YouTube transcript could not be loaded', false, false);
    showToastMessage(errorMessage || 'YouTube transcript could not be loaded', 'error');
  }, [updateStatus, showToastMessage]);
  
  return (
    <StatusContext.Provider value={{
      statusMessage,
      updateStatus,
      showToastMessage,
      notifyCustomPromptChanged,
      notifyPlatformChanged,
      notifyQuickPromptUpdated,
      notifyYouTubeError,
      toastState: {
        message: toastMessage,
        type: toastType,
        visible: showToast,
        setVisible: setShowToast
      }
    }}>
      {children}
    </StatusContext.Provider>
  );
}

export const useStatus = () => useContext(StatusContext);