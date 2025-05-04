// src/contexts/platform/PopupPlatformContext.jsx
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

import { createTabAwarePlatformContext } from './TabAwarePlatformContext';

const {
  TabAwarePlatformProvider: PopupPlatformProvider,
  useTabAwarePlatform: usePopupPlatform,
} = createTabAwarePlatformContext({
  interfaceType: INTERFACE_SOURCES.POPUP,
  globalStorageKey: STORAGE_KEYS.POPUP_PLATFORM,
});

export { PopupPlatformProvider, usePopupPlatform };
