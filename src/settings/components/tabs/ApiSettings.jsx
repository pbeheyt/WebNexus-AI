import React from 'react';

import PlatformSidebar from '../ui/api/PlatformSidebar';
import PlatformDetails from '../ui/api/PlatformDetails';
import { useApiSettings } from '../../contexts/ApiSettingsContext';
import { STORAGE_KEYS } from '../../../shared/constants';

const ApiSettings = () => {
  const {
    platformConfigs,
    allCredentials,
    selectedPlatformId,
    isLoading,
    error: contextError,
    selectedPlatformConfig,
    credentialsForSelectedPlatform,
    advancedSettingsForSelectedPlatform,
    selectPlatform,
    saveApiKey,
    removeApiKey,
    saveAdvancedModelSettings,
    resetAdvancedModelSettingsToDefaults,
  } = useApiSettings();

  if (isLoading) {
    return (
      <div className='text-center p-10 text-theme-secondary select-none'>
        Loading API settings...
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
      <h2 className='type-heading mb-4 pb-3 border-b border-theme text-lg font-medium select-none'>
        API Settings
      </h2>
      <p className='section-description text-sm text-theme-secondary mb-6 select-none'>
        Configure API credentials for different AI platforms and customize
        advanced settings for each model. These settings will be used when
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
            advancedSettingsForPlatform={advancedSettingsForSelectedPlatform}
            // Pass action handlers from context
            saveApiKeyAction={saveApiKey}
            removeApiKeyAction={removeApiKey}
            saveAdvancedModelSettingsAction={saveAdvancedModelSettings}
            resetAdvancedModelSettingsToDefaultsAction={
              resetAdvancedModelSettingsToDefaults
            }
            // Still need to pass the original key names for PlatformDetails to interact with storage correctly
            // if it were to do so directly, but now it uses context actions.
            // These might become redundant if PlatformDetails fully relies on context actions.
            // For now, let's keep it as it was used for constructing storage keys.
            credentialsStorageKey={STORAGE_KEYS.API_CREDENTIALS}
            advancedSettingsStorageKey={STORAGE_KEYS.API_ADVANCED_SETTINGS}
          />
        ) : (
          <div className='platform-details-panel flex-1 bg-theme-surface p-8 text-center text-sm text-theme-secondary rounded-lg border border-theme'>
            <p className='select-none'>
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