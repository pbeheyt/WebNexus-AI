// src/components/features/PlatformSelector.jsx
import { PlatformCard } from '../ui/PlatformCard';
import { usePlatforms } from '../contexts/PlatformContext';
import { useStatus } from '../contexts/StatusContext';

export function PlatformSelector() {
  const { platforms, selectedPlatformId, selectPlatform, isLoading } = usePlatforms();
  const { notifyPlatformChanged } = useStatus();
  
  const handlePlatformSelect = async (platformId) => {
    if (platformId === selectedPlatformId) return;
    
    const success = await selectPlatform(platformId);
    if (success) {
      const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
      notifyPlatformChanged(platformName);
    }
  };
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="h-16 bg-background-surface animate-pulse rounded-md border border-border"
          />
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-3 gap-1">
      {platforms.map((platform) => (
        <PlatformCard
          key={platform.id}
          id={platform.id}
          name={platform.name}
          iconUrl={platform.iconUrl}
          selected={platform.id === selectedPlatformId}
          onClick={handlePlatformSelect}
        />
      ))}
    </div>
  );
}