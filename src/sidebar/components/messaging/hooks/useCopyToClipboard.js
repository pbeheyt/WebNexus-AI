import { useState, useRef, useCallback, useEffect } from 'react';
import { copyToClipboard } from '../utils/clipboard.js';
import { CopyIcon, CheckIcon, XMarkIcon } from '../../../../components/index.js';

export const useCopyToClipboard = (textToCopy) => {
  const [copyState, setCopyState] = useState('idle');
  const timeoutRef = useRef(null);

  const handleCopy = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      await copyToClipboard(textToCopy);
      setCopyState('copied');
    } catch (error) {
      console.error('Failed to copy text:', error);
      setCopyState('error');
    }

    timeoutRef.current = setTimeout(() => {
      setCopyState('idle');
    }, 1000);
  }, [textToCopy]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  let IconComponent = CopyIcon;
  let iconClassName = '';

  if (copyState === 'copied') {
    IconComponent = CheckIcon;
    iconClassName = 'text-green-600 dark:text-green-400';
  } else if (copyState === 'error') {
    IconComponent = XMarkIcon;
    iconClassName = 'text-red-500 dark:text-red-400';
  }

  return {
    copyState,
    handleCopy,
    IconComponent,
    iconClassName,
    disabled: copyState !== 'idle'
  };
};
