import React, { useState, useRef, useMemo } from 'react';

import { Button, useNotification, CustomSelect } from '../../../components';
import userDataService from '../../../services/UserDataService';
import { STORAGE_KEYS } from '../../../shared/constants';
import { logger } from '../../../shared/logger';
import useMinimumLoadingTime from '../../../hooks/useMinimumLoadingTime';

const DATA_MANAGEMENT_OPTIONS = [
  {
    id: 'all',
    name: 'All Settings',
    loadingKeyBase: 'all',
  },
  {
    id: 'prompts',
    name: 'Prompts',
    storageKey: STORAGE_KEYS.PROMPTS,
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
    id: 'model-parameters',
    name: 'Model Parameters',
    storageKey: STORAGE_KEYS.MODEL_PARAMETER_SETTINGS,
    fileTypeName: 'ModelParameters',
    loadingKeyBase: 'model-parameters',
  },
];

const DataManagementTab = () => {
  const { success: showSuccessNotification, error: showErrorNotification } =
    useNotification();

  const [selectedDataType, setSelectedDataType] = useState(DATA_MANAGEMENT_OPTIONS[0].id);
  
  // Store actual processing state
  const [isExportingActual, setIsExportingActual] = useState(false);
  const [isImportingActual, setIsImportingActual] = useState(false);

  // Derive UI loading state with minimum duration
  const shouldShowExportLoading = useMinimumLoadingTime(isExportingActual);
  const shouldShowImportLoading = useMinimumLoadingTime(isImportingActual);

  const fileInputRef = useRef(null);
  const currentImportActionDetails = useRef(null);

  const currentOptionObject = useMemo(() => {
    return DATA_MANAGEMENT_OPTIONS.find(opt => opt.id === selectedDataType) || DATA_MANAGEMENT_OPTIONS[0];
  }, [selectedDataType]);

  const executeExport = async () => {
    const { id, storageKey, fileTypeName } = currentOptionObject;
    setIsExportingActual(true);

    let result;
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
    setIsExportingActual(false);
  };

  const triggerImport = () => {
    const { id, storageKey } = currentOptionObject;
    currentImportActionDetails.current = {
        keyForStorage: id === 'all' ? 'all' : storageKey,
        nameForLoading: currentOptionObject.loadingKeyBase
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
    setIsImportingActual(true);

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
            // setIsImportingActual will be set to false by the page reload or timeout if error
        } else {
            showErrorNotification(
            `Import failed for ${currentOptionObject.name}: ${result.error || 'Invalid file or unknown error'}`
            );
            setIsImportingActual(false);
        }
    } catch (err) {
        logger.settings.error(`Import file processing error for ${nameForLoading}:`, err);
        showErrorNotification(`Import failed: ${err.message || 'Error processing file'}`);
        setIsImportingActual(false);
        result = { success: false, error: err.message };
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    currentImportActionDetails.current = null;
  };
  
  const isAnyOperationLoadingForUI = shouldShowExportLoading || shouldShowImportLoading;
  
  const exportButtonLabel = shouldShowExportLoading ? 'Exporting...' : 'Export Settings';
  const importButtonLabel = shouldShowImportLoading ? 'Importing...' : 'Import Settings';
  
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
        disabled={isAnyOperationLoadingForUI}
      />

      <div className='mb-6 p-4 bg-theme-surface border border-theme rounded-lg w-full sm:w-3/4 md:w-2/3 lg:w-1/2'>
        <div className='flex flex-row items-center gap-2'>
            <div className='w-60'> 
                <label htmlFor="data-type-select" className='block text-sm font-medium text-theme-primary mb-2 sr-only'> 
                  Select Data Type to Manage
                </label>
                <CustomSelect
                id="data-type-select"
                options={DATA_MANAGEMENT_OPTIONS.map(opt => ({ id: opt.id, name: opt.name }))}
                selectedValue={selectedDataType}
                onChange={setSelectedDataType}
                disabled={isAnyOperationLoadingForUI}
                />
            </div>
            <div className='flex flex-grow gap-3'>
                <Button
                    onClick={executeExport}
                    disabled={isAnyOperationLoadingForUI}
                    isLoading={shouldShowExportLoading}
                    variant='secondary'
                    className='flex-1'
                >
                    {exportButtonLabel}
                </Button>
                <Button
                    onClick={triggerImport}
                    disabled={isAnyOperationLoadingForUI}
                    isLoading={shouldShowImportLoading}
                    variant='secondary'
                    className='flex-1'
                >
                    {importButtonLabel}
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DataManagementTab;