// src/sidepanel/components/PlatformSelector.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { PlatformIcon, ChevronDownIcon } from '../../components';
import { logger } from '../../shared/logger';

import { DropdownContext } from './PlatformModelControls';

function PlatformSelector({ className = '' }) {
  const {
    platforms,
    selectedPlatformId,
    selectPlatform,
    isLoading,
    hasAnyPlatformCredentials,
  } = useSidePanelPlatform();

  const [displayPlatformDetails, setDisplayPlatformDetails] = useState(null);
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const isOpen = openDropdown === 'platform';
  const dropdownRef = useRef(null);
  const platformTriggerRef = useRef(null);

  useEffect(() => {
    // Data from context is now stable, so we can directly derive the display details.
    const platform = platforms.find((p) => p.id === selectedPlatformId);
    if (platform) {
      setDisplayPlatformDetails({
        id: platform.id,
        name: platform.name,
        iconUrl: platform.iconUrl,
      });
    } else if (hasAnyPlatformCredentials && platforms.length > 0) {
      const firstAvailable = platforms.find((p) => p.hasCredentials);
      if (firstAvailable) {
        setDisplayPlatformDetails({
          id: firstAvailable.id,
          name: firstAvailable.name,
          iconUrl: firstAvailable.iconUrl,
        });
      } else {
        setDisplayPlatformDetails(null);
      }
    } else {
      setDisplayPlatformDetails(null);
    }
  }, [selectedPlatformId, platforms, hasAnyPlatformCredentials]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        platformTriggerRef.current &&
        !platformTriggerRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenDropdown]);

  const handleSelectPlatform = async (platformId) => {
    if (platformId) {
      try {
        await selectPlatform(platformId);
        setOpenDropdown(null);
      } catch (error) {
        logger.sidepanel.error(`Error selecting platform ${platformId}:`, error);
      }
    }
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : 'platform');
  };

  const availablePlatforms = platforms.filter((p) => p.hasCredentials);

  if (!hasAnyPlatformCredentials) {
    return (
      <div
        className={`flex items-center px-2 text-theme-secondary text-xs ${className}`}
      >
        No API keys set
      </div>
    );
  }

  return (
    <div className={`relative select-none ${className}`}>
      <button
        ref={platformTriggerRef}
        onClick={toggleDropdown}
        className='flex items-center px-2 bg-transparent border-0 rounded text-theme-primary font-medium text-sm transition-colors cursor-pointer w-full min-w-30 disabled:cursor-not-allowed disabled:opacity-75'
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        aria-label={`Selected platform: ${
          displayPlatformDetails?.name || 'loading'
        }. Click to change.`}
        disabled={isLoading || !hasAnyPlatformCredentials}
      >
        {displayPlatformDetails ? (
          <PlatformIcon
            platformId={displayPlatformDetails.id}
            iconUrl={displayPlatformDetails.iconUrl}
            altText={`${displayPlatformDetails.name} logo`}
            className='w-5 h-5 mr-1'
          />
        ) : (
          <div className='w-5 h-5 mr-1'></div> // Placeholder to prevent layout shift
        )}
        <ChevronDownIcon className='w-4 h-4 text-theme-secondary' />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className='absolute bottom-full left-0 mb-3 bg-theme-surface border border-theme rounded-md shadow-md z-40 max-h-60 w-max overflow-y-auto'
          role='listbox'
          aria-labelledby={platformTriggerRef.current?.id || undefined}
          tabIndex={-1}
        >
          {availablePlatforms.length === 0 ? (
            <div className='px-3 py-2 text-sm text-theme-secondary'>
              No platforms available
            </div>
          ) : (
            availablePlatforms.map((platform) => (
              <button
                key={platform.id}
                role='option'
                aria-selected={selectedPlatformId === platform.id}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-theme-hover whitespace-nowrap ${
                  selectedPlatformId === platform.id
                    ? 'font-medium bg-theme-hover'
                    : ''
                }`}
                onClick={() => handleSelectPlatform(platform.id)}
              >
                <PlatformIcon
                  platformId={platform.id}
                  iconUrl={platform.iconUrl}
                  altText=''
                  className='w-5 h-5'
                />
                <span>{platform.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

PlatformSelector.propTypes = {
  className: PropTypes.string,
};

export default PlatformSelector;