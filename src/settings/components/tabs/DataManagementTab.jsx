import React, { useState, useRef, useMemo } from 'react';

import { Button, useNotification, CustomSelect, ChevronDownIcon } from '../../../components';
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
  const [openSection, setOpenSection] = useState('export'); // Default 'export' section to be open
  
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

  const toggleSection = (sectionName) => {
    setOpenSection(prevOpenSection => prevOpenSection === sectionName ? null : sectionName);
  };

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

      <div className='mb-6 w-full sm:w-3/4 md:w-2/3 lg:w-1/2'>
        <label htmlFor="data-type-select" className='block text-sm font-medium text-theme-primary mb-2'>
          Select Data Type to Manage:
        </label>
        <CustomSelect
          id="data-type-select"
          options={DATA_MANAGEMENT_OPTIONS.map(opt => ({ id: opt.id, name: opt.name }))}
          selectedValue={selectedDataType}
          onChange={setSelectedDataType}
          disabled={isAnyOperationLoadingForUI}
          className="mb-6"
        />
      </div>

      {/* Export Section */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => toggleSection('export')}
          className="flex justify-between items-center w-full p-4 bg-theme-surface hover:bg-theme-hover border border-theme rounded-lg text-left text-lg font-medium text-theme-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={openSection === 'export'}
          aria-controls="export-content"
        >
          <span>Export Settings</span>
          <ChevronDownIcon className={'w-5 h-5 transition-transform ' + (openSection === 'export' ? 'transform rotate-180' : '')} />
        </button>
        {openSection === 'export' && (
          <div id="export-content" className="p-4 pt-2 border border-t-0 border-theme rounded-b-lg -mt-1"> {/* Adjusted mt to align better */}
            <p className="text-sm text-theme-secondary mb-4">Export the selected data type (<strong>{currentOptionObject.name}</strong>) to a JSON file. This file can be used later to import these settings.</p>
            <Button
                onClick={executeExport}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowExportLoading}
                loadingText='Exporting...'
                variant='secondary'
            >
                {shouldShowExportLoading ? 'Exporting...' : `Export ${currentOptionObject.name}`}
            </Button>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => toggleSection('import')}
          className="flex justify-between items-center w-full p-4 bg-theme-surface hover:bg-theme-hover border border-theme rounded-lg text-left text-lg font-medium text-theme-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={openSection === 'import'}
          aria-controls="import-content"
        >
          <span>Import Settings</span>
          <ChevronDownIcon className={'w-5 h-5 transition-transform ' + (openSection === 'import' ? 'transform rotate-180' : '')} />
        </button>
        {openSection === 'import' && (
          <div id="import-content" className="p-4 pt-2 border border-t-0 border-theme rounded-b-lg -mt-1">
            <p className="text-sm text-theme-secondary mb-4">Import settings from a JSON file for the selected data type (<strong>{currentOptionObject.name}</strong>). This will <strong className="font-semibold">overwrite any existing settings</strong> for this specific data type. The page will reload automatically after a successful import.</p>
            <Button
                onClick={triggerImport}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowImportLoading}
                loadingText='Importing...'
                variant='secondary'
            >
                {shouldShowImportLoading ? 'Importing...' : `Import ${currentOptionObject.name}`}
            </Button>
          </div>
        )}
      </div>

      {/* Reset Section */}
      <div> {/* Removed mb-3 for the last item to maintain consistent bottom spacing with the tab content area */}
        <button
          type="button"
          onClick={() => toggleSection('reset')}
          className="flex justify-between items-center w-full p-4 bg-theme-surface hover:bg-theme-hover border border-theme rounded-lg text-left text-lg font-medium text-theme-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={openSection === 'reset'}
          aria-controls="reset-content"
        >
          <span>Reset Settings</span>
          <ChevronDownIcon className={'w-5 h-5 transition-transform ' + (openSection === 'reset' ? 'transform rotate-180' : '')} />
        </button>
        {openSection === 'reset' && (
          <div id="reset-content" className="p-4 pt-2 border border-t-0 border-theme rounded-b-lg -mt-1">
            <p className="text-sm text-red-600 dark:text-red-400 mb-1"><strong className="font-semibold">Warning:</strong> This action cannot be undone.</p>
            <p className="text-sm text-theme-secondary mb-4">Reset settings for the selected data type (<strong>{currentOptionObject.name}</strong>) to their original defaults. The page will reload automatically.</p>
            <Button
                onClick={executeReset}
                disabled={isAnyOperationLoadingForUI}
                isLoading={shouldShowResetLoading}
                loadingText='Resetting...'
                variant='danger'
            >
                {shouldShowResetLoading ? 'Resetting...' : `Reset ${currentOptionObject.name}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataManagementTab;
