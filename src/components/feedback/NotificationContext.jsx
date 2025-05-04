// src/components/feedback/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const NotificationContext = createContext(null);

export const useNotification = () => useContext(NotificationContext);

/**
 * Provider component for application-wide notification system.
 */
export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const [timeoutId, setTimeoutId] = useState(null);

  const clearNotification = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setNotification(null);
  }, [timeoutId]);

  const showNotification = useCallback(
    (message, type = 'info', duration = 3000) => {
      // Clear any existing notification
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new notification
      setNotification({ message, type });

      // Auto dismiss after duration
      const id = setTimeout(() => {
        setNotification(null);
        setTimeoutId(null);
      }, duration);

      setTimeoutId(id);
    },
    [timeoutId]
  );

  const success = useCallback(
    (message, duration = 3000) => {
      showNotification(message, 'success', duration);
    },
    [showNotification]
  );

  const error = useCallback(
    (message, duration = 5000) => {
      showNotification(message, 'error', duration);
    },
    [showNotification]
  );

  const warning = useCallback(
    (message, duration = 4000) => {
      showNotification(message, 'warning', duration);
    },
    [showNotification]
  );

  const info = useCallback(
    (message, duration = 3000) => {
      showNotification(message, 'info', duration);
    },
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        notification,
        showNotification,
        clearNotification,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default NotificationProvider;
