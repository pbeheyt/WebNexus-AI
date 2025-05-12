// src/settings/components/tabs/KeyboardShortcutsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '../../../components';
import { SettingsCard } from '../ui/common/SettingsCard';
import { ShortcutCaptureInput } from '../ui/ShortcutCaptureInput';
import { CUSTOM_POPUP_SIDEBAR_SHORTCUT, DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG } from '../../../shared/constants';
import { logger } from '../../../shared/logger';
import { formatShortcutToStringDisplay } from '../../../shared/utils/shortcut-utils';

export function KeyboardShortcutsTab() {
  const [globalCommands, setGlobalCommands] = useState([]);
  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
  const [editableCustomShortcut, setEditableCustomShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
  const [isEditingCustomShortcut, setIsEditingCustomShortcut] = useState(false);
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
          setGlobalCommands(commands.filter(cmd => cmd.name !== '_execute_browser_action' && cmd.name !== '_execute_page_action'));
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
        const loadedShortcut = result[CUSTOM_POPUP_SIDEBAR_SHORTCUT] || DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG;
        setCustomPopupShortcut(loadedShortcut);
        setEditableCustomShortcut(loadedShortcut); // Initialize editable state
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

  const handleEditableShortcutChange = useCallback((newShortcut) => {
    setEditableCustomShortcut(newShortcut);
  }, []);

  const handleStartEditCustomShortcut = () => {
    setEditableCustomShortcut(customPopupShortcut); // Ensure editable starts with current saved value
    setIsEditingCustomShortcut(true);
  };

  const handleCancelEditCustomShortcut = () => {
    setIsEditingCustomShortcut(false);
    setEditableCustomShortcut(customPopupShortcut); // Reset to saved value
  };

  const handleSaveCustomShortcut = async () => {
    setIsSavingShortcut(true);
    setFeedback('Saving...', 'info', 0);
    try {
      if (!editableCustomShortcut || !editableCustomShortcut.key || editableCustomShortcut.key.trim() === '') {
        setFeedback('Invalid shortcut: Key cannot be empty.', 'error');
        setIsSavingShortcut(false);
        return;
      }
      
      const isFunctionKey = editableCustomShortcut.key.toLowerCase().startsWith('f') && !isNaN(parseInt(editableCustomShortcut.key.substring(1), 10));
      const isSpecialKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'enter', 'tab', 'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown', ' '].includes(editableCustomShortcut.key.toLowerCase());

      if (!isFunctionKey && !isSpecialKey && !editableCustomShortcut.altKey && !editableCustomShortcut.ctrlKey && !editableCustomShortcut.metaKey && !editableCustomShortcut.shiftKey) {
        setFeedback('Invalid shortcut: Please include at least one modifier (Alt, Ctrl, Shift, Cmd) for letter/number keys.', 'error');
        setIsSavingShortcut(false);
        return;
      }

      await chrome.storage.sync.set({ [CUSTOM_POPUP_SIDEBAR_SHORTCUT]: editableCustomShortcut });
      setCustomPopupShortcut(editableCustomShortcut); // Update the main display state
      setIsEditingCustomShortcut(false); // Exit editing mode
      setFeedback('Sidebar toggle shortcut saved successfully!', 'success');
    } catch (error) {
      logger.settings.error('Error saving custom popup shortcut:', error);
      setFeedback(`Error saving shortcut: ${error.message}`, 'error');
    } finally {
      setIsSavingShortcut(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:gap-6 p-1">
      {/* Left Column: Registered Extension Shortcuts */}
      <div className="w-full md:w-1/2 mb-6 md:mb-0">
        <SettingsCard>
          <h3 className="text-base font-semibold text-theme-primary mb-2">Registered Extension Shortcuts</h3>
          <p className="text-sm text-theme-secondary mb-6">
            These shortcuts are defined by the extension and can be managed on Chrome's extensions page. This extension registers the following global commands:
          </p>
          {isLoadingCommands ? (
            <p className="text-theme-secondary py-3">Loading global shortcuts...</p>
          ) : globalCommands.length > 0 ? (
            <ul className="space-y-0 mb-6">
              {globalCommands.map((command) => (
                <li key={command.name} className="flex justify-between items-center py-3 border-b border-theme last:border-b-0">
                  <span className="text-sm text-theme-primary">{command.description || command.name}</span>
                  <span className="font-mono text-xs bg-theme-hover px-2 py-1 rounded text-theme-secondary">
                    {command.shortcut || 'Not set'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-theme-secondary py-3 mb-6">No global commands found or API not available.</p>
          )}
          <Button onClick={handleOpenShortcutsPage} variant="secondary" size="md">
            Manage in Chrome Settings
          </Button>
        </SettingsCard>
      </div>

      {/* Right Column: Sidebar Toggle Shortcut */}
      <div className="w-full md:w-1/2">
        <SettingsCard>
          <h3 className="text-base font-semibold text-theme-primary mb-2">Sidebar Toggle Shortcut</h3>
          <p className="text-sm text-theme-secondary mb-6">
            This shortcut is used within the extension's popup to open/close the sidebar, and from within the sidebar itself to close it. Default: {formatShortcutToStringDisplay(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG)}.
          </p>
          
          {!isEditingCustomShortcut ? (
            <>
              <div className="flex justify-between items-center py-3 border-b border-theme mb-6">
                <span className="text-sm text-theme-primary">Current Sidebar Toggle Key</span>
                <span className="font-mono text-xs bg-theme-hover px-2 py-1 rounded text-theme-secondary">
                  {formatShortcutToStringDisplay(customPopupShortcut)}
                </span>
              </div>
              <Button onClick={handleStartEditCustomShortcut} variant="secondary" size="md">
                Update Shortcut
              </Button>
            </>
          ) : (
            <div className="mb-3">
              <div className="mb-4">
                <ShortcutCaptureInput
                  value={editableCustomShortcut}
                  onChange={handleEditableShortcutChange}
                  defaultShortcut={DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSaveCustomShortcut} isLoading={isSavingShortcut} loadingText="Saving..." size="md">
                  Save
                </Button>
                <Button onClick={handleCancelEditCustomShortcut} variant="secondary" size="md" disabled={isSavingShortcut}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {statusMessage.text && (
             <div className={`mt-4 text-sm ${statusMessage.type === 'error' ? 'text-error' : statusMessage.type === 'success' ? 'text-success' : 'text-theme-secondary'}`}>
              {statusMessage.text}
            </div>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}

export default KeyboardShortcutsTab;
