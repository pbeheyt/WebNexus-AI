// src/hooks/useConfigurableShortcut.js
import { useState, useEffect } from 'react';
// The logger instance is passed in for context-specific logging.

export function useConfigurableShortcut(
  shortcutStorageKey,
  defaultShortcutConfig,
  onShortcutPressCallback,
  loggerInstance
) {
  const [currentShortcutConfig, setCurrentShortcutConfig] = useState(
    defaultShortcutConfig
  );

  // Effect to load the shortcut configuration from storage
  useEffect(() => {
    const loadShortcut = async () => {
      try {
        const result = await chrome.storage.sync.get([shortcutStorageKey]);
        if (result[shortcutStorageKey]) {
          setCurrentShortcutConfig(result[shortcutStorageKey]);
          loggerInstance.info(
            'Custom shortcut loaded from storage:',
            result[shortcutStorageKey]
          );
        } else {
          setCurrentShortcutConfig(defaultShortcutConfig); // Fallback to default
          loggerInstance.info(
            'No custom shortcut found in storage, using default.'
          );
        }
      } catch (error) {
        loggerInstance.error(
          'Error loading custom shortcut from storage:',
          error
        );
        setCurrentShortcutConfig(defaultShortcutConfig); // Fallback to default on error
      }
    };
    loadShortcut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcutStorageKey]); // Dependencies for loading

  // Effect to set up the keydown listener
  useEffect(() => {
    const handleKeyDown = async (event) => {
      // Ensure currentShortcutConfig is fully loaded before checking keys
      if (!currentShortcutConfig || !currentShortcutConfig.key) {
        loggerInstance.warn(
          'Shortcut configuration not yet loaded, skipping keydown event.'
        );
        return;
      }

      const { key, altKey, ctrlKey, shiftKey, metaKey } = currentShortcutConfig;
      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        event.altKey === !!altKey &&
        event.ctrlKey === !!ctrlKey &&
        event.shiftKey === !!shiftKey &&
        event.metaKey === !!metaKey
      ) {
        event.preventDefault();
        loggerInstance.info(
          `Shortcut pressed: ${JSON.stringify(currentShortcutConfig)}`
        );
        if (typeof onShortcutPressCallback === 'function') {
          try {
            await onShortcutPressCallback();
          } catch (callbackError) {
            loggerInstance.error(
              'Error executing shortcut callback:',
              callbackError
            );
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    loggerInstance.info('Shortcut keydown listener added.');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      loggerInstance.info('Shortcut keydown listener removed.');
    };
  }, [currentShortcutConfig, onShortcutPressCallback, loggerInstance]);

  return { currentShortcutConfig };
}
