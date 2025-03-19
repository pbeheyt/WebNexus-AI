import { PlatformCard } from '../ui/PlatformCard';
import { usePlatforms } from '../context/PlatformContext';

export function PlatformSelector() {
  const { platforms, selectedPlatformId, selectPlatform, isLoading } = usePlatforms();
  
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
          onClick={selectPlatform}
        />
      ))}
    </div>
  );
}