// src/settings/utils/constants.js

import { CONTENT_TYPES, STORAGE_KEYS } from '../../shared/constants.js';

// Re-export shared constants for backwards compatibility
export { CONTENT_TYPES };

export const STORAGE_KEY = STORAGE_KEYS.CUSTOM_PROMPTS;

export const TABS = {
  CONTENT_CONFIGURATION: 'content-configuration',
  PROMPT_MANAGEMENT: 'prompt-management',
  TEMPLATE_CUSTOMIZATION: 'template-customization'
};

// Human-readable labels for content types
export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Posts',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Videos',
  [CONTENT_TYPES.PDF]: 'PDF Documents',
  [CONTENT_TYPES.SELECTED_TEXT]: 'Selected Text'
};

// Default settings for each content type
export const DEFAULT_SETTINGS = {
  [CONTENT_TYPES.GENERAL]: {},
  [CONTENT_TYPES.REDDIT]: { maxComments: 100 },
  [CONTENT_TYPES.YOUTUBE]: { maxComments: 20 },
  [CONTENT_TYPES.PDF]: {},
  [CONTENT_TYPES.SELECTED_TEXT]: {}
};