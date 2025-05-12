// src/settings/components/ui/platforms/PlatformDetails.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Button, useNotification, PlatformIcon } from '../../../../components';
import SettingsCard from '../common/SettingsCard';
import SubTabLayout from '../common/SubTabLayout';
import { logger } from '../../../../shared/logger';
import useMinimumLoadingTime from '../../../../hooks/useMinimumLoadingTime';

import ModelParametersSettings from './ModelParametersSettings';

const PlatformDetails = ({
  platform,
  credentials,
  modelParametersForPlatform,
  saveApiKeyAction,
  removeApiKeyAction,
  saveModelParametersSettingsAction,
  resetModelParametersSettingsToDefaultsAction,
  activeSubTab,
  onSubTabSelect,
}) => {
  const { error } = useNotification();
  const [apiKey, setApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [hasApiKeyChanges, setHasApiKeyChanges] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [isSavingApiKeyActual, setIsSavingApiKeyActual] = useState(false);
  const [isRemovingApiKeyActual, setIsRemovingApiKeyActual] = useState(false);
  const shouldShowApiKeySaving = useMinimumLoadingTime(isSavingApiKeyActual, 1000);
  const subTabs = [
    { id: 'apiKey', label: 'API Key' },
    { id: 'modelParams', label: 'Model Parameters' },
  ];
  
  const [selectedModelId, setSelectedModelId] = useState(
    platform.apiConfig?.models?.length > 0
      ? platform.apiConfig.models[0].id
      : 'default'
  );

  useEffect(() => {
    if (credentials?.apiKey) {
      setApiKey(credentials.apiKey);
      setOriginalApiKey(credentials.apiKey);
    } else {
      setApiKey('');
      setOriginalApiKey('');
    }
    setHasApiKeyChanges(false);

    const firstModelId = platform.apiConfig?.models?.[0]?.id;
    if (firstModelId) {
      setSelectedModelId(firstModelId);
    } else {
      const fallbackModelId = platform.apiConfig?.defaultModel || 'default';
      logger.settings.warn(`PlatformDetails: Platform ${platform.id} has no models or defaultModel defined in apiConfig. Falling back selectedModelId to: ${fallbackModelId}`);
      setSelectedModelId(fallbackModelId);
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
    setIsSavingApiKeyActual(true);
    const success = await saveApiKeyAction(platform.id, apiKey);
    if (success) {
      setOriginalApiKey(apiKey);
      setHasApiKeyChanges(false);
    }
    setIsSavingApiKeyActual(false);
  };

  const handleRemoveCredentials = async () => {
    if (
      !window.confirm(
        `Are you sure you want to remove the API key for ${platform.name}?`
      )
    ) {
      return;
    }
    setIsRemovingApiKeyActual(true);
    const success = await removeApiKeyAction(platform.id);
    if (success) {
      setApiKey('');
      setOriginalApiKey('');
      setHasApiKeyChanges(false);
    }
    setIsRemovingApiKeyActual(false);
  };

  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
  };

  return (
    <div className='platform-details-panel flex-1'>
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
            <a href={platform.consoleApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'>API Console</a>
            <a href={platform.docApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'>API Documentation</a>
            <a href={platform.modelApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'>Model Documentation</a>
            <a href={platform.keyApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer select-none'>API Keys</a>
          </div>
        </div>
      </div>

      <SubTabLayout
        tabs={subTabs}
        activeTabId={activeSubTab}
        onTabSelect={onSubTabSelect}
        className="mt-2"
      >
        {(currentActiveSubTab) => {
          if (currentActiveSubTab === 'apiKey') {
            return (
              <SettingsCard className='settings-section'>
                <h4 className='section-subtitle text-base font-semibold mb-4 text-theme-primary select-none'>
                  API Credentials
                </h4>
                <div className='form-group mb-4'>
                  <label htmlFor={`${platform.id}-api-key`} className='block mb-2 text-sm text-theme-secondary select-none'>API Key</label>
                  <div className='relative flex items-center'>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id={`${platform.id}-api-key`}
                      className='api-key-input w-full p-2 pr-16 bg-theme-hover text-theme-primary border border-theme rounded-md font-mono focus:ring-primary focus:border-primary'
                      placeholder={credentials?.apiKey ? '••••••••••••••••••••••••••' : 'Enter your API key'}
                      value={apiKey}
                      onChange={handleApiKeyChange}
                      disabled={shouldShowApiKeySaving}
                    />
                    <button
                      type='button'
                      className='show-key-toggle absolute right-2 px-2 py-1 text-primary hover:text-primary-hover bg-transparent rounded select-none'
                      onClick={() => setShowApiKey(!showApiKey)}
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      disabled={shouldShowApiKeySaving}
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
                      isLoading={isRemovingApiKeyActual}
                      loadingText="Removing..."
                      disabled={
                        isRemovingApiKeyActual ||
                        shouldShowApiKeySaving ||
                        !credentials
                      }
                    >
                      Remove Key
                    </Button>
                  )}
                  <Button
                    onClick={handleSaveCredentials}
                    isLoading={shouldShowApiKeySaving}
                    loadingText="Saving..."
                    disabled={
                      shouldShowApiKeySaving ||
                      isRemovingApiKeyActual ||
                      (!isSavingApiKeyActual &&
                        ((credentials && !hasApiKeyChanges) ||
                        (!credentials && !apiKey.trim())))
                    }
                    variant={
                      (isRemovingApiKeyActual ||
                      (!shouldShowApiKeySaving &&
                        !isSavingApiKeyActual &&
                        ((credentials && !hasApiKeyChanges) ||
                        (!credentials && !apiKey.trim()))))
                      ? 'inactive'
                      : 'primary'
                    }
                    className='select-none'
                  >
                    {(credentials ? 'Update Key' : 'Save Key')}
                  </Button>
                </div>
              </SettingsCard>
            );
          }
          if (currentActiveSubTab === 'modelParams') {
            return (
              <ModelParametersSettings
                platform={platform}
                selectedModelId={selectedModelId}
                modelParametersSettings={modelParametersForPlatform}
                onModelSelect={handleModelSelect}
                onSettingsUpdate={saveModelParametersSettingsAction}
                onResetToDefaults={resetModelParametersSettingsToDefaultsAction}
              />
            );
          }
          return null;
        }}
      </SubTabLayout>
    </div>
  );
};

PlatformDetails.propTypes = {
  platform: PropTypes.object.isRequired,
  credentials: PropTypes.object,
  modelParametersForPlatform: PropTypes.object,
  saveApiKeyAction: PropTypes.func.isRequired,
  removeApiKeyAction: PropTypes.func.isRequired,
  saveModelParametersSettingsAction: PropTypes.func.isRequired,
  resetModelParametersSettingsToDefaultsAction: PropTypes.func.isRequired,
  activeSubTab: PropTypes.string.isRequired,
  onSubTabSelect: PropTypes.func.isRequired,
};

export default React.memo(PlatformDetails);
