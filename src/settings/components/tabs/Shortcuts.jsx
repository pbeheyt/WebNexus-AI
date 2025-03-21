import React, { useState, useEffect } from 'react';
import { Button, useNotification } from '../../../components';

const SHORTCUT_SETTINGS_KEY = 'shortcut_settings';

const Shortcuts = () => {
  const { success, error } = useNotification();
  const [settings, setSettings] = useState({
    summarization_behavior: 'selection'
  });
  const [commands, setCommands] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      
      try {
        // Load settings
        const result = await chrome.storage.sync.get(SHORTCUT_SETTINGS_KEY);
        if (result[SHORTCUT_SETTINGS_KEY]) {
          setSettings(result[SHORTCUT_SETTINGS_KEY]);
        }
        
        // Load commands (keyboard shortcuts)
        if (chrome.commands && chrome.commands.getAll) {
          const allCommands = await chrome.commands.getAll();
          setCommands(allCommands);
        } else {
          // Fallback for when commands API is unavailable 
          setCommands([
            { name: 'summarize-page', description: 'Summarize current page', shortcut: 'Not set' },
            { name: 'open-popup', description: 'Activate the extension', shortcut: 'Not set' }
          ]);
        }
      } catch (err) {
        console.error('Error loading shortcuts settings:', err);
        error('Failed to load shortcuts settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [error]);
  
  const updateSettings = async (newSettings) => {
    setIsSaving(true);
    
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings
      };
      
      await chrome.storage.sync.set({ [SHORTCUT_SETTINGS_KEY]: updatedSettings });
      setSettings(updatedSettings);
      success('Setting saved');
    } catch (err) {
      console.error('Error saving shortcut settings:', err);
      error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };
  
  const openChromeShortcutsPage = () => {
    try {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch (err) {
      console.error('Error opening Chrome shortcuts page:', err);
      error('Cannot access Chrome settings. Please go to chrome://extensions/shortcuts manually.');
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="mt-4">Loading shortcuts settings...</p>
      </div>
    );
  }
  
  return (
    <div className="shortcuts-tab-content max-w-3xl mx-auto">
      <h2 className="type-heading mb-4 pb-3 border-b border-theme text-lg font-medium">Keyboard Shortcuts</h2>
      <p className="section-description text-theme-secondary mb-6">
        Configure how the extension's keyboard shortcuts behave. To change the actual key combinations, 
        use Chrome's built-in shortcuts manager.
      </p>
      
      {/* Current Shortcuts Section */}
      <div className="shortcuts-section settings-section bg-theme-surface p-5 rounded-lg border border-theme mb-6">
        <h3 className="section-subtitle text-lg font-medium mb-4">Current Shortcuts</h3>
        
        <table className="shortcuts-table w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className="py-2 px-4 text-left bg-theme-hover font-medium">Action</th>
              <th className="py-2 px-4 text-left bg-theme-hover font-medium">Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {commands.length > 0 ? (
              commands.map((command, index) => (
                <tr key={index} className="border-b border-theme">
                  <td className="py-3 px-4">
                    {command.description || 
                      (command.name === '_execute_action' ? 'Activate the extension' : command.name)}
                  </td>
                  <td className="py-3 px-4 font-mono">{command.shortcut || 'Not set'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-3 px-4 text-center">No shortcuts configured</td>
              </tr>
            )}
          </tbody>
        </table>
        
        <Button 
          onClick={openChromeShortcutsPage}
          className="shortcuts-config-btn"
        >
          Change Keyboard Shortcuts
        </Button>
      </div>
      
      {/* Behavior Settings Section */}
      <div className="settings-section bg-theme-surface p-5 rounded-lg border border-theme">
        <h3 className="section-subtitle text-lg font-medium mb-4">Shortcut Behavior</h3>
        
        <div className="shortcut-option-group mb-5">
          <h4 className="option-title text-base font-medium mb-3">Summarization Shortcut Behavior</h4>
          
          <div className="radio-group-setting ml-4 space-y-3">
            <div className="radio-option flex items-center">
              <input
                type="radio"
                id="page-summarize"
                name="summarize-behavior"
                checked={settings.summarization_behavior === 'page'}
                onChange={() => updateSettings({ summarization_behavior: 'page' })}
                className="mr-2"
                disabled={isSaving}
              />
              <label htmlFor="page-summarize" className="cursor-pointer">
                Summarize entire page
              </label>
            </div>
            
            <div className="radio-option flex items-center">
              <input
                type="radio"
                id="selection-summarize"
                name="summarize-behavior"
                checked={settings.summarization_behavior === 'selection'}
                onChange={() => updateSettings({ summarization_behavior: 'selection' })}
                className="mr-2"
                disabled={isSaving}
              />
              <label htmlFor="selection-summarize" className="cursor-pointer">
                Summarize selected text (if no selection, falls back to page)
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shortcuts;