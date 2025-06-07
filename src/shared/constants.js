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
  // --- UI Preferences ---
  /** @description User's preferred theme (e.g., 'light', 'dark'). Synced across devices. */
  THEME_PREFERENCE: 'theme_preference',
  /** @description User's preferred text size (e.g., 'sm', 'base', 'lg'). Synced across devices. */
  TEXT_SIZE_PREFERENCE: 'text_size_preference',
  /** @description ID of the default/last-selected AI platform for the Popup. Synced across devices. */
  POPUP_DEFAULT_PLATFORM_ID: 'popup_default_platform_id',
  /** @description ID of the default/last-selected AI platform for the Sidepanel (global). Synced across devices. */
  SIDEPANEL_DEFAULT_PLATFORM_ID: 'sidepanel_default_platform_id',
  /** @description Map of { platformId: modelId } for default/last-selected models in the Sidepanel. Synced. */
  SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM:
    'sidepanel_default_model_id_by_platform',
  /** @description User's preference for enabling "thinking mode" in the Sidepanel, stored as { platformId: { modelId: boolean } }. Synced. */
  SIDEPANEL_THINKING_MODE_PREFERENCE: 'sidepanel_thinking_mode_preference',
  /** @description User's custom keyboard shortcut configuration for toggling the sidepanel. Synced. */
  CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT: 'custom_sidepanel_toggle_shortcut_config',

  // --- Core Settings ---
  /** @description User-configured model parameters (temperature, maxTokens, etc.) for each platform/model. Local. */
  MODEL_PARAMETER_SETTINGS: 'model_parameter_settings',
  /** @description API keys for different AI platforms. Local. */
  API_CREDENTIALS: 'api_credentials',

  // --- Prompts & WebUI Injection State ---
  /** @description The prompt content to be auto-filled when opening an AI platform's Web UI. Local. */
  WEBUI_INJECTION_PROMPT_CONTENT: 'webui_injection_prompt_content',
  /** @description Stores all user-created custom prompts, organized by content type. Local. */
  USER_CUSTOM_PROMPTS: 'user_custom_prompts',
  /** @description Flag indicating if initial default prompts have been populated from config. Local. */
  INITIAL_PROMPTS_POPULATED_FLAG: 'initial_prompts_populated_flag',

  // --- Content Extraction State ---
  /** @description Flag indicating if content has been successfully extracted from the current page. Local. */
  CONTENT_READY_FLAG: 'content_ready_flag',
  /** @description Object containing the extracted content from the current page. Local. */
  EXTRACTED_CONTENT: 'extracted_content',
  /** @description User's preferred strategy for general web content extraction ('focused' or 'broad'). Synced. */
  GENERAL_CONTENT_EXTRACTION_STRATEGY: 'general_content_extraction_strategy',

  // --- WebUI Injection Specific State (Content sent to AI platform websites) ---
  /** @description Flag indicating if the content script for Web UI injection has been successfully injected. Local. */
  WEBUI_INJECTION_SCRIPT_INJECTED_FLAG:
    'webui_injection_script_injected_flag',
  /** @description The formatted content string prepared for Web UI injection. Local. */
  WEBUI_INJECTION_FORMATTED_CONTENT: 'webui_injection_formatted_content',
  /** @description The ID of the AI platform targeted for Web UI injection. Local. */
  WEBUI_INJECTION_PLATFORM_ID: 'webui_injection_platform_id',
  /** @description The tab ID of the AI platform's website opened for Web UI injection. Local. */
  WEBUI_INJECTION_TARGET_TAB_ID: 'webui_injection_target_tab_id',

  // --- API Processing State (Direct API calls from Sidepanel) ---
  /** @description Current status of API processing (e.g., 'streaming', 'completed', 'error'). Local. */
  API_PROCESSING_STATUS: 'api_processing_status',
  /** @description The response object or content received from the API. Local. */
  API_RESPONSE: 'api_response',
  /** @description Error message if API processing failed. Local. */
  API_PROCESSING_ERROR: 'api_processing_error',
  /** @description Timestamp of the last API response. Local. */
  API_RESPONSE_TIMESTAMP: 'api_response_timestamp',
  /** @description Unique identifier for an active API stream. Local. */
  API_STREAM_ID: 'api_stream_id',
  // --- Global Chat Session Data ---
  /** @description Stores all global chat sessions. Keyed by chatSessionId. Local. */
  GLOBAL_CHAT_SESSIONS: 'global_chat_sessions',
  /** @description Stores token statistics for each global chat session. Keyed by chatSessionId. Local. */
  GLOBAL_CHAT_TOKEN_STATS: 'global_chat_token_stats',

  // --- Tab-Specific Data (Primarily for Sidepanel context persistence per tab) ---
  /** @description Formatted page content specific to a tab, for Sidepanel context. Local. */
  TAB_FORMATTED_CONTENT: 'tab_formatted_content',
  /** @description Chat history for each tab's Sidepanel instance. Local. */
  // DEPRECATED_FOR_GLOBAL_HISTORY: TAB_CHAT_HISTORIES: 'tab_chat_histories',

  /** @description Token usage statistics for each tab's Sidepanel instance. Local. */
  // DEPRECATED_FOR_GLOBAL_HISTORY: TAB_TOKEN_STATISTICS: 'tab_token_statistics',
  /** @description Visibility state (true/false) of the Sidepanel for each tab. Local. */
  TAB_SIDEPANEL_STATES: 'tab_sidepanel_states',
  // --- Identifiers & Prefixes ---
  CHAT_SESSION_ID_PREFIX: 'chat_', // Used for generating global chat session IDs
};

// Prompt limits
export const MAX_PROMPTS_PER_TYPE = 10;
export const MAX_PROMPT_NAME_LENGTH = 100;
export const MAX_PROMPT_CONTENT_LENGTH = 100000;
export const MAX_SYSTEM_PROMPT_LENGTH = 100000;

// Chat History Limits
export const MAX_MESSAGES_PER_TAB_HISTORY = 200;

/**
 * Interface sources for API requests
 */
export const INTERFACE_SOURCES = {
  POPUP: 'popup',
  SIDEPANEL: 'sidepanel',
};

/**
 * Sidepanel message types
 */
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

// Default value for the custom sidepanel toggle shortcut, not the storage key itself
export const DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG = {
  key: 's',
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
};

/**
 * General content extraction strategies
 */
export const EXTRACTION_STRATEGIES = {
  BROAD: 'broad',
  FOCUSED: 'focused',
};

export const DEFAULT_EXTRACTION_STRATEGY = EXTRACTION_STRATEGIES.BROAD;