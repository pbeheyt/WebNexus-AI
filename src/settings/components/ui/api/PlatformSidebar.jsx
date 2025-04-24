// src/settings/components/ui/platforms/PlatformSidebar.jsx
import React from 'react';
import { PlatformIcon } from '../../../../components';

const PlatformSidebar = ({
  platforms,
  selectedPlatformId,
  credentials,
  onSelectPlatform
}) => {
  return (
    <div className="platform-sidebar flex-none w-60 border-r border-theme pr-5">
      <h3 className="text-lg font-medium mb-4 text-theme-primary">AI Platforms</h3>
      
      <ul className="platform-list space-y-2">
        {platforms.map(platform => (
          <li
            key={platform.id}
            className={`platform-item flex items-center p-3 rounded-lg cursor-pointer select-none transition-colors relative border border-theme ${
              platform.id === selectedPlatformId
              ? ' bg-gray-100 dark:bg-gray-700 shadow-sm'
              : ' bg-white dark:bg-theme-surface'
            } ${credentials[platform.id] ? 'has-credentials' : ''}`}
            onClick={() => onSelectPlatform(platform.id)}
          >
            {platform.iconUrl ? (
              <PlatformIcon
                platformId={platform.id}
                iconUrl={platform.iconUrl}
                altText={`${platform.name} icon`}
                className="platform-icon w-6 h-6 mr-3 flex-shrink-0"
              />
            ) : (
              <div className="platform-icon-placeholder w-6 h-6 mr-3 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold flex-shrink-0">
                {platform.name.charAt(0)}
              </div>
            )}
            
            <span className="platform-name text-theme-secondary truncate">
                {platform.name}
            </span>
            
            {/* Credential badge remains unchanged */}
            {credentials[platform.id] && (
              <span className="credentials-badge absolute right-3 top-1/2 transform -translate-y-1/2 flex w-4 h-4 items-center justify-center rounded-full bg-success text-white text-xs font-bold">
                ✓
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlatformSidebar;