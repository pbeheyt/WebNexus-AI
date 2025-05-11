// src/settings/components/tabs/KeyboardShortcutsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '../../../components';
import { SettingsCard } from '../ui/common/SettingsCard'; // Correct import path for SettingsCard
import { ShortcutCaptureInput } from '../ui/ShortcutCaptureInput';
import { CUSTOM_POPUP_SIDEBAR_SHORTCUT } from '../../../shared/constants';
import { logger } from '../../../shared/logger';

const DEFAULT_POPUP_SHORTCUT = {
  key: 's',
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
};

// Removed unused formatShortcut function

export function KeyboardShortcutsTab() {
  const [globalCommands, setGlobalCommands] = useState([]);
  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SHORTCUT);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [statusMessage, setStatusMessageState] = useState({ text: '', type: 'info' });

  const setFeedback = (text, type = 'info', duration = 3000) => {
    setStatusMessageState({ text, type });
    if (duration > 0) {
      setTimeout(() => setStatusMessageState({ text: '', type: 'info' }), duration);
    }
  };

  useEffect(() => {
    const fetchCommands = async () => {
      setIsLoadingCommands(true);
      try {
        if (chrome.commands && chrome.commands.getAll) {
          const commands = await chrome.commands.getAll();
          setGlobalCommands(commands.filter(cmd => cmd.name !== '_execute_browser_action' && cmd.name !== '_execute_page_action')); // Filter out older manifest popup commands
        } else {
          logger.settings.warn('chrome.commands API not available.');
          setGlobalCommands([]);
        }
      } catch (error) {
        logger.settings.error('Error fetching global commands:', error);
        setFeedback('Error fetching global commands.', 'error');
      } finally {
        setIsLoadingCommands(false);
      }
    };

    const loadCustomShortcut = async () => {
      try {
        const result = await chrome.storage.sync.get([CUSTOM_POPUP_SIDEBAR_SHORTCUT]);
        if (result[CUSTOM_POPUP_SIDEBAR_SHORTCUT]) {
          setCustomPopupShortcut(result[CUSTOM_POPUP_SIDEBAR_SHORTCUT]);
        } else {
          setCustomPopupShortcut(DEFAULT_POPUP_SHORTCUT);
        }
      } catch (error) {
        logger.settings.error('Error loading custom popup shortcut:', error);
        setFeedback('Error loading custom shortcut.', 'error');
      }
    };

    fetchCommands();
    loadCustomShortcut();
  }, []);

  const handleOpenShortcutsPage = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const handleCustomShortcutChange = useCallback((newShortcut) => {
    setCustomPopupShortcut(newShortcut);
  }, []);

  const handleSaveCustomShortcut = async () => {
    setIsSavingShortcut(true);
    setFeedback('Saving...', 'info', 0); // Persistent "Saving..."
    try {
      // Basic validation: ensure a key is present
      if (!customPopupShortcut || !customPopupShortcut.key || customPopupShortcut.key.trim() === '') {
        setFeedback('Invalid shortcut: Key cannot be empty.', 'error');
        setIsSavingShortcut(false);
        return;
      }
       // Ensure at least one modifier if the key is not a function key or special key
      const isFunctionKey = customPopupShortcut.key.toLowerCase().startsWith('f') && !isNaN(parseInt(customPopupShortcut.key.substring(1), 10));
      const isSpecialKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'enter', 'tab', 'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown'].includes(customPopupShortcut.key.toLowerCase());

      if (!isFunctionKey && !isSpecialKey && !customPopupShortcut.altKey && !customPopupShortcut.ctrlKey && !customPopupShortcut.metaKey && !customPopupShortcut.shiftKey) {
        setFeedback('Invalid shortcut: Please include at least one modifier (Alt, Ctrl, Shift, Cmd) for letter/number keys.', 'error');
        setIsSavingShortcut(false);
        return;
      }

      await chrome.storage.sync.set({ [CUSTOM_POPUP_SIDEBAR_SHORTCUT]: customPopupShortcut });
      setFeedback('Popup sidebar shortcut saved successfully!', 'success');
    } catch (error) {
      logger.settings.error('Error saving custom popup shortcut:', error);
      setFeedback(`Error saving shortcut: ${error.message}`, 'error');
    } finally {
      setIsSavingShortcut(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      <SettingsCard title="Global Extension Shortcuts">
        <div className="text-sm text-theme-secondary mb-4">
          These shortcuts are managed in Chrome's settings and apply globally. This extension cannot change them directly.
        </div>
        {isLoadingCommands ? (
          <p>Loading global shortcuts...</p>
        ) : globalCommands.length > 0 ? (
          <ul className="space-y-2 mb-4">
            {globalCommands.map((command) => (
              <li key={command.name} className="flex justify-between items-center">
                <span>{command.description || command.name}</span>
                <span className="font-mono text-xs bg-theme-hover px-2 py-1 rounded">
                  {command.shortcut || 'Not set'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-theme-secondary">No global commands found or API not available.</p>
        )}
        <Button onClick={handleOpenShortcutsPage} variant="secondary" size="md">
          Manage Extension Shortcuts in Chrome
        </Button>
      </SettingsCard>

      <SettingsCard title="Popup Sidebar Toggle Shortcut">
        <div className="text-sm text-theme-secondary mb-4">
          Customize the shortcut used <span className="font-semibold">inside the popup window</span> to open or close the main sidebar. Default is Alt+S.
        </div>
        <div className="mb-3">
          <ShortcutCaptureInput
            value={customPopupShortcut}
            onChange={handleCustomShortcutChange}
            defaultShortcut={DEFAULT_POPUP_SHORTCUT}
          />
        </div>
        <Button onClick={handleSaveCustomShortcut} isLoading={isSavingShortcut} loadingText="Saving..." size="md">
          Save Popup Shortcut
        </Button>
        {statusMessage.text && (
           <div className={`mt-3 text-sm ${statusMessage.type === 'error' ? 'text-error' : statusMessage.type === 'success' ? 'text-success' : 'text-theme-secondary'}`}>
            {statusMessage.text}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

export default KeyboardShortcutsTab;
