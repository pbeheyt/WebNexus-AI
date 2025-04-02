import React, { useEffect, useState, useRef, createContext } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import ModelSelector from './ModelSelector';
import { Tooltip } from '../../components/layout/Tooltip';

// Create a context for dropdown state coordination
export const DropdownContext = createContext({
  openDropdown: null,
  setOpenDropdown: () => {}
});

// SVG Icons (inline for simplicity)
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

// Settings icon for credential management
const ApiSettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-theme-secondary">
    <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.608 7.45 7.45 0 00-.478.198.798.798 0 01-.796-.064l-.453-.324a1.875 1.875 0 00-2.416.2l-.243.243a1.875 1.875 0 00-.2 2.416l.324.453a.798.798 0 01.064.796 7.448 7.448 0 00-.198.478.798.798 0 01-.608.517l-.55.092a1.875 1.875 0 00-1.566 1.849v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 01-.064.796l-.324.453a1.875 1.875 0 00.2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 01.796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.608 7.52 7.52 0 00.478-.198.798.798 0 01.796.064l.453.324a1.875 1.875 0 002.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 01-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.091a1.875 1.875 0 001.566-1.85v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 01-.608-.517 7.507 7.507 0 00-.198-.478.798.798 0 01.064-.796l.324-.453a1.875 1.875 0 00-.2-2.416l-.243-.243a1.875 1.875 0 00-2.416-.2l-.453.324a.798.798 0 01-.796.064 7.462 7.462 0 00-.478-.198.798.798 0 01-.517-.608l-.091-.55a1.875 1.875 0 00-1.85-1.566h-.344zM10 13.125a3.125 3.125 0 100-6.25 3.125 3.125 0 000 6.25z" clipRule="evenodd" />
  </svg>
);

function Header() {
  const { platforms, selectedPlatformId, selectPlatform } = useSidebarPlatform();
  const [platformCredentials, setPlatformCredentials] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const apiIconRef = useRef(null);
  
  const isPlatformDropdownOpen = openDropdown === 'platform';

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
        (dropdownRef.current && !dropdownRef.current.contains(event.target)) &&
        (triggerRef.current && !triggerRef.current.contains(event.target))
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

  // Filter platforms to only show those with valid credentials
  const availablePlatforms = platforms.filter(p => platformCredentials[p.id]);
  
  // Check if there are any platforms with credentials
  const hasPlatformsWithCredentials = availablePlatforms.length > 0;
  
  // Find selected platform only from available platforms
  const selectedPlatform = hasPlatformsWithCredentials 
    ? availablePlatforms.find(p => p.id === selectedPlatformId) || availablePlatforms[0]
    : null;
  
  // Auto-select first available platform if current selection is invalid
  useEffect(() => {
    if (hasPlatformsWithCredentials && (!selectedPlatformId || !availablePlatforms.some(p => p.id === selectedPlatformId))) {
      selectPlatform(availablePlatforms[0].id);
    }
  }, [selectedPlatformId, hasPlatformsWithCredentials, availablePlatforms, selectPlatform]);

  const handleSelectPlatform = (platformId) => {
    selectPlatform(platformId);
    setOpenDropdown(null);
  };

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div className="border-b border-theme">
        <div className="flex items-end gap-2 px-4 py-2">
          {/* Platform Selector with conditional rendering */}
          <div className="relative flex items-center self-end">
            {hasPlatformsWithCredentials ? (
              // Standard platform selector when credentials exist
              <div ref={triggerRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'platform' ? null : 'platform')}
                  className="flex items-center h-9 px-2 py-1.5 rounded focus:outline-none transition-colors"
                  aria-label="Change Platform"
                  aria-haspopup="true"
                  aria-expanded={isPlatformDropdownOpen}
                >
                  <span className="mr-1 text-theme-secondary">
                    <ChevronIcon />
                  </span>
                  <img
                    src={selectedPlatform.iconUrl}
                    alt={`${selectedPlatform.name} logo`}
                    className="w-6 h-6 object-contain"
                  />
                </button>
              </div>
            ) : (
              // API settings icon with tooltip when no credentials available
              <div ref={apiIconRef} className="flex items-center h-9 px-2 py-1.5 rounded">
                <ApiSettingsIcon />
                <Tooltip 
                  show={true} 
                  message="Go to settings to manage API credentials" 
                  position="right" 
                  targetRef={apiIconRef}
                />
              </div>
            )}

            {/* Platform Dropdown - Only show with valid credentials */}
            {isPlatformDropdownOpen && hasPlatformsWithCredentials && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 w-48 bg-theme-surface border border-theme rounded-md shadow-lg z-40 py-1"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="platform-menu-button"
              >
                {availablePlatforms.map((platform) => {
                  const isSelected = platform.id === selectedPlatformId;

                  return (
                    <button
                      key={platform.id}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-theme-hover ${
                        isSelected ? 'font-medium' : ''
                      }`}
                      onClick={() => handleSelectPlatform(platform.id)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <img src={platform.iconUrl} alt="" className="w-4 h-4 object-contain" />
                          <span className="text-sm">{platform.name}</span>
                        </div>
                        {isSelected && <CheckIcon />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Model Selector takes remaining space */}
          <div className="flex-grow self-end">
            <ModelSelector 
              hasPlatformsWithCredentials={hasPlatformsWithCredentials} 
              selectedPlatformId={selectedPlatformId} 
            />
          </div>
        </div>
      </div>
    </DropdownContext.Provider>
  );
}

export default Header;