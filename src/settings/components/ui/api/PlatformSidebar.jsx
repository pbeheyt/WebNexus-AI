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
      <h3 className="text-lg font-medium mb-4">AI Platforms</h3>
      
      <ul className="platform-list space-y-2">
        {platforms.map(platform => (
          <li
            key={platform.id}
            className={`platform-item flex items-center p-3 rounded-lg cursor-pointer transition-colors relative ${
              platform.id === selectedPlatformId
                ? 'selected bg-theme-active'
                : 'hover:bg-theme-hover'
            } ${credentials[platform.id] ? 'has-credentials' : ''}`}
            onClick={() => onSelectPlatform(platform.id)}
          >
            {platform.iconUrl ? (
              <PlatformIcon 
                platformId={platform.id} 
                iconUrl={platform.iconUrl} 
                altText={`${platform.name} icon`} 
                className="platform-icon w-6 h-6 mr-3" 
              />
            ) : (
              <div className="platform-icon-placeholder w-6 h-6 mr-3 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">
                {platform.name.charAt(0)}
              </div>
            )}
            
            <span className="platform-name">{platform.name}</span>
            
            {credentials[platform.id] && (
              <span className="credentials-badge absolute right-3 flex w-4 h-4 items-center justify-center rounded-full bg-success text-white text-xs font-bold">
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
