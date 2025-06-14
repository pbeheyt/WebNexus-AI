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
  ChevronUpIcon,
  Toggle,
  Tooltip,
  IconButton,
} from '../../components';
import { logger } from '../../shared/logger';

import SidePanelModelParametersEditor from './SidePanelModelParametersEditor';
import ModelSelector from './ModelSelector';
import PlatformSelector from './PlatformSelector';

// Create a context for dropdown state coordination
export const DropdownContext = createContext({
  openDropdown: null,
  setOpenDropdown: () => {},
});

function PlatformModelControls({ onToggleExpand }) {
  const {
    selectedPlatformId,
    platforms,
    hasAnyPlatformCredentials,
    isLoading,
    getPlatformApiConfig,
    selectedModel,
  } = useSidePanelPlatform();
  const { modelConfigData, isThinkingModeEnabled, toggleThinkingMode } =
    useSidePanelChat();

  const [isParametersExpanded, setIsParametersExpanded] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const thinkingToggleWrapperRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null); // Manages which dropdown is open: 'platform', 'model', or null

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

  const toggleParametersExpansion = () => {
    setIsParametersExpanded((prev) => !prev);
  };

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div
        ref={selfRef}
        className='flex flex-col px-3 py-2 border-b border-t border-theme bg-theme-secondary'
      >
        {/* Top row: Platform, Model, Thinking Toggle, Expander Chevron */}
        <div className='flex items-center w-full min-w-0'>
          <div className='flex items-center flex-grow min-w-0'>
            {hasAnyPlatformCredentials ? (
              <>
                {/* Platform Selector Component */}
                <div className='flex items-center flex-shrink-0 mr-2'>
                  <PlatformSelector />
                </div>

                {/* Model Selector */}
                <div className='min-w-0'>
                  <ModelSelector selectedPlatformId={selectedPlatformId} />
                </div>

                {/* Thinking Mode Toggle */}
                {modelConfigData?.thinking?.toggleable === true && (
                  <div
                    className='flex items-center ml-2 flex-shrink-0 select-none'
                    ref={thinkingToggleWrapperRef}
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                    onFocus={() => setTooltipVisible(true)}
                    onBlur={() => setTooltipVisible(false)}
                    tabIndex={0}
                    role="button"
                    aria-describedby="thinking-mode-toggle-tooltip"
                  >
                    <Toggle
                      checked={isThinkingModeEnabled}
                      onChange={toggleThinkingMode}
                      aria-label='Toggle Thinking Mode'
                      id='thinking-mode-toggle-platform-controls'
                      disabled={!hasAnyPlatformCredentials || isLoading}
                    />
                    <Tooltip
                      show={tooltipVisible}
                      targetRef={thinkingToggleWrapperRef}
                      message='Toggle Thinking Mode.'
                      position='bottom'
                      id='thinking-mode-toggle-tooltip'
                    />
                  </div>
                )}
              </>
            ) : (
              <div className='flex-grow flex items-center'>
                <span className='text-theme-secondary text-sm px-2'>
                  No API credentials configured.
                </span>
              </div>
            )}
          </div>

          {/* Expander Chevron for Model Parameters */}
          {hasAnyPlatformCredentials && (
            <IconButton
              icon={ChevronUpIcon}
              onClick={toggleParametersExpansion}
              className={`ml-2 p-1 rounded-md text-theme-secondary hover:text-primary hover:bg-theme-active ${
                isParametersExpanded ? 'text-primary' : ''
              }`}
              iconClassName={`w-4 h-4 flex-shrink-0 transform transition-transform duration-200 ${
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
          className={`overflow-hidden ${
            isParametersExpanded && isParamsEditorReady
              ? 'max-h-[500px] opacity-100 mt-2 mb-1'
              : 'max-h-0 opacity-0'
          }`}
          aria-hidden={!isParametersExpanded || !isParamsEditorReady}
        >
          {isParametersExpanded && (
            <>
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
