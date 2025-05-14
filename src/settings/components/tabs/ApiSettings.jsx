import React, { useState } from 'react';

import PlatformSidebar from '../ui/api/PlatformSidebar';
import PlatformDetails from '../ui/api/PlatformDetails';
import { useApiSettings } from '../../contexts/ApiSettingsContext';
import { SpinnerIcon } from '../../../components';

const ApiSettings = () => {
  const [activeApiSubTab, setActiveApiSubTab] = useState('apiKey');

  const {
    platformConfigs,
    allCredentials,
    selectedPlatformId,
    isLoading,
    error: contextError,
    selectedPlatformConfig,
    credentialsForSelectedPlatform,
    modelParametersForSelectedPlatform,
    selectPlatform,
    saveApiKey,
    removeApiKey,
    saveModelParametersSettings,
    resetModelParametersSettingsToDefaults,
  } = useApiSettings();

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[200px] text-theme-secondary select-none'>
        <SpinnerIcon className="w-8 h-8" />
        <span className="ml-2">Loading API settings...</span>
      </div>
    );
  }

  if (contextError) {
    return (
      <div className='text-center p-10 text-error select-none'>
        Error: {contextError}
      </div>
    );
  }

  return (
    <div>
      <h2 className='type-heading mb-4 pb-3 border-b border-theme text-lg font-medium'>
        API Settings
      </h2>
      <p className='section-description text-sm text-theme-secondary mb-6'>
        Configure API credentials for different AI platforms and customize
        model parameters for each model. These settings will be used when
        making API requests directly from the browser extension.
      </p>

      <div className='api-settings-layout flex gap-6'>
        <PlatformSidebar
          platforms={platformConfigs}
          selectedPlatformId={selectedPlatformId}
          credentials={allCredentials}
          onSelectPlatform={selectPlatform}
        />

        {selectedPlatformConfig ? (
          <PlatformDetails
            platform={selectedPlatformConfig}
            credentials={credentialsForSelectedPlatform}
            modelParametersForPlatform={modelParametersForSelectedPlatform}
            // Pass action handlers from context
            saveApiKeyAction={saveApiKey}
            removeApiKeyAction={removeApiKey}
            saveModelParametersSettingsAction={saveModelParametersSettings}
            resetModelParametersSettingsToDefaultsAction={
              resetModelParametersSettingsToDefaults
            }
            activeSubTab={activeApiSubTab}
            onSubTabSelect={setActiveApiSubTab}
          />
        ) : (
          <div className='platform-details-panel flex-1 bg-theme-surface p-8 text-center text-sm text-theme-secondary rounded-lg border border-theme'>
            <p className=''>
              {platformConfigs.length > 0
                ? 'Select a platform from the list to configure its API settings.'
                : 'No platforms configured. Check platform-display-config.json and platform-api-config.json.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiSettings;
