// src/settings/components/tabs/KeyboardShortcutsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';

import { Button, useNotification, Modal } from '../../../components';
import { SettingsCard } from '../ui/common/SettingsCard';
import { ShortcutCaptureInput } from '../ui/ShortcutCaptureInput';
import { CUSTOM_POPUP_SIDEBAR_SHORTCUT, DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG } from '../../../shared/constants';
import { logger } from '../../../shared/logger';
import { formatShortcutToStringDisplay } from '../../../shared/utils/shortcut-utils';

export function KeyboardShortcutsTab() {
  const [globalCommands, setGlobalCommands] = useState([]);
  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
  const [editableCustomShortcut, setEditableCustomShortcut] = useState(DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [shortcutModalError, setShortcutModalError] = useState('');
  
  const { success: showSuccessNotification, error: showErrorNotification, info: showInfoNotification, clearNotification } = useNotification();

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
        showErrorNotification('Error fetching global commands.');
      } finally {
        setIsLoadingCommands(false);
      }
    };

    const loadCustomShortcut = async () => {
      try {
        const result = await chrome.storage.sync.get([CUSTOM_POPUP_SIDEBAR_SHORTCUT]);
        const loadedShortcut = result[CUSTOM_POPUP_SIDEBAR_SHORTCUT] || DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG;
        setCustomPopupShortcut(loadedShortcut);
        setEditableCustomShortcut(loadedShortcut);
      } catch (error) {
        logger.settings.error('Error loading custom popup shortcut:', error);
        showErrorNotification('Error loading custom shortcut.');
      }
    };

    fetchCommands();
    loadCustomShortcut();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleOpenShortcutsPage = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const handleEditableShortcutChange = useCallback((newShortcut) => {
    setEditableCustomShortcut(newShortcut);
    setShortcutModalError(''); 
  }, []);

  const handleOpenShortcutModal = () => {
    setEditableCustomShortcut(customPopupShortcut); 
    setShortcutModalError(''); 
    setIsShortcutModalOpen(true);
  };

  const handleCloseShortcutModal = () => {
    setIsShortcutModalOpen(false);
    setEditableCustomShortcut(customPopupShortcut); 
    setShortcutModalError(''); 
    clearNotification(); 
  };

  const handleSaveCustomShortcut = async () => {
    setIsSavingShortcut(true);
    setShortcutModalError(''); 
    
    try {
      if (!editableCustomShortcut || !editableCustomShortcut.key || editableCustomShortcut.key.trim() === '') {
        setShortcutModalError('Invalid shortcut: Key cannot be empty.');
        setIsSavingShortcut(false);
        return; 
      }
      
      const isFunctionKey = editableCustomShortcut.key.toLowerCase().startsWith('f') && !isNaN(parseInt(editableCustomShortcut.key.substring(1), 10));
      const isSpecialKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'enter', 'tab', 'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown', ' '].includes(editableCustomShortcut.key.toLowerCase());

      if (!isFunctionKey && !isSpecialKey && !editableCustomShortcut.altKey && !editableCustomShortcut.ctrlKey && !editableCustomShortcut.metaKey && !editableCustomShortcut.shiftKey) {
        setShortcutModalError('Invalid shortcut: Please include at least one modifier (Alt, Ctrl, Shift, Cmd) for letter/number keys.');
        setIsSavingShortcut(false);
        return; 
      }

      showInfoNotification('Saving shortcut...'); 

      await chrome.storage.sync.set({ [CUSTOM_POPUP_SIDEBAR_SHORTCUT]: editableCustomShortcut });
      setCustomPopupShortcut(editableCustomShortcut);
      showSuccessNotification('Sidebar toggle shortcut saved successfully!');
      setIsShortcutModalOpen(false); 
    } catch (error) {
      logger.settings.error('Error saving custom popup shortcut:', error);
      showErrorNotification(`Error saving shortcut: ${error.message}`);
    } finally {
      setIsSavingShortcut(false);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:gap-6 p-1">
        {/* Left Column: Registered Extension Shortcuts */}
        <div className="w-full md:w-1/2 mb-4">
          <SettingsCard>
            <h3 className="text-base font-semibold text-theme-primary mb-2">Registered Chrome Shortcuts</h3>
            <p className="text-sm text-theme-secondary mb-4">
              These shortcuts are defined by the extension and can be managed on Chrome&apos;s extensions page.
            </p>
            {isLoadingCommands ? (
              <p className="text-theme-secondary py-2">Loading global shortcuts...</p>
            ) : globalCommands.length > 0 ? (
              <ul className="space-y-3 mb-4">
                {globalCommands.map((command) => (
                  <li 
                    key={command.name} 
                    className="flex justify-between items-center py-2 px-5 rounded-md bg-theme-hover"
                  >
                    <span className="text-sm text-theme-primary">
                      {command.name === '_execute_action' 
                        ? 'Open the Extension Popup' 
                        : (command.description || command.name)}
                    </span>
                    <span className="font-mono text-sm bg-theme-surface ml-10 p-2 rounded text-theme-secondary">
                      {(command.shortcut || '').replace(/\+/g, ' + ') || 'Not set'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-theme-secondary py-2 mb-4">No global commands found or API not available.</p>
            )}
            <Button onClick={handleOpenShortcutsPage} variant="secondary" size="md">
              Manage in Chrome Settings
            </Button>
          </SettingsCard>
        </div>

        {/* Right Column: Sidebar Toggle Shortcut */}
        <div className="w-full md:w-1/2">
          <SettingsCard>
            <h3 className="text-base font-semibold text-theme-primary mb-2">Side Panel Toggle Shortcut</h3>
            <p className="text-sm text-theme-secondary mb-4">
              This shortcut is used within the extension&apos;s popup to open/close the sidebar, and from within the sidebar itself to close it when focused.
            </p>
            
            <div 
              className="flex justify-between items-center py-2 px-5 rounded-md bg-theme-hover mb-4"
            >
              <span className="text-sm text-theme-primary">Toggle the Side Panel</span>
              <span className="font-mono text-sm bg-theme-surface ml-10 p-2 rounded text-theme-secondary">
                {formatShortcutToStringDisplay(customPopupShortcut)}
              </span>
            </div>
            <Button onClick={handleOpenShortcutModal} variant="secondary" size="md">
              Update Shortcut
            </Button>
          </SettingsCard>
        </div>
      </div>

      <Modal 
        isOpen={isShortcutModalOpen} 
        onClose={handleCloseShortcutModal}
        title="Update Sidebar Toggle Shortcut"
        widthClass="max-w-sm"
      >
        <div>
          <div className="flex items-center gap-10">
            <div className="w-40">
              <ShortcutCaptureInput
                value={editableCustomShortcut}
                onChange={handleEditableShortcutChange}
                defaultShortcut={DEFAULT_POPUP_SIDEBAR_SHORTCUT_CONFIG}
              />
            </div>
            <div className="flex-shrink-0 flex gap-2"> 
              <Button 
                onClick={handleSaveCustomShortcut} 
                isLoading={isSavingShortcut} 
                loadingText="Saving..." 
                size="md"
                className="px-5" 
              >
                Save
              </Button>
              <Button 
                onClick={handleCloseShortcutModal} 
                variant="secondary" 
                size="md" 
                disabled={isSavingShortcut}
                className="px-5" 
              >
                Cancel
              </Button>
            </div>
          </div>
          {shortcutModalError && (
            <p className="text-sm text-error text-center mb-1">{shortcutModalError}</p> 
          )}
        </div>
      </Modal>
    </>
  );
}

export default KeyboardShortcutsTab;