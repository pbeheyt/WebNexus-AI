// src/contexts/platform/SidebarPlatformContext.jsx
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

import { createTabAwarePlatformContext } from './TabAwarePlatformContext';

const {
  TabAwarePlatformProvider: SidebarPlatformProvider,
  useTabAwarePlatform: useSidebarPlatform,
} = createTabAwarePlatformContext({
  interfaceType: INTERFACE_SOURCES.SIDEBAR,
  globalStorageKey: STORAGE_KEYS.SIDEBAR_PLATFORM,
});

export { SidebarPlatformProvider, useSidebarPlatform };
