// src/contexts/platform/BasePlatformContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Creates a base platform context with shared functionality.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - Key used for storing platform preference
 * @param {Function} options.onStatusUpdate - Optional status update callback
 * @returns {Object} The context object with provider component
 */
export function createBasePlatformContext(options = {}) {
  const { 
    storageKey, 
    onStatusUpdate = () => {} 
  } = options;
  
  // Create the context
  const PlatformContext = createContext(null);
  
  // Create provider component
  function BasePlatformProvider({ children }) {
    const [platforms, setPlatforms] = useState([]);
    const [selectedPlatformId, setSelectedPlatformId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Load platforms on component mount
    useEffect(() => {
      const loadPlatforms = async () => {
        try {
          setIsLoading(true);
          
          // Load platform config
          const response = await fetch(chrome.runtime.getURL('platform-config.json'));
          const config = await response.json();
          
          if (!config || !config.aiPlatforms) {
            throw new Error('Invalid platform configuration');
          }
          
          // Transform to array with icon URLs
          const platformList = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
            id,
            name: platform.name,
            url: platform.url || null,
            iconUrl: chrome.runtime.getURL(platform.icon)
          }));
          
          // Get preferred platform from storage
          const result = await chrome.storage.sync.get(storageKey);
          const preferredPlatform = result[storageKey];
          
          // Set platforms and selected ID
          setPlatforms(platformList);
          setSelectedPlatformId(preferredPlatform || config.defaultAiPlatform);
        } catch (error) {
          console.error('Error loading platforms:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadPlatforms();
    }, []);
    
    // Select platform and save preference
    const selectPlatform = async (platformId) => {
      try {
        if (platformId === selectedPlatformId) return true;
        
        // Save to storage
        await chrome.storage.sync.set({ [storageKey]: platformId });
        setSelectedPlatformId(platformId);
        
        // Notify status if callback provided
        const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
        onStatusUpdate(`Platform set to ${platformName}`);
        
        return true;
      } catch (error) {
        console.error('Error setting platform preference:', error);
        return false;
      }
    };

    // Get platform configuration by ID
    const getPlatformConfig = async (platformId) => {
      try {
        const response = await fetch(chrome.runtime.getURL('platform-config.json'));
        const config = await response.json();
        return config.aiPlatforms[platformId] || null;
      } catch (error) {
        console.error(`Error loading platform config for ${platformId}:`, error);
        return null;
      }
    };
    
    // Context value
    const contextValue = {
      platforms,
      selectedPlatformId,
      selectPlatform,
      isLoading,
      getPlatformConfig
    };
    
    return (
      <PlatformContext.Provider value={contextValue}>
        {children}
      </PlatformContext.Provider>
    );
  }
  
  // Custom hook to use the context
  const usePlatform = () => {
    const context = useContext(PlatformContext);
    if (!context) {
      throw new Error('usePlatform must be used within a PlatformProvider');
    }
    return context;
  };
  
  return {
    PlatformContext,
    PlatformProvider: BasePlatformProvider,
    usePlatform
  };
}