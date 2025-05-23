import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
import { StarFilledIcon } from '../icons/StarFilledIcon';
import { StarOutlineIcon } from '../icons/StarOutlineIcon';
import { setDefaultPromptForContentType } from '../../shared/utils/prompt-utils.js';
import { IconButton } from '../core/IconButton';
import { STORAGE_KEYS, CONTENT_TYPE_LABELS } from '../../shared/constants';
import { useNotification } from '../feedback/NotificationContext';
import { logger } from '../../shared/logger';

/**
 * A dropdown component to display and select relevant custom prompts.
 * Simplified positioning to appear directly above the input component.
 */
export function PromptDropdown({
  isOpen,
  onClose,
  onSelectPrompt,
  contentType,
  anchorRef,
  className = '',
  onDefaultSet, // Destructure new prop
}) {
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState(null);
  const [currentDefaultPromptId, setCurrentDefaultPromptId] = useState(null);
  const [settingDefaultInProgress, setSettingDefaultInProgress] = useState(null); // Tracks ID of prompt being set as default
  const notificationContext = useNotification();
  const showNotificationError = notificationContext ? notificationContext.error : (message) => {
    logger.popup.error(`NotificationContext not available. Error: ${message}`);
  };
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef(null);

  // Handle visibility transition
  useEffect(() => {
    let timer;
    if (isOpen) {
      // Use a small delay to ensure initial styles are applied before transition
      timer = setTimeout(() => {
        setIsVisible(true);
      }, 10); // 10ms delay
    } else {
      // Set visibility to false immediately on close
      setIsVisible(false);
    }
    // Cleanup the timer if the component unmounts or isOpen changes
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Fetch relevant prompts and current default when the dropdown opens or content type changes
  useEffect(() => {
    if (isOpen && contentType) {
      setError(null);
      setCurrentDefaultPromptId(null); // Reset while loading
      setSettingDefaultInProgress(null); // Reset in-progress state

      const fetchPromptsAndDefault = async () => {
        try {
          const loadedPrompts = await loadRelevantPrompts(contentType);
          setPrompts(loadedPrompts);

          const storageResult = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
          const customPromptsByType = storageResult[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
          const defaultId = customPromptsByType[contentType]?.['_defaultPromptId_'];
          setCurrentDefaultPromptId(defaultId || null);

        } catch (err) {
          logger.popup.error('Error loading prompts or default in dropdown:', err);
          setError('Failed to load prompts or default setting.');
          showNotificationError('Failed to load prompts or default setting.');
        }
      };
      fetchPromptsAndDefault();
    } else {
      // Reset state when closed or contentType is null
      setPrompts([]);
      setError(null);
      setCurrentDefaultPromptId(null);
      setSettingDefaultInProgress(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contentType, notificationContext]); // Depend on the context itself

  // Handle clicks outside the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleSetAsDefault = async (promptToSet) => {
    if (!promptToSet || settingDefaultInProgress) return;

    setSettingDefaultInProgress(promptToSet.id);
    try {
      const success = await setDefaultPromptForContentType(promptToSet.contentType, promptToSet.id);
      if (success) {
        setCurrentDefaultPromptId(promptToSet.id);
        if (onDefaultSet) {
          const contentTypeLabel = CONTENT_TYPE_LABELS[promptToSet.contentType] || promptToSet.contentType;
          onDefaultSet(promptToSet.name, contentTypeLabel);
        }
        // Do not call onClose() here, let the user see the change.
        // Dropdown will close if they click outside or select a prompt to use.
      } else {
        showNotificationError(`Failed to set "${promptToSet.name}" as default.`);
      }
    } catch (err) {
      logger.popup.error('Error setting default prompt:', err);
      showNotificationError('An error occurred while setting the default prompt.');
    } finally {
      setSettingDefaultInProgress(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className={`absolute bottom-full mb-2 right-0 z-50 bg-theme-surface border border-theme rounded-md shadow-md p-1 w-fit min-w-0 max-w-48 ${className} transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 max-h-[150px] overflow-y-auto' : 'opacity-0 max-h-0 overflow-hidden'}`}
      role='listbox'
      aria-label='Select a prompt'
    >
      {error && <div className='px-3 py-1.5 text-sm text-red-500'>{error}</div>}
      {!error && prompts.length === 0 && (
          <div className={`px-3 py-1.5 ${className} text-theme-muted`}>
            No prompts available.
          </div>
      )}
      {!error &&
        prompts.length > 0 &&
        prompts.map((promptItem) => {
          const isCurrentDefault = promptItem.id === currentDefaultPromptId;
          const isBeingSetAsDefault = settingDefaultInProgress === promptItem.id;

          return (
            <div
              key={promptItem.id}
              className={`flex items-center justify-between px-3 py-1.5 text-theme-base rounded cursor-pointer group ${className} ${promptItem.id === settingDefaultInProgress ? 'opacity-70' : 'hover:bg-theme-hover'}`}
              role='option'
              aria-selected='false'
            >
              <button
                onClick={() => {
                    if (!isBeingSetAsDefault) onSelectPrompt(promptItem);
                }}
                className="flex-grow text-left whitespace-nowrap overflow-hidden text-ellipsis mr-2 disabled:cursor-not-allowed"
                disabled={isBeingSetAsDefault}
              >
                {promptItem.name}
              </button>
              
              {/* Icon Container with fixed width */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {isCurrentDefault ? (
                  <StarFilledIcon
                    className={`w-4 h-4 text-amber-500 ${isBeingSetAsDefault ? 'opacity-50' : ''}`}
                    title="Current default prompt"
                  />
                ) : (
                  <IconButton
                    icon={StarOutlineIcon}
                    onClick={() => handleSetAsDefault(promptItem)}
                    disabled={isBeingSetAsDefault || !!settingDefaultInProgress}
                    // Ensure IconButton itself doesn't add extra space that causes shift
                    className={`p-0.5 rounded text-theme-secondary group-hover:text-amber-500 group-hover:opacity-100 flex items-center justify-center ${isBeingSetAsDefault ? 'animate-pulse' : 'opacity-0 focus-within:opacity-100'}`}
                    iconClassName="w-4 h-4" // Icon size
                    aria-label={`Set "${promptItem.name}" as default prompt`}
                    title={`Set as default`}
                  />
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

PromptDropdown.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectPrompt: PropTypes.func.isRequired,
  contentType: PropTypes.string,
  anchorRef: PropTypes.object,
  className: PropTypes.string,
  onDefaultSet: PropTypes.func, // Callback when a default is set
};
