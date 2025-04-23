// src/popup/components/PlatformSelector.jsx
import { usePopupPlatform } from '../../contexts/platform';
import { useStatus } from '../contexts/StatusContext';
import { PlatformLogoItem } from '../../components/layout/PlatformLogoItem';

export function PlatformSelector({ disabled }) {
  const { platforms, selectedPlatformId, selectPlatform } = usePopupPlatform();
  const { notifyPlatformChanged } = useStatus();
  
  const handlePlatformSelect = async (platformId) => {
    if (!disabled && platformId !== selectedPlatformId) {
      const success = await selectPlatform(platformId);
      if (success) {
        const platformName = platforms.find(p => p.id === platformId)?.name || platformId;
        notifyPlatformChanged(platformName);
      }
    }
  };
  
  return (
    <div className="flex items-end justify-center px-5 py-3 min-h-[50px] transition-opacity duration-200 {disabled ? 'opacity-50' : ''}">
      {platforms.map((platform) => (
        <PlatformLogoItem
          key={platform.id}
          id={platform.id}
          name={platform.name}
          iconUrl={platform.iconUrl}
          isSelected={platform.id === selectedPlatformId}
          onClick={handlePlatformSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
