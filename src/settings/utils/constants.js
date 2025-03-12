// Constants used throughout the settings module
export const STORAGE_KEY = 'custom_prompts_by_type';

export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Posts',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Videos'
};

export const DEFAULT_SETTINGS = {
  [CONTENT_TYPES.GENERAL]: {},
  [CONTENT_TYPES.REDDIT]: { maxComments: 200 },
  [CONTENT_TYPES.YOUTUBE]: { maxComments: 50 }
};