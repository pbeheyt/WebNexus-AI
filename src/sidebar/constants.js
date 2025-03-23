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

// Message roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};