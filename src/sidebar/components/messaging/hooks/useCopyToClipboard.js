import { useState, useRef, useCallback, useEffect } from 'react';

import logger from '../../../../shared/logger';
import { copyToClipboard } from '../utils/clipboard.js';
import { CopyIcon, CheckIcon, XIcon } from '../../../../components/index.js';

export const useCopyToClipboard = (textToCopy) => {
  const [copyState, setCopyState] = useState('idle');
  const [displayIconState, setDisplayIconState] = useState('idle');
  const timeoutRef = useRef(null);
  const visualResetTimeoutRef = useRef(null);

  const handleCopy = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      await copyToClipboard(textToCopy);
      setCopyState('copied');
      setDisplayIconState('copied');
    } catch (error) {
      logger.sidebar.error('Failed to copy text:', error);
      setCopyState('error');
      setDisplayIconState('error');
    }

    timeoutRef.current = setTimeout(() => {
      setCopyState('idle');
    }, 1500);
  }, [textToCopy]);

  useEffect(() => {
    if (copyState === 'idle') {
      if (visualResetTimeoutRef.current) {
        clearTimeout(visualResetTimeoutRef.current);
      }
      visualResetTimeoutRef.current = setTimeout(() => {
        setDisplayIconState('idle');
      }, 300);
    }

    return () => {
      if (visualResetTimeoutRef.current) {
        clearTimeout(visualResetTimeoutRef.current);
      }
    };
  }, [copyState]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (visualResetTimeoutRef.current) {
        clearTimeout(visualResetTimeoutRef.current);
      }
    };
  }, []);

  let IconComponent = CopyIcon;
  let iconClassName = '';

  if (displayIconState === 'copied') {
    IconComponent = CheckIcon;
    iconClassName = 'text-green-600 dark:text-green-400';
  } else if (displayIconState === 'error') {
    IconComponent = XIcon;
    iconClassName = 'text-red-500 dark:text-red-400';
  }

  return {
    copyState,
    handleCopy,
    IconComponent,
    iconClassName,
    disabled: copyState !== 'idle',
  };
};
