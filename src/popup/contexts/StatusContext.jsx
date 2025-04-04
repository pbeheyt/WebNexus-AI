// src/components/context/StatusContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState('Ready to process.');
  
  // Update status without showing toast
  const updateStatus = useCallback((message, isProcessing = false) => {
    setStatusMessage(message);
  }, []);
  
  const notifyCustomPromptChanged = useCallback((promptName) => {
    updateStatus(`Custom prompt changed to "${promptName}"`);
  }, [updateStatus]);
  
  const notifyPlatformChanged = useCallback((platformName) => {
    updateStatus(`Platform set to ${platformName}`);
  }, [updateStatus]);
  
  const notifyQuickPromptUpdated = useCallback(() => {
    updateStatus('Quick prompt updated');
  }, [updateStatus]);
  
  return (
    <StatusContext.Provider value={{
      statusMessage,
      updateStatus,
      notifyCustomPromptChanged,
      notifyPlatformChanged,
      notifyQuickPromptUpdated
    }}>
      {children}
    </StatusContext.Provider>
  );
}

export const useStatus = () => useContext(StatusContext);
