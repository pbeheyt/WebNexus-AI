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
  MISTRAL: 'mistral'
};

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPT_PREFERENCES: 'default_prompt_preferences',
  PREFERRED_PLATFORM: 'preferred_ai_platform',
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  AI_PLATFORM_TAB_ID: 'aiPlatformTabId',
  SCRIPT_INJECTED: 'scriptInjected',
  PRE_PROMPT: 'prePrompt',
  THEME_PREFERENCE: 'theme_preference',
  PROMPT_TYPE_PREFERENCE: 'prompt_type_preference',
  SELECTED_PROMPT_IDS: 'selected_prompt_ids',
  QUICK_PROMPTS: 'quick_prompts',
  PLATFORM_STORAGE_KEY: 'preferred_ai_platform',
  SHORTCUT_SETTINGS: 'shortcut_settings'
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
  summarization_behavior: 'selection' // Default to respecting selection
};