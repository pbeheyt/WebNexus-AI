import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';
import PropTypes from 'prop-types';

const NotificationContext = createContext(null);

export const useNotification = () => useContext(NotificationContext);

/**
 * Provider component for application-wide notification system.
 */
export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const timeoutIdRef = useRef(null);

  const clearNotification = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setNotification(null);
  }, []);

  const showNotification = useCallback(
    (message, type = 'info', duration = 5000) => {
      // Clear any existing notification
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // Set new notification
      setNotification({ message, type });

      // Auto dismiss after duration
      const id = setTimeout(() => {
        setNotification(null);
        timeoutIdRef.current = null;
      }, duration);

      timeoutIdRef.current = id;
    },
    []
  );

  const success = useCallback(
    (message, duration = 5000) => {
      showNotification(message, 'success', duration);
    },
    [showNotification]
  );

  const error = useCallback(
    (message, duration = 10000) => {
      showNotification(message, 'error', duration);
    },
    [showNotification]
  );

  const warning = useCallback(
    (message, duration = 5000) => {
      showNotification(message, 'warning', duration);
    },
    [showNotification]
  );

  const info = useCallback(
    (message, duration = 5000) => {
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
