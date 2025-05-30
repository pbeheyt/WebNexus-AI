// src/sidepanel/components/PlatformModelControls.jsx
import React, {
  useEffect,
  useState,
  useRef,
  createContext,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import {
  PlatformIcon,
  ChevronDownIcon,
  Toggle,
  InfoIcon,
  Tooltip,
  IconButton,
} from '../../components';
import { logger } from '../../shared/logger';

import SidePanelModelParametersEditor from './SidePanelModelParametersEditor';
import ModelSelector from './ModelSelector';

// Create a context for dropdown state coordination
export const DropdownContext = createContext({
  openDropdown: null,
  setOpenDropdown: () => {},
});

function PlatformModelControls({ onToggleExpand }) {
  const {
    platforms,
    selectedPlatformId,
    selectPlatform,
    hasAnyPlatformCredentials,
    isLoading,
    getPlatformApiConfig,
    selectedModel,
  } = useSidePanelPlatform();
  const { modelConfigData, isThinkingModeEnabled, toggleThinkingMode } =
    useSidePanelChat();

  const [isParametersExpanded, setIsParametersExpanded] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const infoIconRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [displayPlatformId, setDisplayPlatformId] = useState(selectedPlatformId);
  const platformDropdownRef = useRef(null);
  const platformTriggerRef = useRef(null);

  const [fullSelectedPlatformConfig, setFullSelectedPlatformConfig] =
    useState(null);
  const [isParamsEditorReady, setIsParamsEditorReady] = useState(false);
  const currentEditingMode = isThinkingModeEnabled ? 'thinking' : 'base';
  const selfRef = useRef(null);

  const handleParamsEditorReady = useCallback(() => {
    setIsParamsEditorReady(true);
  }, []);

  useEffect(() => {
    if (typeof onToggleExpand === 'function' && selfRef.current) {
      onToggleExpand(selfRef.current.offsetHeight);
    }
  }, [isParametersExpanded, onToggleExpand]);

  useEffect(() => {
    const fetchFullConfig = async () => {
      if (selectedPlatformId && getPlatformApiConfig) {
        try {
          const config = await getPlatformApiConfig(selectedPlatformId);
          const platformDisplayConfig = platforms.find(
            (p) => p.id === selectedPlatformId
          );
          if (config && platformDisplayConfig) {
            setFullSelectedPlatformConfig({
              id: selectedPlatformId,
              name: platformDisplayConfig.name,
              iconUrl: platformDisplayConfig.iconUrl,
              apiConfig: config,
            });
          } else {
            setFullSelectedPlatformConfig(null);
          }
        } catch (error) {
          logger.sidepanel.error(
            `Error fetching full platform config for ${selectedPlatformId}:`,
            error
          );
          setFullSelectedPlatformConfig(null);
        }
      } else {
        setFullSelectedPlatformConfig(null);
      }
    };
    fetchFullConfig();
  }, [selectedPlatformId, platforms, getPlatformApiConfig]);

  useEffect(() => {
    if (!isLoading) {
      setDisplayPlatformId(selectedPlatformId);
    }
  }, [selectedPlatformId, isLoading]);

  const availablePlatforms = platforms.filter((p) => p.hasCredentials);
  const displayPlatformDetails = platforms.find(
    (p) => p.id === displayPlatformId
  );
  const isPlatformDropdownOpen = openDropdown === 'platform';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        platformDropdownRef.current &&
        !platformDropdownRef.current.contains(event.target) &&
        platformTriggerRef.current &&
        !platformTriggerRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  useEffect(() => {
    if (isLoading || !hasAnyPlatformCredentials) return;
    const isSelectedPlatformAvailable = availablePlatforms.some(
      (p) => p.id === selectedPlatformId
    );
    if (!isSelectedPlatformAvailable && availablePlatforms.length > 0) {
      selectPlatform(availablePlatforms[0].id);
    }
  }, [
    platforms,
    selectedPlatformId,
    hasAnyPlatformCredentials,
    isLoading,
    selectPlatform,
    availablePlatforms,
  ]);

  const handleSelectPlatform = (platformId) => {
    selectPlatform(platformId);
    setOpenDropdown(null);
  };

  const selectedPlatformForDisplay = displayPlatformDetails;

  const toggleParametersExpansion = () => {
    setIsParametersExpanded((prev) => !prev);
  };

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div
        ref={selfRef}
        className='flex flex-col py-2 border-b border-theme'
      >
        {/* Top row: Platform, Model, Thinking Toggle, Expander Chevron */}
        <div className='flex items-center w-full min-w-0 px-3'>
          <div className='flex items-center flex-grow min-w-0'>
            {hasAnyPlatformCredentials ? (
              <>
                {/* Platform Selector */}
                <div className='relative flex items-center h-9 flex-shrink-0 mr-2'>
                  {selectedPlatformForDisplay && (
                    <div ref={platformTriggerRef}>
                      <button
                        onClick={() =>
                          setOpenDropdown(
                            openDropdown === 'platform' ? null : 'platform'
                          )
                        }
                        className='flex items-center h-9 px-2 py-2 rounded focus:outline-none transition-colors select-none'
                        aria-label='Change Platform'
                        aria-haspopup='true'
                        aria-expanded={isPlatformDropdownOpen}
                      >
                        <PlatformIcon
                          platformId={selectedPlatformForDisplay?.id}
                          iconUrl={selectedPlatformForDisplay?.iconUrl}
                          altText={selectedPlatformForDisplay?.name || ''}
                          className='w-5 h-5 mr-1'
                        />
                        <ChevronDownIcon className='w-4 h-4 text-theme-secondary' />
                      </button>
                    </div>
                  )}
                  {isPlatformDropdownOpen && (
                    <div
                      ref={platformDropdownRef}
                      className='absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 py-1 w-max max-w-sm'
                      role='menu'
                    >
                      {availablePlatforms.map((platform) => (
                        <button
                          key={platform.id}
                          role='menuitem'
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-theme-hover ${
                            platform.id === selectedPlatformId
                              ? 'font-medium'
                              : ''
                          }`}
                          onClick={() => handleSelectPlatform(platform.id)}
                        >
                          <PlatformIcon
                            platformId={platform.id}
                            iconUrl={platform.iconUrl}
                            altText=''
                            className='w-4 h-4'
                          />
                          <span className='text-sm'>{platform.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model Selector */}
                <div className='min-w-0'>
                  <ModelSelector selectedPlatformId={selectedPlatformId} />
                </div>

                {/* Thinking Mode Toggle */}
                {modelConfigData?.thinking?.toggleable === true && (
                  <div className='flex items-center ml-2 flex-shrink-0 select-none'>
                    <Toggle
                      checked={isThinkingModeEnabled}
                      onChange={toggleThinkingMode}
                      aria-label='Toggle Thinking Mode'
                      id='thinking-mode-toggle-platform-controls'
                      disabled={!hasAnyPlatformCredentials || isLoading}
                    />
                    <div
                      ref={infoIconRef}
                      className='ml-1.5 cursor-help'
                      onMouseEnter={() => setTooltipVisible(true)}
                      onMouseLeave={() => setTooltipVisible(false)}
                      onFocus={() => setTooltipVisible(true)}
                      onBlur={() => setTooltipVisible(false)}
                      tabIndex={0}
                      role='button'
                      aria-describedby='thinking-mode-tooltip-platform-controls'
                    >
                      <InfoIcon className='w-3.5 h-3.5 text-theme-secondary' />
                    </div>
                    <Tooltip
                      show={tooltipVisible}
                      targetRef={infoIconRef}
                      message='Enable Thinking.'
                      position='bottom'
                      id='thinking-mode-tooltip-platform-controls'
                    />
                  </div>
                )}
              </>
            ) : (
              <div className='flex-grow py-1.5 h-9 flex items-center'>
                <span className='text-theme-secondary text-sm'>
                  No API credentials configured.
                </span>
              </div>
            )}
          </div>

          {/* Expander Chevron for Model Parameters */}
          {hasAnyPlatformCredentials && (
            <IconButton
              icon={ChevronDownIcon}
              onClick={toggleParametersExpansion}
              className={`ml-2 p-1 rounded-md text-theme-secondary hover:text-primary hover:bg-theme-active ${
                isParametersExpanded ? 'bg-theme-active text-primary' : ''
              }`}
              iconClassName={`w-5 h-5 flex-shrink-0 transform transition-transform duration-200 ${
                isParametersExpanded ? 'rotate-180' : ''
              }`}
              title={
                isParametersExpanded
                  ? 'Hide Model Parameters'
                  : 'Show Model Parameters'
              }
              aria-expanded={isParametersExpanded}
              disabled={!selectedPlatformId || !modelConfigData || isLoading}
            />
          )}
        </div>

        {/* Collapsible Model Parameters Editor */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isParametersExpanded && isParamsEditorReady
              ? 'max-h-[500px] opacity-100 pt-2'
              : 'max-h-0 opacity-0'
          }`}
          aria-hidden={!isParametersExpanded || !isParamsEditorReady}
        >
          {isParametersExpanded && (
            <>
              <hr className='border-theme-hover mx-3 mb-2' />
              <SidePanelModelParametersEditor
                platform={fullSelectedPlatformConfig}
                selectedModelId={selectedModel}
                currentEditingMode={currentEditingMode}
                modelConfigData={modelConfigData}
                isVisible={isParametersExpanded}
                onReady={handleParamsEditorReady}
              />
            </>
          )}
        </div>
      </div>
    </DropdownContext.Provider>
  );
}

PlatformModelControls.propTypes = {
  onToggleExpand: PropTypes.func.isRequired,
};

export default PlatformModelControls;