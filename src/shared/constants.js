// src/shared/constants.js

/**
 * Content types used throughout the extension
 */
export const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf',
  SELECTED_TEXT: 'selected_text'
};

/**
 * Shared prompt type - accessible across all content types
 */
export const SHARED_TYPE = 'shared';

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

  // Service
  THEME_PREFERENCE: 'theme_preference',
  SHORTCUT_SETTINGS: 'shortcut_settings',
  API_ADVANCED_SETTINGS: 'api_advanced_settings',
  API_CREDENTIALS: 'api_credentials',
  API_MODE_PREFERENCE: 'api_mode_preference',
  TEMPLATE_CONFIG: 'template_configuration',

  // Prompt
  PRE_PROMPT: 'prePrompt',
  PROMPT_TYPE_PREFERENCE: 'prompt_type_preference',
  SELECTED_PROMPT_IDS: 'selected_prompt_ids',
  QUICK_PROMPTS: 'quick_prompts',
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPT_PREFERENCES: 'default_prompt_preferences',

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
  
  // Sidebar
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
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
  DEFAULT: 'default',
  CUSTOM: 'custom',
  QUICK: 'quick'
};

/**
 * Default shortcut settings
 */
export const DEFAULT_SHORTCUT_SETTINGS = {
  content_processing_behavior: 'selection'
};