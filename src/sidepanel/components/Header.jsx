import React, { useEffect, useState, useRef, createContext, useCallback } from 'react';

import { useSidePanelPlatform } from '../../contexts/platform';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import {
  PlatformIcon,
  ChevronDownIcon,
  Toggle,
  InfoIcon,
  Tooltip,
  SettingsIcon,
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

function Header() {
  const {
    platforms,
    selectedPlatformId,
    selectPlatform,
    hasAnyPlatformCredentials,
    isLoading,
  } = useSidePanelPlatform();
  const { modelConfigData, isThinkingModeEnabled, toggleThinkingMode } =
    useSidePanelChat();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const infoIconRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [displayPlatformId, setDisplayPlatformId] = useState(selectedPlatformId);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // State for Parameter Editor
  const [isParamsEditorOpen, setIsParamsEditorOpen] = useState(false);
  const [fullSelectedPlatformConfig, setFullSelectedPlatformConfig] = useState(null);
  const [isParamsEditorReady, setIsParamsEditorReady] = useState(false); 

  const handleParamsEditorReady = useCallback(() => { 
    setIsParamsEditorReady(true);
  }, []);

  // Fetch full platform config when selectedPlatformId changes
  useEffect(() => {
    const fetchFullConfig = async () => {
      if (selectedPlatformId && useSidePanelPlatform.getPlatformApiConfig) {
        try {
          const config = await useSidePanelPlatform.getPlatformApiConfig(selectedPlatformId);
          const platformDisplayConfig = platforms.find(p => p.id === selectedPlatformId);
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
          logger.sidepanel.error(`Error fetching full platform config for ${selectedPlatformId}:`, error);
          setFullSelectedPlatformConfig(null);
        }
      } else {
        setFullSelectedPlatformConfig(null);
      }
    };
    fetchFullConfig();
  }, [selectedPlatformId, platforms]);

  // Update display platform ID only when loading is finished
  useEffect(() => {
    if (!isLoading) {
      setDisplayPlatformId(selectedPlatformId);
    }
  }, [selectedPlatformId, isLoading]);

  // Filter platforms based on credentials
  const availablePlatforms = platforms.filter((p) => p.hasCredentials);

  // Find display platform details
  const displayPlatformDetails = platforms.find(
    (p) => p.id === displayPlatformId
  );

  const isPlatformDropdownOpen = openDropdown === 'platform';

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
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

  // Effect to handle selection change if current platform loses credentials
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

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div className='flex flex-col'>
        <div className='flex items-center px-5'></div>
        <div className='flex items-center w-full min-w-0'>
          {hasAnyPlatformCredentials ? (
            <>
              {/* 1. Platform Selector */}
              <div className='relative flex items-center h-9 flex-shrink-0 mr-2'>
                {selectedPlatformForDisplay && (
                  <div ref={triggerRef}>
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

                {/* Platform Dropdown */}
                {isPlatformDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className='absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 py-1 w-max max-w-sm'
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='platform-menu-button'
                  >
                    {availablePlatforms.map((platform) => {
                      const isSelected = platform.id === selectedPlatformId;
                      return (
                        <button
                          key={platform.id}
                          role='menuitem'
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-theme-hover ${
                            isSelected ? 'font-medium' : ''
                          }`}
                          onClick={() => handleSelectPlatform(platform.id)}
                        >
                          <div className='flex items-center justify-between w-full'>
                            <div className='flex items-center gap-2'>
                              <PlatformIcon
                                platformId={platform.id}
                                iconUrl={platform.iconUrl}
                                altText=''
                                className='w-4 h-4'
                              />
                              <span className='text-sm'>{platform.name}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Model Selector */}
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
                    id='thinking-mode-toggle-sidepanel'
                    disabled={!hasAnyPlatformCredentials || isLoading}
                  />
                  {/* Info Icon and Tooltip */}
                  <div
                    ref={infoIconRef}
                    className='ml-3 cursor-help'
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                    onFocus={() => setTooltipVisible(true)}
                    onBlur={() => setTooltipVisible(false)}
                    tabIndex={0}
                    role='button'
                    aria-describedby='thinking-mode-tooltip'
                  >
                    <InfoIcon className='w-5 h-5 text-theme-secondary' />
                  </div>
                  <Tooltip
                    show={tooltipVisible}
                    targetRef={infoIconRef}
                    message='Enable Thinking.'
                    position='bottom'
                    id='thinking-mode-tooltip'
                  />
                </div>
              )}

        {/* Parameter Editor Toggle Button */}
        <IconButton
            icon={SettingsIcon}
            onClick={() => setIsParamsEditorOpen(prev => !prev)}
            className={`ml-2 p-1 rounded-full text-theme-secondary hover:text-primary hover:bg-theme-active ${isParamsEditorOpen ? 'bg-theme-active text-primary' : ''}`}
            iconClassName='w-5 h-5'
            title='Model Parameters'
            aria-expanded={isParamsEditorOpen}
            disabled={!selectedPlatformId || !modelConfigData || isLoading}
        />
              <div className='flex-grow' style={{ pointerEvents: 'none' }}></div>
            </>
          ) : (
            // When no credentials, show message
            <div className='flex-grow py-1.5 h-9 flex items-center'>
              <span className='text-theme-secondary text-sm'>
                No API credentials configured.
              </span>
            </div>
          )}
        </div>
        
        {/* Parameter Editor Container */}
        <div 
            className={`transition-all duration-300 ease-in-out overflow-hidden ${isParamsEditorOpen && isParamsEditorReady ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
            aria-hidden={!isParamsEditorOpen || !isParamsEditorReady}
        >
             {fullSelectedPlatformConfig && modelConfigData && (
                 <SidePanelModelParametersEditor
                    platform={fullSelectedPlatformConfig} 
                    selectedModelId={useSidePanelPlatform.selectedModel}
                    currentEditingMode={useSidePanelChat.currentEditingMode}
                    modelConfigData={modelConfigData} 
                    isVisible={isParamsEditorOpen} 
                    onReady={handleParamsEditorReady} 
                />
            )}
        </div>
      </div>
    </DropdownContext.Provider>
  );
}

export default Header;
