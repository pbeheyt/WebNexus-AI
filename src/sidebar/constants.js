// Message types for iframe-parent communication
export const MESSAGE_TYPES = {
  // Sidebar → Parent
  SIDEBAR_READY: 'SIDEBAR_READY',
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  
  // Parent → Sidebar
  EXTRACTION_COMPLETE: 'EXTRACTION_COMPLETE',
  PAGE_INFO_UPDATED: 'PAGE_INFO_UPDATED',
  THEME_CHANGED: 'THEME_CHANGED',
  SIDEBAR_STATE_CHANGED: 'SIDEBAR_STATE_CHANGED'
};

// Local storage keys
export const STORAGE_KEYS = {
  // SIDEBAR_PLATFORM: 'sidebar_platform_preference',
  // SIDEBAR_MODEL: 'sidebar_model_preference',
  // CHAT_HISTORY: 'sidebar_chat_history',
  // TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  // THEME: 'ui_preferences.theme'
};

// Message roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};