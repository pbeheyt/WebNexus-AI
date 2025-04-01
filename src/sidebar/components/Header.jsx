import React, { useEffect, useState } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
// Removed useTheme import
import ModelSelector from './ModelSelector';
import PlatformCard from '../../components/layout/PlatformCard';
import { ContentTypeDisplay, useContent } from '../../components';

// Removed onClose prop
function Header() {
  const { platforms, selectedPlatformId, selectPlatform } = useSidebarPlatform();
  // Removed theme and toggleTheme
  const [platformCredentials, setPlatformCredentials] = useState({});

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

  // Return only the platform/model selection parts, wrapped in a div for padding
  return (
    <div className="p-4 pt-0 flex flex-col gap-2"> {/* Added padding top 0 */}
      {/* Content Type Display */}
      <div className="mb-3">
        <ContentTypeDisplay className="w-full" />
      </div>

      {/* Platform Selection */}
      <div className="flex flex-row justify-between w-full relative z-30">
        {platforms.map((platform) => (
          <PlatformCard
            key={platform.id}
            id={platform.id}
            name={platform.name}
            iconUrl={platform.iconUrl}
            selected={platform.id === selectedPlatformId}
            onClick={selectPlatform}
            hasCredentials={platformCredentials[platform.id] || false}
            checkCredentials={true}
            showName={false}
          />
        ))}
      </div>

      <div className="relative z-20">
        <ModelSelector />
      </div>
    </div>
  );
}

export default Header;
