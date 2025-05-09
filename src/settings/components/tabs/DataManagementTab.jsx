// src/settings/components/tabs/DataManagementTab.jsx
import React, { useState, useRef } from 'react';

import { Button, useNotification } from '../../../components';
import userDataService from '../../../services/UserDataService';
import { STORAGE_KEYS } from '../../../shared/constants';

const DataManagementTab = () => {
  const { success: showSuccessNotification, error: showErrorNotification } =
    useNotification();

  const [loadingStates, setLoadingStates] = useState({
    exportAll: false,
    importAll: false,
    exportPrompts: false,
    importPrompts: false,
    exportCredentials: false,
    importCredentials: false,
    exportAdvanced: false,
    importAdvanced: false,
  });

  const fileInputRef = useRef(null);
  const currentImportKey = useRef(null); // To know which single import is active
  const currentImportName = useRef(null); // For single import file type name

  const updateLoadingState = (key, isLoading) => {
    setLoadingStates((prev) => ({ ...prev, [key]: isLoading }));
  };

  const handleExport = async (exportFunction, loadingKey, successMessage, failureMessage) => {
    updateLoadingState(loadingKey, true);
    const result = await exportFunction();
    if (result.success) {
      showSuccessNotification(successMessage);
    } else {
      showErrorNotification(`${failureMessage}: ${result.error || 'Unknown error'}`);
    }
    updateLoadingState(loadingKey, false);
  };

  const handleImportFileSelect = async (event) => {
    const file = event.target.files[0];
    const importType = currentImportKey.current; // 'all' or a specific STORAGE_KEYS
    const loadingKey = importType === 'all' ? 'importAll' : `import${currentImportName.current}`;
    
    if (file && importType) {
      updateLoadingState(loadingKey, true);
      let result;
      if (importType === 'all') {
        result = await userDataService.importAllSettings(file);
      } else {
        result = await userDataService.importSingleSetting(importType, file);
      }

      if (result.success) {
        showSuccessNotification(
          'Settings imported successfully! Page will now reload.'
        );
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showErrorNotification(
          `Import failed: ${result.error || 'Invalid file or unknown error'}`
        );
        updateLoadingState(loadingKey, false);
      }
      // Reset file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    currentImportKey.current = null; // Reset after use
    currentImportName.current = null;
  };

  const triggerImportDialog = (importKey, importName = null) => {
    currentImportKey.current = importKey;
    currentImportName.current = importName; // e.g., 'Prompts', 'Credentials'
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderSection = (title, exportHandler, importTrigger, description, exportLoadingKey, importLoadingKey) => (
    <div className='mb-6 p-4 bg-theme-surface border border-theme rounded-lg'>
      <h3 className='text-lg font-medium text-theme-primary mb-2'>{title}</h3>
      <p className='text-xs text-theme-secondary mb-3'>{description}</p>
      <div className='flex flex-col sm:flex-row gap-3'>
        <Button
          onClick={exportHandler}
          disabled={Object.values(loadingStates).some(Boolean)}
          variant='secondary'
          className='flex-1 sm:flex-none'
        >
          {loadingStates[exportLoadingKey] ? 'Exporting...' : `Export ${title}`}
        </Button>
        <Button
          onClick={importTrigger}
          disabled={Object.values(loadingStates).some(Boolean)}
          variant='secondary'
          className='flex-1 sm:flex-none'
        >
          {loadingStates[importLoadingKey] ? 'Importing...' : `Import ${title}`}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className='type-heading mb-4 pb-3 border-b border-theme text-lg font-medium select-none'>
        Data Management
      </h2>
      <p className='section-description text-sm text-theme-secondary mb-6 select-none'>
        Export or import your extension settings. Importing will overwrite existing data for the selected category.
      </p>

      <input
        type='file'
        ref={fileInputRef}
        accept='.json'
        onChange={handleImportFileSelect}
        style={{ display: 'none' }}
        disabled={Object.values(loadingStates).some(Boolean)}
      />

        {renderSection(
          "All Settings",
          () => handleExport(() => userDataService.exportAllSettings(), 'exportAll', 'All settings exported!', 'Export failed'),
          () => triggerImportDialog('all'),
          "Includes Prompts, API Credentials, and Advanced Model Settings.",
          'exportAll',
          'importAll'
        )}

      {renderSection(
        "Prompts",
        () => handleExport(() => userDataService.exportSingleSetting(STORAGE_KEYS.CUSTOM_PROMPTS, 'Prompts'), 'exportPrompts', 'Prompts exported!', 'Prompt export failed'),
        () => triggerImportDialog(STORAGE_KEYS.CUSTOM_PROMPTS, 'Prompts'),
        "Manages only your custom prompts.",
        'exportPrompts',
        'importPrompts'
      )}

      {renderSection(
        "API Credentials",
        () => handleExport(() => userDataService.exportSingleSetting(STORAGE_KEYS.API_CREDENTIALS, 'Credentials'), 'exportCredentials', 'API Credentials exported!', 'Credential export failed'),
        () => triggerImportDialog(STORAGE_KEYS.API_CREDENTIALS, 'Credentials'),
        "Manages only your stored API keys.",
        'exportCredentials',
        'importCredentials'
      )}

      {renderSection(
        "Advanced Settings",
        () => handleExport(() => userDataService.exportSingleSetting(STORAGE_KEYS.API_ADVANCED_SETTINGS, 'AdvancedSettings'), 'exportAdvanced', 'Advanced Settings exported!', 'Advanced settings export failed'),
        () => triggerImportDialog(STORAGE_KEYS.API_ADVANCED_SETTINGS, 'AdvancedSettings'),
        "Manages only your customized model parameters for APIs.",
        'exportAdvanced',
        'importAdvanced'
      )}
    </div>
  );
};

export default DataManagementTab;
