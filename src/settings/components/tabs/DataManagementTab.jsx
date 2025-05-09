// src/settings/components/tabs/DataManagementTab.jsx
import React, { useState, useRef, useMemo } from 'react';

import { Button, useNotification, CustomSelect } from '../../../components';
import userDataService from '../../../services/UserDataService';
import { STORAGE_KEYS } from '../../../shared/constants';
import { logger } from '../../../shared/logger';

const DATA_MANAGEMENT_OPTIONS = [
  {
    id: 'all',
    name: 'All Settings',
    loadingKeyBase: 'all',
  },
  {
    id: 'prompts',
    name: 'Prompts',
    storageKey: STORAGE_KEYS.CUSTOM_PROMPTS,
    fileTypeName: 'Prompts',
    loadingKeyBase: 'prompts',
  },
  {
    id: 'credentials',
    name: 'API Credentials',
    storageKey: STORAGE_KEYS.API_CREDENTIALS,
    fileTypeName: 'Credentials',
    loadingKeyBase: 'credentials',
  },
  {
    id: 'advancedSettings',
    name: 'Model Settings',
    storageKey: STORAGE_KEYS.API_ADVANCED_SETTINGS,
    fileTypeName: 'AdvancedSettings',
    loadingKeyBase: 'advanced',
  },
];

const DataManagementTab = () => {
  const { success: showSuccessNotification, error: showErrorNotification } =
    useNotification();

  const [selectedDataType, setSelectedDataType] = useState(DATA_MANAGEMENT_OPTIONS[0].id); // Default to 'all'
  const [loadingStates, setLoadingStates] = useState({});

  const fileInputRef = useRef(null);
  const currentImportActionDetails = useRef(null);

  const updateLoadingState = (actionType, dataTypeBase, isLoading) => {
    const key = `${actionType}-${dataTypeBase}`;
    setLoadingStates((prev) => ({ ...prev, [key]: isLoading }));
  };

  const currentOptionObject = useMemo(() => {
    return DATA_MANAGEMENT_OPTIONS.find(opt => opt.id === selectedDataType) || DATA_MANAGEMENT_OPTIONS[0];
  }, [selectedDataType]);


  const executeExport = async () => {
    const { id, storageKey, fileTypeName, loadingKeyBase } = currentOptionObject;
    updateLoadingState('export', loadingKeyBase, true);

    let result;
    // Notification messages will still be dynamic based on the selection for clarity
    let successMsg = `${currentOptionObject.name} exported successfully!`;
    let failureMsg = `${currentOptionObject.name} export failed`;

    try {
      if (id === 'all') {
        result = await userDataService.exportAllSettings();
      } else {
        result = await userDataService.exportSingleSetting(storageKey, fileTypeName);
      }

      if (result.success) {
        showSuccessNotification(successMsg);
      } else {
        showErrorNotification(`${failureMsg}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
        logger.settings.error(`Export error for ${id}:`, err);
        showErrorNotification(`${failureMsg}: ${err.message || 'Unexpected error during export'}`);
        result = { success: false, error: err.message };
    }
    updateLoadingState('export', loadingKeyBase, false);
  };

  const triggerImport = () => {
    const { id, storageKey, loadingKeyBase } = currentOptionObject;
    currentImportActionDetails.current = {
        keyForStorage: id === 'all' ? 'all' : storageKey,
        nameForLoading: loadingKeyBase
    };
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelectedForImport = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentImportActionDetails.current) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { keyForStorage, nameForLoading } = currentImportActionDetails.current;
    updateLoadingState('import', nameForLoading, true);

    let result;
    try {
        if (keyForStorage === 'all') {
            result = await userDataService.importAllSettings(file);
        } else {
            result = await userDataService.importSingleSetting(keyForStorage, file);
        }

        if (result.success) {
            showSuccessNotification(
            `${currentOptionObject.name} imported successfully! Page will now reload.`
            );
            setTimeout(() => {
            window.location.reload();
            }, 1500);
        } else {
            showErrorNotification(
            `Import failed for ${currentOptionObject.name}: ${result.error || 'Invalid file or unknown error'}`
            );
            updateLoadingState('import', nameForLoading, false);
        }
    } catch (err) {
        logger.settings.error(`Import file processing error for ${nameForLoading}:`, err);
        showErrorNotification(`Import failed: ${err.message || 'Error processing file'}`);
        updateLoadingState('import', nameForLoading, false);
        result = { success: false, error: err.message };
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    currentImportActionDetails.current = null;
  };
  
  const isAnyOperationLoading = Object.values(loadingStates).some(Boolean);
  // Static button labels
  const exportButtonLabel = 'Export';
  const importButtonLabel = 'Import';
  
  // Loading keys are still dynamic to show specific loading state
  const exportLoadingKey = `export-${currentOptionObject.loadingKeyBase}`;
  const importLoadingKey = `import-${currentOptionObject.loadingKeyBase}`;

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
        onChange={handleFileSelectedForImport}
        style={{ display: 'none' }}
        disabled={isAnyOperationLoading}
      />

      {/* This container is now w-1/2 */}
      <div className='mb-6 p-4 bg-theme-surface border border-theme rounded-lg w-full sm:w-2/3 md:w-1/2 lg:w-1/3'>
        <div className='flex flex-row items-center gap-4'>
            {/* This div for CustomSelect has flex-grow, so it takes available space */}
            <div className='flex-grow w-full'>
                <label htmlFor="data-type-select" className='block text-sm font-medium text-theme-primary mb-2 sr-only'> 
                  {/* Screen reader only label as visual is clear */}
                  Select Data Type to Manage
                </label>
                <CustomSelect
                id="data-type-select"
                options={DATA_MANAGEMENT_OPTIONS.map(opt => ({ id: opt.id, name: opt.name }))}
                selectedValue={selectedDataType}
                onChange={setSelectedDataType}
                disabled={isAnyOperationLoading}
                />
            </div>
            <div className='flex gap-3 w-full ml-auto'>
                <Button
                    onClick={executeExport}
                    disabled={isAnyOperationLoading || loadingStates[exportLoadingKey]}
                    variant='secondary'
                    className='flex-1' // Allow buttons to take available space
                >
                    {loadingStates[exportLoadingKey] ? 'Exporting...' : exportButtonLabel}
                </Button>
                <Button
                    onClick={triggerImport}
                    disabled={isAnyOperationLoading || loadingStates[importLoadingKey]}
                    variant='secondary'
                    className='flex-1' // Allow buttons to take available space
                >
                    {loadingStates[importLoadingKey] ? 'Importing...' : importButtonLabel}
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DataManagementTab;