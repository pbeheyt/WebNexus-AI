// src/settings/components/tabs/KeyboardShortcutsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';

// Helper function to parse chrome.commands shortcut strings
const parseChromeCommandShortcut = (shortcutString) => {
  if (!shortcutString || typeof shortcutString !== 'string' || shortcutString.trim() === '') {
    return null; // No shortcut defined
  }

  const parts = shortcutString.toLowerCase().split('+');
  const key = parts.pop(); // The last part is the key

  if (!key) return null; // Should not happen if string is not empty

  const modifiers = {
    key: key,
    altKey: parts.includes('alt'),
    ctrlKey: parts.includes('ctrl') || parts.includes('control'),
    shiftKey: parts.includes('shift'),
    metaKey: parts.includes('macctrl') || parts.includes('command') || parts.includes('cmd'), // Meta on Mac often 'MacCtrl' or 'Command'
  };

  return modifiers;
};

import { Button, useNotification, Modal, SpinnerIcon } from '../../../components';
import { SettingsCard } from '../ui/common/SettingsCard';
import { ShortcutCaptureInput } from '../ui/ShortcutCaptureInput';
import { STORAGE_KEYS, DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG, DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG } from '../../../shared/constants';
import { logger } from '../../../shared/logger';
import { formatShortcutToStringDisplay } from '../../../shared/utils/shortcut-utils';

export function KeyboardShortcutsTab() {
  const [globalCommands, setGlobalCommands] = useState([]);
  const [customPopupShortcut, setCustomPopupShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG);
  const [editableCustomShortcut, setEditableCustomShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [shortcutModalError, setShortcutModalError] = useState('');
  
  const { success: showSuccessNotification, error: showErrorNotification, info: showInfoNotification, clearNotification } = useNotification();

  const [customSidepanelDefaultPromptShortcut, setCustomSidepanelDefaultPromptShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG);
  const [editableSidepanelDefaultPromptShortcut, setEditableSidepanelDefaultPromptShortcut] = useState(DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG);
  const [isDefaultPromptShortcutModalOpen, setIsDefaultPromptShortcutModalOpen] = useState(false);

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
        const result = await chrome.storage.sync.get([STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT]);
        const loadedShortcut = result[STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT] || DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG;
        setCustomPopupShortcut(loadedShortcut);
        setEditableCustomShortcut(loadedShortcut);
      } catch (error) {
        logger.settings.error('Error loading custom popup shortcut:', error);
        showErrorNotification('Error loading custom shortcut.');
      }
    };

    const loadCustomSidepanelDefaultPromptShortcut = async () => {
      try {
        const result = await chrome.storage.sync.get([STORAGE_KEYS.CUSTOM_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT]);
        const loadedShortcut = result[STORAGE_KEYS.CUSTOM_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT] || DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG;
        setCustomSidepanelDefaultPromptShortcut(loadedShortcut);
        setEditableSidepanelDefaultPromptShortcut(loadedShortcut); 
      } catch (error) {
        logger.settings.error('Error loading custom sidepanel default prompt shortcut:', error);
        showErrorNotification('Error loading custom sidepanel default prompt shortcut.');
        setCustomSidepanelDefaultPromptShortcut(DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG);
        setEditableSidepanelDefaultPromptShortcut(DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG);
      }
    };

    fetchCommands();
    loadCustomShortcut();
    loadCustomSidepanelDefaultPromptShortcut();
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
    if (globalCommands && globalCommands.length > 0) {
      for (const command of globalCommands) {
        const globalShortcutObj = parseChromeCommandShortcut(command.shortcut);
        if (globalShortcutObj) {
          const mainKeyMatch = editableCustomShortcut.key.toLowerCase() === globalShortcutObj.key.toLowerCase();
          const altMatch = !!editableCustomShortcut.altKey === !!globalShortcutObj.altKey;
          const ctrlMatch = !!editableCustomShortcut.ctrlKey === !!globalShortcutObj.ctrlKey;
          const shiftMatch = !!editableCustomShortcut.shiftKey === !!globalShortcutObj.shiftKey;
          const metaMatch = !!editableCustomShortcut.metaKey === !!globalShortcutObj.metaKey;

          if (mainKeyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch) {
            setShortcutModalError(
              `Conflicts with: '${command.description || command.name}'. Choose a different shortcut.`
            );
            setIsSavingShortcut(false); 
            return; 
          }
        }
      }
    }

    if (customSidepanelDefaultPromptShortcut) {
        const mainKeyMatch = editableCustomShortcut.key.toLowerCase() === customSidepanelDefaultPromptShortcut.key.toLowerCase();
        const altMatch = !!editableCustomShortcut.altKey === !!customSidepanelDefaultPromptShortcut.altKey;
        const ctrlMatch = !!editableCustomShortcut.ctrlKey === !!customSidepanelDefaultPromptShortcut.ctrlKey;
        const shiftMatch = !!editableCustomShortcut.shiftKey === !!customSidepanelDefaultPromptShortcut.shiftKey;
        const metaMatch = !!editableCustomShortcut.metaKey === !!customSidepanelDefaultPromptShortcut.metaKey;

        if (mainKeyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch) {
          setShortcutModalError(
            `Conflicts with the 'Side Panel Default Prompt Shortcut' (${formatShortcutToStringDisplay(customSidepanelDefaultPromptShortcut)}). Choose a different shortcut.`
          );
          return; 
        }
    }

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

      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT]: editableCustomShortcut });
      setCustomPopupShortcut(editableCustomShortcut);
      showSuccessNotification('Side Panel toggle shortcut saved successfully!');
      setIsShortcutModalOpen(false); 
    } catch (error) {
      logger.settings.error('Error saving custom popup shortcut:', error);
      showErrorNotification(`Error saving shortcut: ${error.message}`);
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleOpenDefaultPromptShortcutModal = () => {
    setEditableSidepanelDefaultPromptShortcut(customSidepanelDefaultPromptShortcut); 
    setShortcutModalError(''); 
    setIsDefaultPromptShortcutModalOpen(true);
  };

  const handleCloseDefaultPromptShortcutModal = () => {
    setIsDefaultPromptShortcutModalOpen(false);
    setShortcutModalError(''); 
  };

  const handleSaveDefaultPromptCustomShortcut = async () => {
    if (globalCommands && globalCommands.length > 0) {
      for (const command of globalCommands) {
        const globalShortcutObj = parseChromeCommandShortcut(command.shortcut);
        if (globalShortcutObj) {
          const mainKeyMatch = editableSidepanelDefaultPromptShortcut.key.toLowerCase() === globalShortcutObj.key.toLowerCase();
          const altMatch = !!editableSidepanelDefaultPromptShortcut.altKey === !!globalShortcutObj.altKey;
          const ctrlMatch = !!editableSidepanelDefaultPromptShortcut.ctrlKey === !!globalShortcutObj.ctrlKey;
          const shiftMatch = !!editableSidepanelDefaultPromptShortcut.shiftKey === !!globalShortcutObj.shiftKey;
          const metaMatch = !!editableSidepanelDefaultPromptShortcut.metaKey === !!globalShortcutObj.metaKey;

          if (mainKeyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch) {
            setShortcutModalError(
              `Conflicts with global command: '${command.description || command.name}'. Choose a different shortcut.`
            );
            return;
          }
        }
      }
    }

    if (customPopupShortcut) {
        const mainKeyMatch = editableSidepanelDefaultPromptShortcut.key.toLowerCase() === customPopupShortcut.key.toLowerCase();
        const altMatch = !!editableSidepanelDefaultPromptShortcut.altKey === !!customPopupShortcut.altKey;
        const ctrlMatch = !!editableSidepanelDefaultPromptShortcut.ctrlKey === !!customPopupShortcut.ctrlKey;
        const shiftMatch = !!editableSidepanelDefaultPromptShortcut.shiftKey === !!customPopupShortcut.shiftKey;
        const metaMatch = !!editableSidepanelDefaultPromptShortcut.metaKey === !!customPopupShortcut.metaKey;

        if (mainKeyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch) {
          setShortcutModalError(
            `Conflicts with the 'Side Panel Toggle Shortcut' (${formatShortcutToStringDisplay(customPopupShortcut)}). Choose a different shortcut.`
          );
          return;
        }
    }

    setIsSavingShortcut(true); 
    setShortcutModalError('');

    try {
      if (!editableSidepanelDefaultPromptShortcut || !editableSidepanelDefaultPromptShortcut.key || editableSidepanelDefaultPromptShortcut.key.trim() === '') {
        setShortcutModalError('Invalid shortcut: Key cannot be empty.');
        setIsSavingShortcut(false);
        return;
      }

      const isFunctionKey = editableSidepanelDefaultPromptShortcut.key.toLowerCase().startsWith('f') && !isNaN(parseInt(editableSidepanelDefaultPromptShortcut.key.substring(1), 10));
      const isSpecialKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'enter', 'tab', 'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown', ' '].includes(editableSidepanelDefaultPromptShortcut.key.toLowerCase());

      if (!isFunctionKey && !isSpecialKey && !editableSidepanelDefaultPromptShortcut.altKey && !editableSidepanelDefaultPromptShortcut.ctrlKey && !editableSidepanelDefaultPromptShortcut.metaKey && !editableSidepanelDefaultPromptShortcut.shiftKey) {
        setShortcutModalError('Invalid shortcut: Please include at least one modifier (Alt, Ctrl, Shift, Cmd) for letter/number keys.');
        setIsSavingShortcut(false);
        return;
      }
      
      showInfoNotification('Saving shortcut...');

      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT]: editableSidepanelDefaultPromptShortcut });
      setCustomSidepanelDefaultPromptShortcut(editableSidepanelDefaultPromptShortcut);
      showSuccessNotification('Side Panel Default Prompt shortcut saved successfully!');
      setIsDefaultPromptShortcutModalOpen(false);
    } catch (error) {
      logger.settings.error('Error saving custom sidepanel default prompt shortcut:', error);
      showErrorNotification(`Error saving shortcut: ${error.message}`);
    } finally {
      setIsSavingShortcut(false);
    }
  };


  return (
    <>
      <h2 className='type-heading mb-4 pb-3 border-b border-theme text-lg font-medium'>
        Keyboard Shortcuts
      </h2>
      <p className='section-description text-sm text-theme-secondary mb-6'>
        Manage your extension&apos;a keyboard shortcuts. Global shortcuts are configured in Chrome&apos;a settings, while the sidepanel toggle shortcut can be customized here.
      </p>
      <div className="flex flex-col md:flex-row md:gap-6">
        {/* Left Column: Registered Extension Shortcuts */}
        <div className="w-full md:w-1/2 mb-6">
          <SettingsCard>
            <h3 className="text-base font-semibold text-theme-primary mb-2">Registered Chrome Shortcuts</h3>
            <p className="text-sm text-theme-secondary mb-6">
              These shortcuts are defined by the extension and can be managed on Chrome&apos;a extensions page.
            </p>
            {isLoadingCommands ? (
              <div className="flex items-center justify-center py-2 text-theme-secondary">
                <SpinnerIcon className="w-6 h-6" />
                <span className="ml-2">Loading global shortcuts...</span>
              </div>
            ) : globalCommands.length > 0 ? (
              <ul className="space-y-3 mb-6">
                {globalCommands.map((command) => (
                  <li 
                    key={command.name} 
                    className="flex justify-between items-center py-2 px-5 rounded-md bg-theme-hover border border-theme"
                  >
                    <span className="text-sm text-theme-primary">
                      {command.name === '_execute_action' 
                        ? 'Open the Extension Popup' 
                        : (command.description || command.name)}
                    </span>
                    <span className="font-mono text-sm bg-theme-surface ml-10 px-2 py-1 rounded text-theme-secondary">
                      {(command.shortcut || '').replace(/\+/g, ' + ') || 'Not set'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-theme-secondary py-2 mb-6">No global commands found or API not available.</p>
            )}
            <Button onClick={handleOpenShortcutsPage} variant="secondary" size="md">
              Manage in Chrome Settings
            </Button>
          </SettingsCard>
        </div>

        {/* Right Column: Custom Shortcuts */}
        <div className="w-full md:w-1/2">
          <SettingsCard>
            <h3 className="text-base font-semibold text-theme-primary mb-2">Side Panel Toggle Shortcut</h3>
            <p className="text-sm text-theme-secondary mb-6">
              This shortcut is used within the extension&apos;a popup to open/close the Side Panel, and from within the Side Panel itself to close it when focused.
            </p>
            
            <div 
              className="flex justify-between items-center py-2 px-5 rounded-md bg-theme-hover mb-6 border border-theme"
            >
              <span className="text-sm text-theme-primary">Toggle the Side Panel</span>
              <span className="font-mono text-sm bg-theme-surface ml-10 px-2 py-1 rounded text-theme-secondary">
                {formatShortcutToStringDisplay(customPopupShortcut)}
              </span>
            </div>
            <Button onClick={handleOpenShortcutModal} variant="secondary" size="md">
              Update Shortcut
            </Button>
          </SettingsCard>

          {/* New Card for "Open Side Panel & Process Default Prompt" Shortcut */}
          <SettingsCard className="mt-6">
            <h3 className="text-base font-semibold text-theme-primary mb-2">Side Panel - Default Prompt Shortcut</h3>
            <p className="text-sm text-theme-secondary mb-6">
              This shortcut is used within the extension&apos;a popup to open the Side Panel and automatically process the default prompt for the current page content.
            </p>
            
            <div 
              className="flex justify-between items-center py-2 px-5 rounded-md bg-theme-hover mb-6 border border-theme"
            >
              <span className="text-sm text-theme-primary">Open Side Panel & Process Default Prompt</span>
              <span className="font-mono text-sm bg-theme-surface ml-10 px-2 py-1 rounded text-theme-secondary">
                {formatShortcutToStringDisplay(customSidepanelDefaultPromptShortcut)}
              </span>
            </div>
            <Button onClick={handleOpenDefaultPromptShortcutModal} variant="secondary" size="md">
              Update Shortcut
            </Button>
          </SettingsCard>
        </div>
      </div>

      <Modal 
        isOpen={isShortcutModalOpen} 
        onClose={handleCloseShortcutModal}
        title="Update Side Panel Toggle Shortcut"
        widthClass="max-w-sm"
      >
        <div>
          <div className="flex items-center gap-10">
            <ShortcutCaptureInput
              value={editableCustomShortcut}
              onChange={handleEditableShortcutChange}
              defaultShortcut={DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG}
            />
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
            <p className="text-sm text-error text-center my-3">{shortcutModalError}</p> 
          )}
        </div>
      </Modal>

      <Modal 
        isOpen={isDefaultPromptShortcutModalOpen} 
        onClose={handleCloseDefaultPromptShortcutModal}
        title="Update Side Panel Default Prompt Shortcut"
        widthClass="max-w-sm"
      >
        <div>
          <div className="flex items-center gap-10">
            <ShortcutCaptureInput
              value={editableSidepanelDefaultPromptShortcut}
              onChange={setEditableSidepanelDefaultPromptShortcut} 
              defaultShortcut={DEFAULT_POPUP_SIDEPANEL_DEFAULT_PROMPT_SHORTCUT_CONFIG}
            />
            <div className="flex-shrink-0 flex gap-2"> 
              <Button 
                onClick={handleSaveDefaultPromptCustomShortcut} 
                isLoading={isSavingShortcut} 
                loadingText="Saving..." 
                size="md"
                className="px-5" 
              >
                Save
              </Button>
              <Button 
                onClick={handleCloseDefaultPromptShortcutModal} 
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
            <p className="text-sm text-error text-center my-3">{shortcutModalError}</p> 
          )}
        </div>
      </Modal>
    </>
  );
}

export default KeyboardShortcutsTab;