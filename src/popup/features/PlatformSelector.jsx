// src/popup/features/PlatformSelector.jsx
import { usePopupPlatform } from '../../contexts/platform';
import { useStatus } from '../contexts/StatusContext';
import { PlatformCard } from '../../components/layout/PlatformCard';

export function PlatformSelector() {
  const { platforms, selectedPlatformId, selectPlatform, isLoading } = usePopupPlatform();
  const { notifyPlatformChanged } = useStatus();
  
  const handlePlatformSelect = async (platformId) => {
    if (platformId === selectedPlatformId) return;
    
    const success = await selectPlatform(platformId);
    if (success) {
      const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
      notifyPlatformChanged(platformName);
    }
  };
  
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
          // Not enabling credential checks for popup
          checkCredentials={false}
        />
      ))}
    </div>
  );
}
