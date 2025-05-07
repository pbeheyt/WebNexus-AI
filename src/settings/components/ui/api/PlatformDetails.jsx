// src/settings/components/ui/platforms/PlatformDetails.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Button, useNotification, PlatformIcon } from '../../../../components';
import { logger } from '../../../../shared/logger';

import AdvancedSettings from './AdvancedSettings';

const PlatformDetails = ({
  platform,
  credentials,
  advancedSettingsForPlatform,
  saveApiKeyAction,
  removeApiKeyAction,
  saveAdvancedModelSettingsAction,
  resetAdvancedModelSettingsToDefaultsAction,
}) => {
  const { error } = useNotification();
  const [apiKey, setApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [hasApiKeyChanges, setHasApiKeyChanges] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(
    platform.apiConfig?.models?.length > 0
      ? platform.apiConfig.models[0].id
      : 'default' // Should ideally not be 'default' if models exist
  );

  // Synchronize API key state and selectedModelId when platform or its related props change
  useEffect(() => {
    if (credentials?.apiKey) {
      setApiKey(credentials.apiKey);
      setOriginalApiKey(credentials.apiKey);
    } else {
      setApiKey('');
      setOriginalApiKey('');
    }
    setHasApiKeyChanges(false); // Reset on platform/credential change

    // Reset selected model to the first available for the new platform
    const firstModelId = platform.apiConfig?.models?.[0]?.id;
    if (firstModelId) {
      setSelectedModelId(firstModelId);
    } else {
      // Fallback if no models are defined for the platform or if models array is empty.
      setSelectedModelId(platform.apiConfig?.defaultModel || 'default');
      logger.settings.warn(`PlatformDetails: Platform ${platform.id} has no models or defaultModel defined in apiConfig. Falling back selectedModelId.`);
    }
  }, [platform.id, platform.apiConfig, credentials]);


  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    setHasApiKeyChanges(newApiKey !== originalApiKey);
  };

  const handleSaveCredentials = async () => {
    if (!apiKey.trim()) {
      error('API Key is required.');
      return;
    }
    setIsSavingApiKey(true);
    const success = await saveApiKeyAction(platform.id, apiKey);
    if (success) {
      setOriginalApiKey(apiKey);
      setHasApiKeyChanges(false);
    }
    setIsSavingApiKey(false);
  };

  const handleRemoveCredentials = async () => {
    if (
      !window.confirm(
        `Are you sure you want to remove the API key for ${platform.name}?`
      )
    ) {
      return;
    }
    const success = await removeApiKeyAction(platform.id);
    if (success) {
      setApiKey('');
      setOriginalApiKey('');
      setHasApiKeyChanges(false);
    }
  };

  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
  };

  return (
    <div className='platform-details-panel flex-1'>
      {/* Platform header */}
      <div className='platform-header flex items-center mb-6'>
        {platform.iconUrl ? (
          <PlatformIcon
            platformId={platform.id}
            iconUrl={platform.iconUrl}
            altText={platform.name}
            className='platform-icon-large w-12 h-12 mr-6 flex-shrink-0'
          />
        ) : (
          <div className='platform-icon-placeholder-large w-12 h-12 mr-6 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold flex-shrink-0'>
            {platform.name.charAt(0)}
          </div>
        )}

        <div className='platform-header-info min-w-0'>
          <h3 className='platform-title text-xl font-medium mb-2 text-theme-primary truncate select-none'>
            {platform.name}
          </h3>
          <div className='platform-actions flex flex-wrap gap-x-3 gap-y-1'>
            <a
              href={platform.consoleApiLink}
              target='_blank'
              rel='noopener noreferrer'
              className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'
            >
              API Console
            </a>
            <a
              href={platform.docApiLink}
              target='_blank'
              rel='noopener noreferrer'
              className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'
            >
              API Documentation
            </a>
            <a
              href={platform.modelApiLink}
              target='_blank'
              rel='noopener noreferrer'
              className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'
            >
              Model Documentation
            </a>
            <a
              href={platform.keyApiLink}
              target='_blank'
              rel='noopener noreferrer'
              className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'
            >
              API Keys
            </a>
          </div>
        </div>
      </div>

      {/* API credentials section */}
      <div className='settings-section bg-theme-surface p-5 rounded-lg border border-theme mb-6'>
        <h4 className='section-subtitle text-lg font-medium mb-4 text-theme-primary select-none'>
          API Credentials
        </h4>

        <div className='form-group mb-4'>
          <label
            htmlFor={`${platform.id}-api-key`}
            className='block mb-2 text-sm font-medium text-theme-secondary select-none'
          >
            API Key:
          </label>
          <div className='relative flex items-center'>
            <input
              type={showApiKey ? 'text' : 'password'}
              id={`${platform.id}-api-key`}
              className='api-key-input w-full p-2 pr-16 bg-gray-50 dark:bg-gray-700 text-theme-primary border border-theme rounded-md font-mono focus:ring-primary focus:border-primary'
              placeholder={
                credentials?.apiKey
                  ? '••••••••••••••••••••••••••'
                  : 'Enter your API key'
              }
              value={apiKey}
              onChange={handleApiKeyChange}
              disabled={isSavingApiKey}
            />
            <button
              type='button'
              className='show-key-toggle absolute right-2 px-2 py-1 text-primary hover:text-primary-hover bg-transparent rounded select-none'
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              disabled={isSavingApiKey}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className='form-actions flex justify-end gap-3'>
          {credentials && (
            <Button
              variant='danger'
              onClick={handleRemoveCredentials}
              className='select-none'
              disabled={isSavingApiKey}
            >
              Remove Key
            </Button>
          )}

          <Button
            onClick={handleSaveCredentials}
            disabled={isSavingApiKey || !hasApiKeyChanges}
            variant={!hasApiKeyChanges ? 'inactive' : 'primary'}
            className='select-none'
          >
            {isSavingApiKey
              ? 'Saving...'
              : credentials
                ? 'Update Key'
                : 'Save Key'}
          </Button>
        </div>
      </div>

      {/* Advanced settings section */}
<AdvancedSettings
  platform={platform}
  selectedModelId={selectedModelId}
  advancedSettingsForPlatform={advancedSettingsForPlatform}
  onModelSelect={handleModelSelect}
  onSettingsUpdate={saveAdvancedModelSettingsAction}
  onResetToDefaults={resetAdvancedModelSettingsToDefaultsAction}
/>
    </div>
  );
};

PlatformDetails.propTypes = {
  platform: PropTypes.object.isRequired,
  credentials: PropTypes.object, // Can be null if not set
  advancedSettingsForPlatform: PropTypes.object, // Can be empty {} if not set
  saveApiKeyAction: PropTypes.func.isRequired,
  removeApiKeyAction: PropTypes.func.isRequired,
  saveAdvancedModelSettingsAction: PropTypes.func.isRequired,
  resetAdvancedModelSettingsToDefaultsAction: PropTypes.func.isRequired,
};

export default React.memo(PlatformDetails);
