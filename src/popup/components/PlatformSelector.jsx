// src/popup/components/PlatformSelector.jsx
import PropTypes from 'prop-types';

import { usePopupPlatform } from '../../contexts/platform';
import { useStatus } from '../contexts/StatusContext';
import { PlatformLogoItem } from '../../components/layout/PlatformLogoItem';

export function PlatformSelector({ disabled }) {
  const { platforms, selectedPlatformId, selectPlatform } = usePopupPlatform();
  const { notifyPlatformChanged } = useStatus();

  const handlePlatformSelect = (platformId) => {
    if (!disabled && platformId !== selectedPlatformId) {
      // No await here - let the UI update optimistically.
      // The selectPlatform hook updates state immediately, then saves to storage.
      selectPlatform(platformId).then((success) => {
        if (success) {
          const platformName =
            platforms.find((p) => p.id === platformId)?.name || platformId;
          notifyPlatformChanged(platformName);
        }
      });
    }
  };

  return (
    <div
      className={`platform-selector-container transition-opacity duration-200 ${disabled ? 'opacity-50' : ''}`}
    >
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

PlatformSelector.propTypes = {
  disabled: PropTypes.bool,
};
