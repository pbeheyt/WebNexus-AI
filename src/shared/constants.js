// src/shared/constants.js

/**
 * Content types used throughout the extension
 */
export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf',
};

/**
 * User-friendly labels for content types
 */
export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Post',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Video',
  [CONTENT_TYPES.PDF]: 'PDF Document',
};

/**
 * AI platforms supported by the extension
 */
export const AI_PLATFORMS = {
  GEMINI: 'gemini',
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  DEEPSEEK: 'deepseek',
  GROK: 'grok',
  MISTRAL: 'mistral',
};

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  // Preferences
  THEME_PREFERENCE: 'theme_preference',
  TEXT_SIZE_PREFERENCE: 'text_size_preference',
  POPUP_PLATFORM: 'popup_platform_preference',
  SIDEBAR_PLATFORM: 'sidebar_platform_preference',
  SIDEBAR_MODEL: 'sidebar_model_preference',
  SIDEBAR_THINKING_MODE_PREFERENCE: 'sidebar_thinking_mode_preference',

// Settings
MODEL_PARAMETER_SETTINGS: 'model_parameter_settings', // Renamed from API_ADVANCED_SETTINGS
API_CREDENTIALS: 'api_credentials',

  // Prompt
  PRE_PROMPT: 'prePrompt',
  PROMPTS: 'prompts',
  INITIAL_PROMPTS_POPULATED: 'initial_prompts_populated',

  // Content
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  SCRIPT_INJECTED: 'scriptInjected',
  FORMATTED_CONTENT_FOR_INJECTION: 'formatted_content_for_injection',
  INJECTION_PLATFORM: 'injectionPlatform',
  INJECTION_PLATFORM_TAB_ID: 'injectionPlatformTabId',

  // API
  API_PROCESSING_STATUS: 'apiProcessingStatus',
  API_RESPONSE: 'apiResponse',
  API_PROCESSING_ERROR: 'apiProcessingError',
  API_RESPONSE_TIMESTAMP: 'apiResponseTimestamp',
  STREAM_ID: 'streamId',

  // Tabs
  TAB_FORMATTED_CONTENT: 'tab_formatted_content',
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
  TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
  TAB_TOKEN_STATISTICS: 'tab_token_statistics',
  TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
  TAB_MODEL_PREFERENCES: 'tab_model_preferences',
  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  TAB_CONTEXT_SENT_FLAG: 'tab_context_sent_flag',
};

// Prompt limits
export const MAX_PROMPTS_PER_TYPE = 10;
export const MAX_PROMPT_NAME_LENGTH = 100;
export const MAX_PROMPT_CONTENT_LENGTH = 50000;
export const MAX_SYSTEM_PROMPT_LENGTH = 50000;

/**
 * Interface sources for API requests
 */
export const INTERFACE_SOURCES = {
  POPUP: 'popup',
  SIDEBAR: 'sidebar',
};

/**
 * Sidepanel message types
 */
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

export const CUSTOM_POPUP_SIDEBAR_SHORTCUT = 'customPopupSidebarShortcutConfig';
