// src/settings/utils/constants.js
import { SHARED_TYPE } from '../../shared/constants.js';

// Export content types and storage key constants
export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf',
  SELECTED_TEXT: 'selected_text'
};

export const STORAGE_KEY = 'custom_prompts_by_type';

export const TABS = {
  CONTENT_CONFIGURATION: 'content-configuration',
  PROMPT_MANAGEMENT: 'prompt-management',
  TEMPLATE_CUSTOMIZATION: 'template-customization',
  SHORTCUTS: 'shortcuts',
  API_SETTINGS: 'api-settings'
};

// Human-readable labels for content types
export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Posts',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Videos',
  [CONTENT_TYPES.PDF]: 'PDF Documents',
  [CONTENT_TYPES.SELECTED_TEXT]: 'Selected Text',
  [SHARED_TYPE]: 'Shared Prompts'
};

// Default settings for each content type
export const DEFAULT_SETTINGS = {
  [CONTENT_TYPES.GENERAL]: {},
  [CONTENT_TYPES.REDDIT]: { maxComments: 100 },
  [CONTENT_TYPES.YOUTUBE]: { maxComments: 20 },
  [CONTENT_TYPES.PDF]: {},
  [CONTENT_TYPES.SELECTED_TEXT]: {}
};