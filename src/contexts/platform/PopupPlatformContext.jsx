// src/contexts/platform/PopupPlatformContext.jsx
import { createBasePlatformContext } from './BasePlatformContext';
import { STORAGE_KEYS } from '../../shared/constants';

// Create popup platform context with appropriate storage key
const { 
  PlatformProvider: PopupPlatformProvider, 
  usePlatform: usePopupPlatform 
} = createBasePlatformContext({
  storageKey: STORAGE_KEYS.PREFERRED_PLATFORM
});

export { PopupPlatformProvider, usePopupPlatform };