// src/settings/components/ui/platforms/PlatformDetails.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Button, useNotification, PlatformIcon, Input, InfoIcon } from '../../../../components';
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

  // internalIntendedActiveSubTab: Tracks the tab the user intends to see (button style).
  // displayedSubTabContentId: Tracks which tab's content is actually rendered.
  const [internalIntendedActiveSubTab, setInternalIntendedActiveSubTab] = useState(activeSubTab);
  const [displayedSubTabContentId, setDisplayedSubTabContentId] = useState(activeSubTab);
  
  const [selectedModelId, setSelectedModelId] = useState(
    platform.apiConfig?.models?.length > 0
      ? platform.apiConfig.models[0].id
      : 'default'
  );

  // Sync internal tab states with the activeSubTab prop from parent.
  useEffect(() => {
    setInternalIntendedActiveSubTab(activeSubTab);
    if (activeSubTab === 'apiKey') {
      setDisplayedSubTabContentId('apiKey');
    }
    // 'modelParams' display is handled by its onReady callback.
  }, [activeSubTab]);

  // Reset API key form and selected model when platform or credentials change.
  // Sub-tab persistence across platform changes is now handled by the parent (ApiSettings.jsx)
  // correctly managing the `activeSubTab` prop.
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!window.confirm(`Are you sure you want to remove the API key for ${platform.name}?`)) {
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

  // Callback for when ModelParametersSettings content is ready to be displayed.
  const handleModelParametersReady = useCallback(() => {
    if (internalIntendedActiveSubTab === 'modelParams') {
      setDisplayedSubTabContentId('modelParams');
    }
  }, [internalIntendedActiveSubTab]);

  return (
    <div className='platform-details-panel flex-1'>
      <div className='platform-header flex items-center mb-6'>
        {platform.iconUrl ? (
          <div className='select-none'>
            <PlatformIcon
              platformId={platform.id}
              iconUrl={platform.iconUrl}
              altText={platform.name}
              className='platform-icon-large w-12 h-12 mr-6 flex-shrink-0'
            />
          </div>
        ) : (
          <div className='platform-icon-placeholder-large w-12 h-12 mr-6 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold flex-shrink-0 select-none'>
            {platform.name.charAt(0)}
          </div>
        )}
        <div className='platform-header-info min-w-0'>
          <h3 className='platform-title text-xl font-semibold mb-2 text-theme-primary truncate'>
            {platform.name}
          </h3>
          <div className='platform-actions flex flex-wrap gap-x-3 gap-y-1'>
            <a href={platform.consoleApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer'>API Console</a>
            <a href={platform.docApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer'>API Documentation</a>
            <a href={platform.modelApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer'>Model Documentation</a>
            <a href={platform.keyApiLink} target='_blank' rel='noopener noreferrer' className='platform-link text-primary hover:underline text-sm cursor-pointer'>API Keys</a>
          </div>
        </div>
      </div>

      <SubTabLayout
        tabs={subTabs}
        activeTabId={internalIntendedActiveSubTab} // Controls button styles
        onTabSelect={(tabId) => {
          setInternalIntendedActiveSubTab(tabId);
          if (tabId === 'apiKey') {
            setDisplayedSubTabContentId('apiKey');
          }
          if (typeof onSubTabSelect === 'function') {
            onSubTabSelect(tabId); // Inform parent of selection
          }
        }}
      >
        {(_currentActiveIntendedSubTabParam) => {
          const showApiKeyContent = displayedSubTabContentId === 'apiKey';
          const showModelParamsContent = displayedSubTabContentId === 'modelParams';
          const shouldMountModelParamsComponent = internalIntendedActiveSubTab === 'modelParams';

          return (
            <>
              <div style={{ display: showApiKeyContent ? 'block' : 'none' }}>
                <SettingsCard className='settings-section'>
                  <h4 className='section-subtitle text-base font-semibold mb-4 text-theme-primary'>
                    API Credentials
                  </h4>
                  <div className='form-group mb-4'>
                    <label htmlFor={`${platform.id}-api-key`} className='block mb-2 text-sm text-theme-secondary'>API Key</label>
                    <div className='relative flex items-center select-none'>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        id={`${platform.id}-api-key`}
                        value={apiKey}
                        onChange={handleApiKeyChange}
                        placeholder={credentials?.apiKey ? '••••••••••••••••••••••••••' : 'Enter your API key'}
                        disabled={shouldShowApiKeySaving}
                        className='api-key-input p-2 pr-16 bg-theme-hover border border-theme rounded-md font-mono focus:ring-primary focus:border-primary'
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
                  <div className='my-3 flex items-start text-xs text-amber-600 dark:text-amber-500'>
                    <InfoIcon className='w-4 h-4 mr-2 flex-shrink-0' />
                    <span>Note: Newly created API keys can take a few minutes to become active. If validation fails, please try again shortly.</span>
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
              </div>

              {shouldMountModelParamsComponent && (
                <div style={{ display: showModelParamsContent ? 'block' : 'none' }}>
                  <ModelParametersSettings
                    platform={platform}
                    selectedModelId={selectedModelId}
                    modelParametersSettings={modelParametersForPlatform}
                    onModelSelect={handleModelSelect}
                    onSettingsUpdate={saveModelParametersSettingsAction}
                    onResetToDefaults={resetModelParametersSettingsToDefaultsAction}
                    onReady={handleModelParametersReady}
                  />
                </div>
              )}
            </>
          );
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
