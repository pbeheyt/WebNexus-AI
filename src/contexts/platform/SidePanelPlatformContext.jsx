// src/contexts/platform/SidepanelPlatformContext.jsx
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../../shared/constants';

import { createTabAwarePlatformContext } from './TabAwarePlatformContext';

const {
  TabAwarePlatformProvider: SidePanelPlatformProvider,
  useTabAwarePlatform: useSidePanelPlatform,
} = createTabAwarePlatformContext({
  interfaceType: INTERFACE_SOURCES.SIDEPANEL,
  globalStorageKey: STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID,
});

export { SidePanelPlatformProvider, useSidePanelPlatform };
