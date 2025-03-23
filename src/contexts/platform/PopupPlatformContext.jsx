// src/contexts/platform/PopupPlatformContext.jsx
import { createTabAwarePlatformContext } from './TabAwarePlatformContext';
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

const { 
  TabAwarePlatformProvider: PopupPlatformProvider, 
  useTabAwarePlatform: usePopupPlatform 
} = createTabAwarePlatformContext({
  interfaceType: INTERFACE_SOURCES.POPUP,
  globalStorageKey: STORAGE_KEYS.PREFERRED_PLATFORM
});

export { PopupPlatformProvider, usePopupPlatform };