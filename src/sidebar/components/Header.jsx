import React, { useEffect, useState, useRef } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import ModelSelector from './ModelSelector';
import { Tooltip } from '../../components/layout/Tooltip'; // Import Tooltip as named import

// SVG Icons (inline for simplicity)
const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);


function Header() {
  const { platforms, selectedPlatformId, selectPlatform } = useSidebarPlatform();
  const [platformCredentials, setPlatformCredentials] = useState({});
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Fetch credential status
  useEffect(() => {
    const checkAllCredentials = async () => {
      if (!platforms || platforms.length === 0) return;
      const credentialStatus = {};
      for (const platform of platforms) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'credentialOperation',
            operation: 'get',
            platformId: platform.id
          });
          credentialStatus[platform.id] = response?.success && !!response?.credentials;
        } catch (error) {
          console.error(`Error checking credentials for ${platform.id}:`, error);
          credentialStatus[platform.id] = false;
        }
      }
      setPlatformCredentials(credentialStatus);
    };
    checkAllCredentials();
  }, [platforms]);

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsPlatformDropdownOpen(false);
      }
    };

    if (isPlatformDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlatformDropdownOpen]);

  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId);

  const handleSelectPlatform = (platformId) => {
    selectPlatform(platformId);
    setIsPlatformDropdownOpen(false);
  };

  return (
    <div className="border-b border-theme"> {/* Minimal padding, bottom border */}
      <div className="flex items-end gap-2 relative px-4 py-2"> {/* Main horizontal layout */}
        {selectedPlatform ? (
          <div ref={triggerRef} className="relative flex items-center">
            <button
              onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
              className="flex items-center gap-1 p-1.5 rounded hover:bg-theme-hover focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Change Platform"
              aria-haspopup="true"
              aria-expanded={isPlatformDropdownOpen}
            >
              <img
                src={selectedPlatform.iconUrl}
                alt={`${selectedPlatform.name} logo`}
                className="w-6 h-6 object-contain"
              />
              <ChevronDownIcon />
            </button>

            {/* Platform Dropdown */}
            {isPlatformDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 w-48 bg-theme-surface border border-theme rounded-md shadow-lg z-40 py-1"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="platform-menu-button"
              >
                {platforms.map((platform) => {
                  const hasCreds = platformCredentials[platform.id] || false;
                  const isDisabled = !hasCreds;
                  const isSelected = platform.id === selectedPlatformId;

                  const itemContent = (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <img src={platform.iconUrl} alt="" className="w-4 h-4 object-contain" />
                        <span className="text-sm">{platform.name}</span>
                      </div>
                      {isSelected && <CheckIcon />}
                    </div>
                  );

                  return (
                    <button
                      key={platform.id}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-theme-hover'
                      } ${isSelected ? 'font-medium' : ''}`}
                      onClick={() => !isDisabled && handleSelectPlatform(platform.id)}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                    >
                      {isDisabled ? (
                        <Tooltip text="Credentials required. Configure in settings." position="right">
                          {itemContent}
                        </Tooltip>
                      ) : (
                        itemContent
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-theme-secondary">Loading...</div> // Placeholder
        )}

        {/* Model Selector takes remaining space */}
        <div className="flex-grow">
          <ModelSelector />
        </div>
      </div>
    </div>
  );
}

export default Header;
