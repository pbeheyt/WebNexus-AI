// src/contexts/platform/SidebarPlatformContext.jsx
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

import { createTabAwarePlatformContext } from './TabAwarePlatformContext';

const {
  TabAwarePlatformProvider: SidepanelPlatformProvider,
  useTabAwarePlatform: useSidepanelPlatform,
} = createTabAwarePlatformContext({
  interfaceType: INTERFACE_SOURCES.SIDEBAR,
  globalStorageKey: STORAGE_KEYS.SIDEBAR_DEFAULT_PLATFORM_ID,
});

export { SidepanelPlatformProvider, useSidepanelPlatform };
