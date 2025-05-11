// src/settings/components/ui/ShortcutCaptureInput.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

const MODIFIER_KEYS = ['alt', 'ctrl', 'shift', 'meta'];
const FUNCTION_KEYS_REGEX = /^f([1-9]|1[0-2])$/i; // F1-F12
const ALLOWED_NON_MODIFIER_KEYS_REGEX = /^[a-z0-9]$/i; // Letters and numbers

function formatShortcutToStringDisplay(shortcutObj) {
  if (!shortcutObj || !shortcutObj.key) return '';
  const parts = [];
  if (shortcutObj.metaKey) parts.push('Cmd'); // Order for display
  if (shortcutObj.ctrlKey) parts.push('Ctrl');
  if (shortcutObj.altKey) parts.push('Alt');
  if (shortcutObj.shiftKey) parts.push('Shift');
  
  let displayKey = shortcutObj.key.toLowerCase();
  if (displayKey === ' ') displayKey = 'Space';
  else if (displayKey.startsWith('arrow')) displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1); // ArrowUp, ArrowDown etc.
  else displayKey = displayKey.toUpperCase();

  parts.push(displayKey);
  return parts.join(' + ');
}

export function ShortcutCaptureInput({ value, onChange, defaultShortcut }) {
  const [inputValue, setInputValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const inputRef = useRef(null);

  const [currentShortcut, setCurrentShortcut] = useState(value || defaultShortcut);

  useEffect(() => {
    // Update internal state if prop 'value' changes from outside
    if (value && JSON.stringify(value) !== JSON.stringify(currentShortcut)) {
      setCurrentShortcut(value);
      setInputValue(formatShortcutToStringDisplay(value));
    } else if (!value && JSON.stringify(defaultShortcut) !== JSON.stringify(currentShortcut)) {
      // If value becomes null/undefined, reset to default
      setCurrentShortcut(defaultShortcut);
      setInputValue(formatShortcutToStringDisplay(defaultShortcut));
    }
  }, [value, defaultShortcut, currentShortcut]);


  useEffect(() => {
    // Initialize inputValue based on currentShortcut (which is derived from props.value or defaultShortcut)
    setInputValue(formatShortcutToStringDisplay(currentShortcut));
  }, [currentShortcut]);


  const handleFocus = () => {
    setIsCapturing(true);
    setInputValue('Press desired keys...');
  };

  const handleBlur = () => {
    setIsCapturing(false);
    // Revert to displaying the current committed shortcut if nothing valid was pressed
    setInputValue(formatShortcutToStringDisplay(currentShortcut));
  };

  const handleKeyDown = useCallback((event) => {
    if (!isCapturing) return;

    event.preventDefault();
    event.stopPropagation();

    const pressedKey = event.key.toLowerCase();

    // Ignore if it's just a modifier key press without a main key yet
    if (MODIFIER_KEYS.includes(pressedKey) || pressedKey === 'control' || pressedKey === 'altgraph') {
      // Display current modifiers being held
      const tempShortcut = {
        key: '...', // Placeholder for main key
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      };
      setInputValue(formatShortcutToStringDisplay(tempShortcut));
      return;
    }
    
    // Check if it's a valid main key (letter, number, or F-key)
    if (!ALLOWED_NON_MODIFIER_KEYS_REGEX.test(pressedKey) && !FUNCTION_KEYS_REGEX.test(pressedKey) && pressedKey !== ' ') {
        // For other special keys like ArrowUp, Escape, etc., you might want to allow them.
        // For now, let's restrict to letters, numbers, space, and F-keys for simplicity with modifiers.
        // If you want to support more, expand ALLOWED_NON_MODIFIER_KEYS_REGEX or add more checks.
      setInputValue('Invalid key. Use A-Z, 0-9, F1-F12, Space with modifiers.');
      // Reset to previous valid shortcut after a delay, or on blur
      setTimeout(() => {
        if (isCapturing) setInputValue('Press desired keys...'); // Go back to listening state
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
    
    // Basic validation: At least one modifier OR it's an F-key (F-keys can be standalone)
    // Or if it's a special key like Escape, Space, etc. (currently only space is explicitly allowed above without this check)
    const isFunctionKey = FUNCTION_KEYS_REGEX.test(newShortcut.key);
    if (!isFunctionKey && !newShortcut.altKey && !newShortcut.ctrlKey && !newShortcut.shiftKey && !newShortcut.metaKey) {
      // Allow standalone letter/number if desired, but usually popups shortcuts have modifiers.
      // For now, let's require a modifier for non-F-keys.
      // This logic can be adjusted if standalone keys like "S" are desired.
      // The KeyboardShortcutsTab has a more robust validation on save.
    }

    setCurrentShortcut(newShortcut); // Commit to internal state
    setInputValue(formatShortcutToStringDisplay(newShortcut)); // Update display
    onChange(newShortcut); // Propagate change to parent

    // Optional: blur the input after successful capture
    // inputRef.current?.blur(); 
    // setIsCapturing(false); // if blurring, also set isCapturing to false
  }, [isCapturing, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      readOnly
      placeholder="Click to set shortcut"
      className="w-full px-3 py-2 border border-theme rounded-md shadow-sm bg-theme-surface text-theme-primary focus:ring-primary focus:border-primary sm:text-sm"
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
