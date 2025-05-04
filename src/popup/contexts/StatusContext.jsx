// src/components/context/StatusContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState('Ready to process.');

  const updateStatus = useCallback((message = false) => {
    setStatusMessage(message);
  }, []);

  const notifyPlatformChanged = useCallback(
    (platformName) => {
      updateStatus(`Platform set to ${platformName}`);
    },
    [updateStatus]
  );

  return (
    <StatusContext.Provider
      value={{
        statusMessage,
        updateStatus,
        notifyPlatformChanged,
      }}
    >
      {children}
    </StatusContext.Provider>
  );
}

StatusProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useStatus = () => useContext(StatusContext);
