import React, { useState, useRef, useMemo } from 'react';

import { Button, useNotification, CustomSelect } from '../../../components';
import userDataService from '../../../services/UserDataService';
import { STORAGE_KEYS } from '../../../shared/constants';
import { logger } from '../../../shared/logger';
import useMinimumLoadingTime from '../../../hooks/useMinimumLoadingTime';
import SelectorSection from '../ui/common/SelectorSection';

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
     const [isExportingActual, setIsExportingActual] = useState(false);
  const [isImportingActual, setIsImportingActual] = useState(false);
  const [isResettingActual, setIsResettingActual] = useState(false);

  const shouldShowExportLoading = useMinimumLoadingTime(isExportingActual);
  const shouldShowImportLoading = useMinimumLoadingTime(isImportingActual);
  const shouldShowResetLoading = useMinimumLoadingTime(isResettingActual);

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
  
  const isAnyOperationLoadingForUI = shouldShowExportLoading || shouldShowImportLoading || shouldShowResetLoading;
  
  const executeReset = async () => {
    const { name: dataTypeName, id: dataTypeId } = currentOptionObject;
    const confirmationMessage = `Are you sure you want to reset ${dataTypeName.toLowerCase()} settings? This action cannot be undone and will reload the page.`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsResettingActual(true);
    try {
      const result = await userDataService.resetSelectedSettings(dataTypeId);

      if (result.success) {
        showSuccessNotification(
          `${dataTypeName} settings reset and repopulated successfully! Page will now reload.`
        );
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showErrorNotification(
          `Reset failed for ${dataTypeName}: ${result.error || 'Unknown error during reset process.'}`
        );
        setIsResettingActual(false); 
      }
    } catch (err) {
      logger.settings.error(`Reset error for ${dataTypeName} in component:`, err);
      showErrorNotification(
        `Reset failed: ${err.message || 'Unexpected error during reset operation.'}`
      );
      setIsResettingActual(false);
    }
  };
  
  return (
    <div>
      <h2 className='type-heading mb-4 pb-3 border-b border-theme text-lg font-medium select-none'>
        Data Management
      </h2>
      <p className='section-description text-sm text-theme-secondary mb-6 select-none'>
        Manage your extension settings. Select a data type, then choose an action.
      </p>

      <input
        type='file'
        ref={fileInputRef}
        accept='.json'
        onChange={handleFileSelectedForImport}
        style={{ display: 'none' }}
        disabled={isAnyOperationLoadingForUI}
      />

      <div className='w-full sm:w-3/4 md:w-2/3 lg:w-1/2'>
        <SelectorSection title='Select Data Type to Manage:'>
          <CustomSelect
            id="data-type-select"
            options={DATA_MANAGEMENT_OPTIONS.map(opt => ({ id: opt.id, name: opt.name }))}
            selectedValue={selectedDataType}
            onChange={setSelectedDataType}
            disabled={isAnyOperationLoadingForUI}
            // className="mb-6" // Removed mb-6 as SelectorSection handles it
          />
        </SelectorSection>
      </div>

      {/* Action Groups Container */}
      <div className="space-y-6">

        {/* Export Settings Group */}
        <div className="p-5 bg-theme-surface border border-theme rounded-lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex-grow">
              <h3 className="text-lg font-medium text-theme-primary mb-1">Export Settings</h3>
              <p className="text-sm text-theme-secondary mb-3 md:mb-0">
                Export the selected data type (<strong>{currentOptionObject.name}</strong>) to a JSON file. This file can be used later to import these settings.
              </p>
            </div>
            <div className="flex-shrink-0 md:ml-4">
              <Button
                onClick={executeExport}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowExportLoading}
                loadingText='Exporting...'
                variant='secondary'
                className="w-full md:w-auto"
              >
                {shouldShowExportLoading ? 'Exporting...' : `Export ${currentOptionObject.name}`}
              </Button>
            </div>
          </div>
        </div>

        {/* Import Settings Group */}
        <div className="p-5 bg-theme-surface border border-theme rounded-lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex-grow">
              <h3 className="text-lg font-medium text-theme-primary mb-1">Import Settings</h3>
              <p className="text-sm text-theme-secondary mb-3 md:mb-0">
                Import settings from a JSON file for <strong>{currentOptionObject.name}</strong>. This will <strong className="font-semibold">overwrite existing settings</strong> for this data type. The page will reload after a successful import.
              </p>
            </div>
            <div className="flex-shrink-0 md:ml-4">
              <Button
                onClick={triggerImport}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowImportLoading}
                loadingText='Importing...'
                variant='secondary'
                className="w-full md:w-auto"
              >
                {shouldShowImportLoading ? 'Importing...' : `Import ${currentOptionObject.name}`}
              </Button>
            </div>
          </div>
        </div>

        {/* Reset Settings Group */}
        <div className="p-5 bg-theme-surface border border-theme rounded-lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex-grow">
              <h3 className="text-lg font-medium text-theme-primary mb-1">Reset Settings</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-1"><strong className="font-semibold">Warning:</strong> This action cannot be undone.</p>
              <p className="text-sm text-theme-secondary mb-3 md:mb-0">
                Reset settings for <strong>{currentOptionObject.name}</strong> to their original defaults. The page will reload automatically.
              </p>
            </div>
            <div className="flex-shrink-0 md:ml-4">
              <Button
                onClick={executeReset}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowResetLoading}
                loadingText='Resetting...'
                variant='danger'
                className="w-full md:w-auto"
              >
                {shouldShowResetLoading ? 'Resetting...' : `Reset ${currentOptionObject.name}`}
              </Button>
            </div>
          </div>
        </div>

      </div> {/* End of Action Groups Container */}
    </div>
  );
};

export default DataManagementTab;
