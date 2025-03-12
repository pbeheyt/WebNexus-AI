// popup/constants.js
export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube'
};

export const STORAGE_KEYS = {
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPT_PREFERENCES: 'default_prompt_preferences',
  PREFERRED_PLATFORM: 'preferred_ai_platform',
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  AI_PLATFORM_TAB_ID: 'aiPlatformTabId',
  SCRIPT_INJECTED: 'scriptInjected',
  PRE_PROMPT: 'prePrompt'
};

export const PARAMETER_LABELS = {
  length: 'Summary Length',
  style: 'Style',
  language: 'Language',
  commentAnalysis: 'Include Comment Analysis',
  additionalContext: 'Include Additional Context'
};

export const PARAMETER_OPTIONS_LABELS = {
  length: {
    concise: 'Concise',
    normal: 'Normal',
    detailed: 'Detailed'
  },
  style: {
    narrative: 'Narrative',
    bulletPoints: 'Bullet Points',
    analytical: 'Analytical'
  },
  language: {
    english: 'English',
    french: 'French',
    spanish: 'Spanish',
    german: 'German'
  },
  commentAnalysis: {
    true: 'Yes',
    false: 'No'
  },
  additionalContext: {
    true: 'Yes',
    false: 'No'
  }
};