// src/settings/utils/constants.js
export const STORAGE_KEY = 'custom_prompts_by_type';

export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

export const TABS = {
  CONTENT_CONFIGURATION: 'content-configuration',
  PROMPT_MANAGEMENT: 'prompt-management'
};

export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Posts',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Videos'
};

export const DEFAULT_SETTINGS = {
  [CONTENT_TYPES.GENERAL]: {},
  [CONTENT_TYPES.REDDIT]: { maxComments: 100 },
  [CONTENT_TYPES.YOUTUBE]: { maxComments: 50 }
};