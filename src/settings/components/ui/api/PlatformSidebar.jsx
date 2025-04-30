// src/settings/components/ui/platforms/PlatformSidebar.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { PlatformIcon, CheckIcon } from '../../../../components';

const PlatformSidebar = ({
  platforms,
  selectedPlatformId,
  credentials,
  onSelectPlatform,
}) => {
  return (
    <div className='platform-sidebar flex-none border-r border-theme pr-5'>
      <h3 className='text-lg font-medium mb-4 text-theme-primary'>
        AI Platforms
      </h3>

      <ul className='platform-list space-y-2'>
        {platforms.map((platform) => (
          // Changed from li to button
          <button
            type='button'
            key={platform.id}
            className={`platform-item flex items-center pl-3 pr-8 py-3 rounded-lg cursor-pointer select-none transition-colors relative border border-theme w-full text-left ${
              platform.id === selectedPlatformId
                ? ' bg-gray-100 dark:bg-gray-700 shadow-sm'
                : ' bg-white dark:bg-theme-surface'
            } ${credentials[platform.id] ? 'has-credentials' : ''}`}
            onClick={() => onSelectPlatform(platform.id)}
          >
            {/* Icon and Name container */}
            <div className='flex items-center flex-grow min-w-0 mr-3'>
              {platform.iconUrl ? (
                <PlatformIcon
                  platformId={platform.id}
                  iconUrl={platform.iconUrl}
                  altText={`${platform.name} icon`}
                  className='platform-icon w-6 h-6 mr-3 flex-shrink-0'
                />
              ) : (
                <div className='platform-icon-placeholder w-6 h-6 mr-3 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold flex-shrink-0'>
                  {platform.name.charAt(0)}
                </div>
              )}

              {/* Platform name with truncate */}
              <span className='platform-name text-theme-secondary truncate'>
                {platform.name}
              </span>
            </div>

            {/* Conditionally rendered CheckIcon */}
            {credentials[platform.id] && (
              <CheckIcon className='absolute right-3 top-1/2 transform -translate-y-1/2 text-primary w-5 h-5 flex-shrink-0' />
            )}
          </button>
        ))}
      </ul>
    </div>
  );
};

PlatformSidebar.propTypes = {
  platforms: PropTypes.array.isRequired,
  selectedPlatformId: PropTypes.string,
  credentials: PropTypes.object.isRequired,
  onSelectPlatform: PropTypes.func.isRequired,
};

export default PlatformSidebar;
