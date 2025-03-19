import { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        setIsLoading(true);
        // Load platform config
        const response = await fetch(chrome.runtime.getURL('platform-config.json'));
        const config = await response.json();
        
        if (!config.aiPlatforms) {
          throw new Error('AI platforms configuration not found');
        }
        
        // Transform to array with icon URLs
        const platformList = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
          id,
          name: platform.name,
          url: platform.url,
          iconUrl: chrome.runtime.getURL(platform.icon)
        }));
        
        // Get preferred platform
        const { [STORAGE_KEYS.PREFERRED_PLATFORM]: preferredPlatform } = 
          await chrome.storage.sync.get(STORAGE_KEYS.PREFERRED_PLATFORM);
        
        const preferredPlatformId = preferredPlatform || config.defaultAiPlatform;
        
        setPlatforms(platformList);
        setSelectedPlatformId(preferredPlatformId);
      } catch (error) {
        console.error('Error loading platforms:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlatforms();
  }, []);
  
  const selectPlatform = async (platformId) => {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.PREFERRED_PLATFORM]: platformId });
      setSelectedPlatformId(platformId);
      return true;
    } catch (error) {
      console.error('Error setting platform preference:', error);
      return false;
    }
  };
  
  return (
    <PlatformContext.Provider 
      value={{ 
        platforms, 
        selectedPlatformId, 
        selectPlatform, 
        isLoading 
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export const usePlatforms = () => useContext(PlatformContext);