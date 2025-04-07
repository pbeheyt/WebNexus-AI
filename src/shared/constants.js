// src/shared/constants.js

/**
 * Content types used throughout the extension
 */
export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf'
};

/**
 * Shared prompt type - accessible across all content types
 */
export const SHARED_TYPE = 'shared';

/**
 * User-friendly labels for content types
 */
export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Post',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Video',
  [CONTENT_TYPES.PDF]: 'PDF Document',
  [SHARED_TYPE]: 'Shared Prompts'
};

/**
 * AI platforms supported by the extension
 */
export const AI_PLATFORMS = {
  CLAUDE: 'claude',
  CHATGPT: 'chatgpt',
  DEEPSEEK: 'deepseek',
  MISTRAL: 'mistral',
  GEMINI: 'gemini',
  GROK: 'grok'
};

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  // Content
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  SCRIPT_INJECTED: 'scriptInjected',
  TAB_FORMATTED_CONTENT: 'tab_formatted_content',
  FORMATTED_CONTENT_FOR_INJECTION: 'formatted_content_for_injection',

  // Service
  THEME_PREFERENCE: 'theme_preference',
  SHORTCUT_SETTINGS: 'shortcut_settings',
  API_ADVANCED_SETTINGS: 'api_advanced_settings',
  API_CREDENTIALS: 'api_credentials',

  // Prompt
  PRE_PROMPT: 'prePrompt',
  SELECTED_PROMPT_IDS: 'selected_prompt_ids',
  QUICK_PROMPTS: 'quick_prompts',
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPTS_INIT_FLAG: 'default_prompts_initialized_v1',

  // Platform
  INJECTION_PLATFORM: 'injectionPlatform',
  INJECTION_PLATFORM_TAB_ID: 'injectionPlatformTabId',
  POPUP_PLATFORM: 'popup_platform',
  SIDEBAR_PLATFORM: 'sidebar_platform_preference',
  SIDEBAR_MODEL: 'sidebar_model_preferences',
  TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
  TAB_MODEL_PREFERENCES: 'tab_model_preferences',
  LAST_ACTIVE_TAB: 'last_active_tab',
  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  
  // API
  API_PROCESSING_STATUS: 'apiProcessingStatus',
  API_RESPONSE: 'apiResponse',
  API_PROCESSING_ERROR: 'apiProcessingError',
  API_RESPONSE_TIMESTAMP: 'apiResponseTimestamp',
  CURRENT_CONTENT_PROCESSING_MODE: 'currentContentProcessingMode',
  API_CONTENT_PROCESSING_PLATFORM: 'apiContentProcessingPlatform',
  API_CONTENT_PROCESSING_TIMESTAMP: 'apiContentProcessingTimestamp',
  TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
  
  // Sidebar
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
  TAB_TOKEN_STATISTICS: 'tab_token_statistics',
  STREAM_CONTENT: 'streamContent',
  STREAM_ID: 'streamId',
};

/**
 * Interface sources for API requests
 */
export const INTERFACE_SOURCES = {
  POPUP: 'popup',
  SIDEBAR: 'sidebar'
};

/**
 * Prompt types
 */
export const PROMPT_TYPES = {
  CUSTOM: 'custom',
  QUICK: 'quick'
};
