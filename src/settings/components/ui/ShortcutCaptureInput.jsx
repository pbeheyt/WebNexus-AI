// src/settings/components/ui/ShortcutCaptureInput.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

import { formatShortcutToStringDisplay } from '../../../shared/utils/shortcut-utils';

const MODIFIER_KEYS = ['alt', 'ctrl', 'shift', 'meta'];
const FUNCTION_KEYS_REGEX = /^f([1-9]|1[0-2])$/i; // F1-F12
const ALLOWED_NON_MODIFIER_KEYS_REGEX = /^[a-z0-9]$/i; // Letters and numbers

export function ShortcutCaptureInput({ value, onChange, defaultShortcut }) {
  const [inputValue, setInputValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const inputRef = useRef(null);

  const [currentShortcut, setCurrentShortcut] = useState(
    value || defaultShortcut
  );

  useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(currentShortcut)) {
      setCurrentShortcut(value);
      setInputValue(formatShortcutToStringDisplay(value));
    } else if (
      !value &&
      JSON.stringify(defaultShortcut) !== JSON.stringify(currentShortcut)
    ) {
      setCurrentShortcut(defaultShortcut);
      setInputValue(formatShortcutToStringDisplay(defaultShortcut));
    }
  }, [value, defaultShortcut, currentShortcut]);

  useEffect(() => {
    setInputValue(formatShortcutToStringDisplay(currentShortcut));
  }, [currentShortcut]);

  const handleFocus = () => {
    setIsCapturing(true);
    setInputValue('Press keys...');
  };

  const handleBlur = () => {
    setIsCapturing(false);
    setInputValue(formatShortcutToStringDisplay(currentShortcut));
  };

  const handleKeyDown = useCallback(
    (event) => {
      if (!isCapturing) return;

      event.preventDefault();
      event.stopPropagation();

      const pressedKey = event.key.toLowerCase();

      if (
        MODIFIER_KEYS.includes(pressedKey) ||
        pressedKey === 'control' ||
        pressedKey === 'altgraph'
      ) {
        const tempShortcut = {
          key: '...',
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
        };
        setInputValue(formatShortcutToStringDisplay(tempShortcut));
        return;
      }

      if (
        !ALLOWED_NON_MODIFIER_KEYS_REGEX.test(pressedKey) &&
        !FUNCTION_KEYS_REGEX.test(pressedKey) &&
        pressedKey !== ' '
      ) {
        setInputValue(
          'Invalid key. Use A-Z, 0-9, F1-F12, Space with modifiers.'
        );
        setTimeout(() => {
          if (isCapturing) setInputValue('Press keys...');
        }, 1500);
        return;
      }

      const newShortcut = {
        key: pressedKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      };

      setCurrentShortcut(newShortcut);
      setInputValue(formatShortcutToStringDisplay(newShortcut));
      onChange(newShortcut);
    },
    [isCapturing, onChange]
  );

  return (
    <input
      ref={inputRef}
      type='text'
      value={inputValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      readOnly
      placeholder='Click to set shortcut'
      className='w-full px-3 py-2 border border-theme rounded-md bg-theme-hover text-theme-primary focus:ring-primary focus:border-primary sm:text-sm'
    />
  );
}

ShortcutCaptureInput.propTypes = {
  value: PropTypes.shape({
    key: PropTypes.string,
    altKey: PropTypes.bool,
    ctrlKey: PropTypes.bool,
    shiftKey: PropTypes.bool,
    metaKey: PropTypes.bool,
  }),
  onChange: PropTypes.func.isRequired,
  defaultShortcut: PropTypes.shape({
    key: PropTypes.string,
    altKey: PropTypes.bool,
    ctrlKey: PropTypes.bool,
    shiftKey: PropTypes.bool,
    metaKey: PropTypes.bool,
  }).isRequired,
};

export default ShortcutCaptureInput;
