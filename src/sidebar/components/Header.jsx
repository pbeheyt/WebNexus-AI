import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import ModelSelector from './ModelSelector';

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

function Header() {
  const {
    platforms,
    selectedPlatformId,
    selectPlatform,
    hasAnyPlatformCredentials,
    isLoading,
    isRefreshing,
    refreshPlatformData
  } = useSidebarPlatform();
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const refreshButtonRef = useRef(null);
  const triggerRef = useRef(null);
  const { setOpenDropdown: setGlobalOpenDropdown } = useContext(DropdownContext);

  // Filter platforms based on credentials
  const availablePlatforms = platforms.filter(p => p.hasCredentials);

  // Find selected platform details
  const selectedPlatformDetails = platforms.find(p => p.id === selectedPlatformId);

  const isPlatformDropdownOpen = openDropdown === 'platform';

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

  // Effect to handle selection change if current platform loses credentials
  useEffect(() => {
    if (isLoading || !hasAnyPlatformCredentials) return; 

    const isSelectedPlatformAvailable = availablePlatforms.some(p => p.id === selectedPlatformId);

    if (!isSelectedPlatformAvailable && availablePlatforms.length > 0) {
      selectPlatform(availablePlatforms[0].id);
    }
  }, [platforms, selectedPlatformId, hasAnyPlatformCredentials, isLoading, selectPlatform, availablePlatforms]);

  const handleSelectPlatform = (platformId) => {
    selectPlatform(platformId);
    setOpenDropdown(null);
  };

  const selectedPlatformForDisplay = selectedPlatformDetails; 

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div className=""> {/* Removed border-b border-theme */}
        <div className="flex items-center justify-between px-4">
          {/* Container for conditional content (grows) */}
          <div className="flex items-center flex-grow min-w-0">
            {hasAnyPlatformCredentials ? (
              <>
                {/* Platform Selector */}
                <div className="relative flex items-center h-9 flex-shrink-0"> {/* Added flex-shrink-0 */}
                  {selectedPlatformForDisplay && (
                    <div ref={triggerRef}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === 'platform' ? null : 'platform')}
                        className="flex items-center h-9 px-2 py-2 rounded focus:outline-none transition-colors"
                        aria-label="Change Platform"
                        aria-haspopup="true"
                        aria-expanded={isPlatformDropdownOpen}
                      >
                        <img
                          src={selectedPlatformForDisplay.iconUrl}
                          alt={`${selectedPlatformForDisplay.name} logo`}
                          className="w-4 h-4 object-contain mr-1"
                        />
                        <span className="text-theme-secondary">
                          <ChevronIcon />
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Platform Dropdown */}
                  {isPlatformDropdownOpen && (
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

                {/* Model Selector (grows within its space) */}
                <div className="flex-grow flex items-center h-9 ml-2 min-w-0"> {/* Added flex-grow, ml-2, min-w-0 */}
                  <ModelSelector 
                    selectedPlatformId={selectedPlatformId}
                  />
                </div>
              </>
            ) : (
              // When no credentials, show message
              <div className="h-9 flex items-center"> {/* Removed flex-grow */}
                <span className="text-theme-secondary text-sm">No API credentials configured.</span>
              </div>
            )}
          </div>

          {/* Refresh Button (doesn't shrink, always visible) */}
          <div className="flex items-center h-9 flex-shrink-0 ml-2"> {/* Added flex-shrink-0, ml-2 */}
            <button
              ref={refreshButtonRef}
              onClick={refreshPlatformData}
              disabled={isRefreshing || isLoading}
              className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh platforms and credentials"
              title="Refresh platforms and credentials"
            >
              {isRefreshing ? (
                <span className="animate-spin">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                  </svg>
                </span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </DropdownContext.Provider>
  );
}

export default Header;
