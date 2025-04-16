# manifest.json

```json
{
  "manifest_version": 3,
  "name": "Nexus AI: Web Content Assistant",
  "description": "Interact with, analyze, and summarize web pages, YouTube videos, PDFs, and Reddit posts using ChatGPT, Claude, Gemini and other AI platforms. Choose between direct API integration via side panel or seamless transfer to web UIs without copying and pasting",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "webRequest",
    "sidePanel"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "host_permissions": [
  "https://.youtube.com/",
  "https://.reddit.com/",
  "https://claude.ai/",
  "https://chatgpt.com/",
  "https://chat.deepseek.com/",
  "https://chat.mistral.ai/",
  "https://gemini.google.com/",
  "file://.pdf",
  "<all_urls>",
  "https://api.anthropic.com/",
  "https://api.openai.com/",
  "https://api.mistral.ai/",
  "https://api.deepseek.com/",
  "https://generativelanguage.googleapis.com/",
  "https://api.grok.ai/"
  ],
  "background": {
    "service_worker": "dist/background.bundle.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    }
  },
  "options_page": "settings.html",
  "icons": {
    "16": "images/icon16.png",
    "48": "images/icon48.png",
    "128": "images/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "platform-display-config.json",
        "platform-api-config.json",
        "prompt-config.json",
        "dist/*.bundle.js",
        "images/*.png"
      ],
      "matches": [
        "<all_urls>"
        ]
    }
  ]
}
```

# nexus-ai-v1.0.0.zip

This is a binary file of the type: Compressed Archive

# platform-api-config.json

```json
{
  "aiPlatforms": {
    "claude": {
      "endpoint": "https://api.anthropic.com/v1/messages",
      "minTemperature": -1.0,
      "maxTemperature": 1.0,
      "temperature": 0.5,
      "topP": 0.7,
      "models": [
        {
          "id": "claude-3-7-sonnet-latest",
          "description": "Most intelligent model, first hybrid reasoning model. Features deep thinking.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 200000,
          "inputTokenPrice": 3.00,
          "outputTokenPrice": 15.00,
          "supportsTemperature": true,
          "supportsTopP": true
        },
        {
          "id": "claude-3-5-haiku-latest",
          "description": "Fastest model, balancing speed and intelligence.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 200000,
          "inputTokenPrice": 0.80,
          "outputTokenPrice": 4.00,
          "supportsTemperature": true,
          "supportsTopP": true
        },
        {
          "id": "claude-3-5-sonnet-latest",
          "description": "High-intelligence model balancing capability and speed.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 200000,
          "inputTokenPrice": 3.00,
          "outputTokenPrice": 15.00,
          "supportsTemperature": true,
          "supportsTopP": true
        },
        {
          "id": "claude-3-opus-latest",
          "description": "Powerful model for complex tasks. Top-level intelligence and understanding.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 200000,
          "inputTokenPrice": 15.00,
          "outputTokenPrice": 75.00,
          "supportsTemperature": true,
          "supportsTopP": true
        }
      ],
      "defaultModel": "claude-3-5-haiku-latest",
      "requiresModel": true,
      "authType": "header",
      "authHeaderName": "x-api-key",
      "hasSystemPrompt": true
    },
    "chatgpt": {
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "minTemperature": 0.0,
      "maxTemperature": 2.0,
      "temperature": 0.5,
      "topP": 0.9,
      "models": [
        {
          "id": "gpt-4.5-preview",
          "description": "Largest and most capable flagship GPT model (Preview).",
          "maxTokens": 16384,
          "parameterStyle": "standard",
          "contextWindow": 128000,
          "inputTokenPrice": 75.00,
          "outputTokenPrice": 150.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "gpt-4o",
          "description": "Fast, intelligent, and flexible flagship model.",
          "maxTokens": 16384,
          "parameterStyle": "standard",
          "contextWindow": 128000,
          "inputTokenPrice": 2.50,
          "outputTokenPrice": 10.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "gpt-4o-mini",
          "description": "Fast and affordable small model, optimized for focused tasks.",
          "maxTokens": 16384,
          "parameterStyle": "standard",
          "contextWindow": 128000,
          "inputTokenPrice": 0.15,
          "outputTokenPrice": 0.60,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "o1",
          "description": "High-intelligence reasoning model for complex, multi-step tasks.",
          "maxTokens": 100000,
          "parameterStyle": "reasoning",
          "tokenParameter": "max_completion_tokens",
          "contextWindow": 200000,
          "inputTokenPrice": 15.00,
          "outputTokenPrice": 60.00,
          "supportsTemperature": false,
          "supportsTopP": false,
          "supportsSystemPrompt": false
        },
        {
          "id": "o3-mini",
          "description": "Fast, flexible, and intelligent reasoning model (o-series).",
          "maxTokens": 100000,
          "parameterStyle": "reasoning",
          "tokenParameter": "max_completion_tokens",
          "contextWindow": 200000,
          "inputTokenPrice": 1.10,
          "outputTokenPrice": 4.40,
          "supportsTemperature": false,
          "supportsTopP": false
        },
        {
          "id": "o1-mini",
          "description": "Faster, more affordable reasoning model compared to o1.",
          "maxTokens": 65536,
          "parameterStyle": "reasoning",
          "tokenParameter": "max_completion_tokens",
          "contextWindow": 128000,
          "inputTokenPrice": 1.10,
          "outputTokenPrice": 4.40,
          "supportsTemperature": false,
          "supportsTopP": false,
          "supportsSystemPrompt": false
        },
        {
          "id": "gpt-4-turbo",
          "description": "Older high-intelligence GPT model.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 128000,
          "inputTokenPrice": 10.00,
          "outputTokenPrice": 30.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "gpt-3.5-turbo",
          "description": "Legacy model, cost-effective for various chat and non-chat tasks.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 16385,
          "inputTokenPrice": 0.50,
          "outputTokenPrice": 1.50,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        }
      ],
      "defaultModel": "gpt-4o-mini",
      "requiresModel": true,
      "authType": "bearer",
      "authHeaderName": "Authorization",
      "hasSystemPrompt": true
    },
    "deepseek": {
      "endpoint": "https://api.deepseek.com/v1/chat/completions",
      "minTemperature": 0.0,
      "maxTemperature": 2.0,
      "minTopP": 0.1,
      "maxTopP": 1.0,
      "temperature": 1.0,
      "topP": 0.9,
      "models": [
        {
          "id": "deepseek-chat",
          "description": "General chat model (DeepSeek-V3).",
          "maxTokens": 8000,
          "parameterStyle": "standard",
          "contextWindow": 64000,
          "inputTokenPrice": 0.07,
          "outputTokenPrice": 1.10,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "deepseek-reasoner",
          "description": "Reasoning model (DeepSeek-R1) featuring Chain of Thought capabilities.",
          "maxTokens": 8000,
          "parameterStyle": "standard",
          "contextWindow": 64000,
          "inputTokenPrice": 0.14,
          "outputTokenPrice": 2.19,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        }
      ],
      "defaultModel": "deepseek-chat",
      "requiresModel": true,
      "authType": "bearer",
      "authHeaderName": "Authorization",
      "hasSystemPrompt": true
    },
    "mistral": {
      "endpoint": "https://api.mistral.ai/v1/chat/completions",
      "minTemperature": 0.0,
      "maxTemperature": 1.5,
      "temperature": 0.3,
      "topP": 0.7,
      "models": [
        {
          "id": "mistral-large-latest",
          "description": "Top-tier reasoning model for complex tasks.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131000,
          "inputTokenPrice": 2.00,
          "outputTokenPrice": 6.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "mistral-small-latest",
          "description": "Leading small model.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131000,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "codestral-latest",
          "description": "Cutting-edge model specialized for coding tasks.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 256000,
          "inputTokenPrice": 0.30,
          "outputTokenPrice": 0.90,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "mistral-saba-latest",
          "description": "Efficient model focused on Middle East & South Asia languages.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 32000,
          "inputTokenPrice": 0.20,
          "outputTokenPrice": 0.60,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        }
      ],
      "defaultModel": "mistral-small-latest",
      "requiresModel": true,
      "authType": "bearer",
      "authHeaderName": "Authorization",
      "hasSystemPrompt": true
    },
    "gemini": {
      "endpoint": "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent",
      "minTemperature": 0.0,
      "maxTemperature": 2.0,
      "temperature": 0.7,
      "topP": 0.9,
      "models": [
        {
          "id": "gemini-2.5-pro-exp-03-25",
          "description": "Most powerful reasoning model (Experimental Mar 2025). Peak performance.",
          "maxTokens": 65536,
          "parameterStyle": "standard",
          "contextWindow": 1048576,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "maxOutputTokens",
          "supportsSystemPrompt": true
        },
        {
          "id": "gemini-2.0-flash",
          "description": "Low latency, enhanced performance.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 1048576,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "supportsSystemPrompt": false,
          "tokenParameter": "maxOutputTokens"
        },
        {
          "id": "gemini-2.0-flash-lite",
          "description": "Cost-effective and low-latency version of Gemini 2.0 Flash.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 1048576,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "supportsSystemPrompt": false,
          "tokenParameter": "maxOutputTokens"
        },
        {
          "id": "gemini-1.5-flash",
          "description": "Fast and versatile model for diverse tasks.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 1048576,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "supportsSystemPrompt": false,
          "tokenParameter": "maxOutputTokens"
        },
        {
          "id": "gemini-1.5-flash-8b",
          "description": "Optimized for high-volume, lower-intelligence tasks.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 1048576,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "supportsSystemPrompt": false,
          "tokenParameter": "maxOutputTokens"
        },
        {
          "id": "gemini-1.5-pro",
          "description": "Powerful model for complex reasoning tasks requiring high intelligence.",
          "maxTokens": 8192,
          "parameterStyle": "standard",
          "contextWindow": 2097152,
          "inputTokenPrice": 0.00,
          "outputTokenPrice": 0.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "supportsSystemPrompt": false,
          "tokenParameter": "maxOutputTokens"
        }
      ],
      "defaultModel": "gemini-2.0-flash",
      "requiresModel": true,
      "authType": "query",
      "authParamName": "key",
      "hasSystemPrompt": true
    },
    "grok": {
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "minTemperature": 0.0,
      "maxTemperature": 2.0,
      "minTopP": 0.01,
      "maxTopP": 1.0,
      "temperature": 0.7,
      "topP": 0.9,
      "models": [
         {
          "id": "grok-3-latest",
          "description": "Flagship model (Beta) excelling at enterprise tasks (data extraction, coding, summarization) with deep domain knowledge.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131072,
          "inputTokenPrice": 3.00,
          "outputTokenPrice": 15.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "grok-3-fast-latest",
          "description": "Faster version of Grok 3, offering significantly lower latency for the same quality at a higher cost.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131072,
          "inputTokenPrice": 5.00,
          "outputTokenPrice": 25.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "grok-3-mini-latest",
          "description": "Lightweight Grok 3 model with reasoning ('thinking'). Fast, smart, good for logic tasks without deep domain needs.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131072,
          "inputTokenPrice": 0.30,
          "outputTokenPrice": 0.50,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        },
        {
          "id": "grok-3-mini-fast-latest",
          "description": "Faster version of Grok 3 Mini, offering significantly lower latency for the same quality at a higher cost.",
          "maxTokens": 4096,
          "parameterStyle": "standard",
          "contextWindow": 131072,
          "inputTokenPrice": 0.60,
          "outputTokenPrice": 4.00,
          "supportsTemperature": true,
          "supportsTopP": true,
          "tokenParameter": "max_tokens"
        }
      ],
      "defaultModel": "grok-3-mini-latest",
      "requiresModel": true,
      "authType": "bearer",
      "authHeaderName": "Authorization",
      "hasSystemPrompt": true
    }
  }
}
```

# platform-display-config.json

```json
{
  "aiPlatforms": {
    "claude": {
      "name": "Claude",
      "icon": "images/claude_logo.png",
      "url": "https://claude.ai/new",
      "docApiLink": "https://docs.anthropic.com/claude/reference/getting-started-with-the-api",
      "modelApiLink": "https://docs.anthropic.com/fr/docs/about-claude/models/all-models",
      "consoleApiLink": "https://console.anthropic.com/",
      "keyApiLink": "https://console.anthropic.com/settings/keys"
    },
    "chatgpt": {
      "name": "ChatGPT",
      "icon": "images/chatgpt_logo.png",
      "url": "https://chatgpt.com/",
      "docApiLink": "https://platform.openai.com/docs/api-reference",
      "modelApiLink": "https://platform.openai.com/docs/models",
      "consoleApiLink": "https://platform.openai.com/",
      "keyApiLink": "https://platform.openai.com/api-keys"
    },
    "deepseek": {
      "name": "DeepSeek",
      "icon": "images/deepseek_logo.png",
      "url": "https://chat.deepseek.com/",
      "docApiLink": "https://api-docs.deepseek.com/",
      "modelApiLink": "https://api-docs.deepseek.com/quick_start/pricing",
      "consoleApiLink": "https://platform.deepseek.com/",
      "keyApiLink": "https://platform.deepseek.com/api_keys"
    },
    "mistral": {
      "name": "Mistral",
      "icon": "images/mistral_logo.png",
      "url": "https://chat.mistral.ai/chat",
      "docApiLink": "https://docs.mistral.ai/api/",
      "modelApiLink": "https://docs.mistral.ai/getting-started/models/models_overview/",
      "consoleApiLink": "https://console.mistral.ai/",
      "keyApiLink": "https://console.mistral.ai/api-keys"
    },
    "gemini": {
      "name": "Gemini",
      "icon": "images/gemini_logo.png",
      "url": "https://gemini.google.com/",
      "docApiLink": "https://ai.google.dev/docs",
      "modelApiLink": "https://ai.google.dev/gemini-api/docs/models/",
      "consoleApiLink": "https://aistudio.google.com/",
      "keyApiLink": "https://aistudio.google.com/app/apikey"
    },
    "grok": {
      "name": "Grok",
      "icon": "images/grok_logo.png",
      "url": "https://grok.com/",
      "docApiLink": "https://docs.x.ai/docs/overview",
      "modelApiLink": "https://docs.x.ai/docs/models",
      "consoleApiLink": "https://console.x.ai/",
      "keyApiLink": "https://console.x.ai/"
    }
  }
}
```

# src/shared/constants.js

```js
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
  TEXT_SIZE_PREFERENCE: 'text_size_preference',
  API_ADVANCED_SETTINGS: 'api_advanced_settings',
  API_CREDENTIALS: 'api_credentials',

  // Prompt
  PRE_PROMPT: 'prePrompt',
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
  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  
  // API
  API_PROCESSING_STATUS: 'apiProcessingStatus',
  API_RESPONSE: 'apiResponse',
  API_PROCESSING_ERROR: 'apiProcessingError',
  API_RESPONSE_TIMESTAMP: 'apiResponseTimestamp',
  STREAM_ID: 'streamId',
  
  // Sidebar
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
  TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
  TAB_TOKEN_STATISTICS: 'tab_token_statistics',
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

/**
 * Sidepanel message types
 */
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
}
```

# src/shared/logger.js

```js
// src/shared/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Console-only implementation with backward compatibility
 */

// Determine if running in production mode (set by Webpack's mode option)
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Log a message to console, conditionally skipping 'info' logs in production.
 * @param {string} context - The context (background, content, popup, etc.)
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - The message to log
 * @param {any} [data=null] - Optional data to include
 */
function log(context, level, message, data = null) {
  // --- Production Log Filtering ---
  // Skip 'info' level logs when in production mode
  if (isProduction && level === 'info') {
    return; // Exit early, do not log
  }
  // -----------------------------

  // Map level to console method
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'; // Default to 'log' for 'info'

  // Format prefix with context
  const prefix = `[${context}]`;

  // Log to console with or without data
  if (data !== null) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }
}

/**
 * Stub function for backward compatibility
 * Returns empty array since we're not storing logs
 * @returns {Promise<Array>} Empty array
 */
async function getLogs() {
  // Log this message even in production, as it's informational about the logger itself
  console.log('[Logger] getLogs called - logs are not being stored in this version');
  return [];
}

/**
 * Stub function for backward compatibility
 */
async function clearLogs() {
  // Log this message even in production
  console.log('[Logger] clearLogs called - logs are not being stored in this version');
}

const logger = {
  api: {
    debug: (message, data) => log('api', 'debug', message, data),
    info: (message, data) => log('api', 'info', message, data),
    warn: (message, data) => log('api', 'warn', message, data),
    error: (message, data) => log('api', 'error', message, data)
  },
  background: {
    debug: (message, data) => log('background', 'debug', message, data),
    info: (message, data) => log('background', 'info', message, data),
    warn: (message, data) => log('background', 'warn', message, data),
    error: (message, data) => log('background', 'error', message, data)
  },
  content: {
    debug: (message, data) => log('content', 'debug', message, data),
    info: (message, data) => log('content', 'info', message, data),
    warn: (message, data) => log('content', 'warn', message, data),
    error: (message, data) => log('content', 'error', message, data)
  },
  extractor: {
    debug: (message, data) => log('extractor', 'debug', message, data),
    info: (message, data) => log('extractor', 'info', message, data),
    warn: (message, data) => log('extractor', 'warn', message, data),
    error: (message, data) => log('extractor', 'error', message, data)
  },
  popup: {
    debug: (message, data) => log('popup', 'debug', message, data),
    info: (message, data) => log('popup', 'info', message, data),
    warn: (message, data) => log('popup', 'warn', message, data),
    error: (message, data) => log('popup', 'error', message, data)
  },
  platform: {
    debug: (message, data) => log('platform', 'debug', message, data),
    info: (message, data) => log('platform', 'info', message, data),
    warn: (message, data) => log('platform', 'warn', message, data),
    error: (message, data) => log('platform', 'error', message, data)
  },
  message:{
    debug: (message, data) => log('message', 'debug', message, data),
    info: (message, data) => log('message', 'info', message, data),
    warn: (message, data) => log('message', 'warn', message, data),
    error: (message, data) => log('message', 'error', message, data)
  },
  service: {
    debug: (message, data) => log('service', 'debug', message, data),
    info: (message, data) => log('service', 'info', message, data),
    warn: (message, data) => log('service', 'warn', message, data),
    error: (message, data) => log('service', 'error', message, data)
  },
  sidebar: {
    debug: (message, data) => log('sidebar', 'debug', message, data),
    info: (message, data) => log('sidebar', 'info', message, data),
    warn: (message, data) => log('sidebar', 'warn', message, data),
    error: (message, data) => log('sidebar', 'error', message, data)
  },
  getLogs,
  clearLogs
};

module.exports = logger;
```

# src/shared/utils/content-utils.js

```js
// src/shared/utils/content-utils.js
import { CONTENT_TYPES } from '../constants.js';

/**
 * Determine content type based on URL and selection state
 * This is the single source of truth for content type detection
 * 
 * @param {string} url - The URL to check
 * @returns {string} - The detected content type
 */
export function determineContentType(url) {
  // PDF detection criteria evaluation
  const isPdf = url.endsWith('.pdf');
  const containsPdfPath = url.includes('/pdf/');
  const containsPdfViewer = url.includes('pdfviewer');
  const isChromeExtensionPdf = url.includes('chrome-extension://') && url.includes('pdfviewer');

  // PDF detection logic
  if (isPdf || containsPdfPath || containsPdfViewer || isChromeExtensionPdf) {
    return CONTENT_TYPES.PDF;
  } else if (url.includes('youtube.com/watch')) {
    return CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return CONTENT_TYPES.REDDIT;
  } else {
    return CONTENT_TYPES.GENERAL;
  }
}

export function isInjectablePage(url) {
  if (!url) return false;
  try {
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('moz-extension://')) {
      return false;
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      return true;
    }
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'file:'].includes(parsedUrl.protocol);
  } catch (e) {
    console.warn(`URL parsing failed or non-standard scheme for injection check: ${url}`, e.message);
    return false;
  }
}

```

# src/shared/utils/debounce.js

```js
// src/shared/utils/debounce.js

export function debounce(func, wait) {
  let timeout;

  const debouncedFunction = function executedFunction(...args) {
    const context = this; // Capture context
    const later = () => {
      timeout = null; // Clear timeout ID *before* calling func
      func.apply(context, args); // Call original function
    };
    clearTimeout(timeout); // Clear the previous timeout
    timeout = setTimeout(later, wait); // Set a new timeout
  };

  // Add a cancel method
  debouncedFunction.cancel = () => {
    clearTimeout(timeout);
    timeout = null; // Ensure timeout ID is cleared
  };

  return debouncedFunction;
}

```

# src/shared/utils/error-utils.js

```js
/**
 * Extracts a user-friendly error message from an API response object.
 * Attempts to parse the JSON body and find specific error details.
 * Falls back to a default message based on status code and text.
 *
 * @param {Response} response - The Fetch API Response object.
 * @returns {Promise<string>} A promise that resolves to the formatted error message string.
 */
export async function extractApiErrorMessage(response) {
  let errorData = null;
  let detailString = null;
  const defaultMessage = `API error (${response.status}): ${response.statusText || 'Unknown error'}`;

  try {
    // Clone the response before reading the body, as it can only be read once
    const clonedResponse = response.clone();
    errorData = await clonedResponse.json();
  } catch (jsonError) {
    // Ignore JSON parsing errors, we'll use the default message
    console.warn('Failed to parse API error response as JSON:', jsonError);
    return defaultMessage;
  }

  // Check for array structure first (e.g., some Gemini errors)
  if (Array.isArray(errorData) && errorData.length > 0) {
    const firstError = errorData[0];
    if (firstError?.error?.message && typeof firstError.error.message === 'string') {
      detailString = firstError.error.message;
    }
  }

  // If not found in array or errorData is not an array, check object structure
  if (!detailString && errorData && typeof errorData === 'object') {
    // 1. Check errorData.message
    if (typeof errorData.message === 'string') {
      detailString = errorData.message;
    } else if (typeof errorData.message === 'object' && errorData.message !== null) {
      // Handle nested message objects (e.g., Mistral's { message: { detail: '...' } })
      if (typeof errorData.message.detail === 'string') {
        detailString = errorData.message.detail;
      } else if (typeof errorData.message.error === 'string') {
        detailString = errorData.message.error;
      } else {
        // Fallback for unexpected object structure in message
        detailString = JSON.stringify(errorData.message);
      }
    }

    // 2. Check errorData.error.message (if message wasn't useful)
    if (!detailString && errorData.error && typeof errorData.error === 'object' && typeof errorData.error.message === 'string') {
      detailString = errorData.error.message;
    }
    // Check if errorData.error is the string itself
    else if (!detailString && errorData.error && typeof errorData.error === 'string') {
      detailString = errorData.error;
    }

    // 3. Check errorData.detail (string)
    if (!detailString && typeof errorData.detail === 'string') {
      detailString = errorData.detail;
    }
  }

  // If we found a specific detail, clean it and format the message
  if (detailString) {
    // Clean up common prefixes like '* '
    if (detailString) { detailString = detailString.replace(/^\*\s*/, ''); }
    return `API error (${response.status}): ${detailString}`;
  } else {
    // If we couldn't extract a specific string, log for debugging
    // but return the default message to avoid large objects in UI.
    const dataType = Array.isArray(errorData) ? 'array' : (typeof errorData);
    console.warn(`API error data received (type: ${dataType}), but no specific message field found:`, errorData);
    return defaultMessage;
  }
}

```

# src/shared/utils/icon-utils.js

```js
// src/shared/utils/icon-utils.js
import { CONTENT_TYPES, SHARED_TYPE } from '../constants.js';

/**
 * Generates an SVG string representing the icon for a given content type.
 * Includes Tailwind classes for default styling (w-5 h-5).
 *
 * @param {string} contentType - The content type (e.g., CONTENT_TYPES.YOUTUBE).
 * @returns {string} - The SVG string or an empty string if no icon is defined.
 */
export function getContentTypeIconSvg(contentType) {
  let iconSvg = '';
  // Define colors used within SVGs
  const generalColor = '#6B7280'; // text-gray-500
  const redditColor = '#FF4500';  // Brand color
  const pdfColor = '#F40F02';     // Custom red for PDF
  const sharedColor = '#4A90E2';  // A distinct blue for shared (layers icon)

  switch (contentType) {
    case SHARED_TYPE:
      // SVG for Shared/Common icon (Layers symbol)
      iconSvg = `
        <svg class="shared-icon w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="${sharedColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="${sharedColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="${sharedColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      break;
    case CONTENT_TYPES.YOUTUBE:
      // SVG for YouTube icon (red play button style)
      iconSvg = `
        <svg class="youtube-icon w-5 h-5" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" viewBox="0 0 461.001 461.001" xml:space="preserve">
          <g>
            <path style="fill:#F61C0D;" d="M365.257,67.393H95.744C42.866,67.393,0,110.259,0,163.137v134.728   c0,52.878,42.866,95.744,95.744,95.744h269.513c52.878,0,95.744-42.866,95.744-95.744V163.137   C461.001,110.259,418.135,67.393,365.257,67.393z M300.506,237.056l-126.06,60.123c-3.359,1.602-7.239-0.847-7.239-4.568V168.607   c0-3.774,3.982-6.22,7.348-4.514l126.06,63.881C304.363,229.873,304.298,235.248,300.506,237.056z"/>
            <path style="fill:#FFFFFF;" d="M167.207,168.607v124.004l126.06-60.123c3.792-1.808,3.857-7.183,0.109-9.082L167.207,168.607z"/>
          </g>
        </svg>
      `;
      break;
    case CONTENT_TYPES.REDDIT:
      // SVG for Reddit icon (Orange circle with Snoo silhouette)
      iconSvg = `
        <svg class="reddit-icon w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
          <circle cx="400" cy="400" fill="${redditColor}" r="400"/>
          <path d="M666.8 400c.08 5.48-.6 10.95-2.04 16.24s-3.62 10.36-6.48 15.04c-2.85 4.68-6.35 8.94-10.39 12.65s-8.58 6.83-13.49 9.27c.11 1.46.2 2.93.25 4.4a107.268 107.268 0 0 1 0 8.8c-.05 1.47-.14 2.94-.25 4.4 0 89.6-104.4 162.4-233.2 162.4S168 560.4 168 470.8c-.11-1.46-.2-2.93-.25-4.4a107.268 107.268 0 0 1 0-8.8c.05-1.47.14-2.94.25-4.4a58.438 58.438 0 0 1-31.85-37.28 58.41 58.41 0 0 1 7.8-48.42 58.354 58.354 0 0 1 41.93-25.4 58.4 58.4 0 0 1 46.52 15.5 286.795 286.795 0 0 1 35.89-20.71c12.45-6.02 25.32-11.14 38.51-15.3s26.67-7.35 40.32-9.56 27.45-3.42 41.28-3.63L418 169.6c.33-1.61.98-3.13 1.91-4.49.92-1.35 2.11-2.51 3.48-3.4 1.38-.89 2.92-1.5 4.54-1.8 1.61-.29 3.27-.26 4.87.09l98 19.6c9.89-16.99 30.65-24.27 48.98-17.19s28.81 26.43 24.71 45.65c-4.09 19.22-21.55 32.62-41.17 31.61-19.63-1.01-35.62-16.13-37.72-35.67L440 186l-26 124.8c13.66.29 27.29 1.57 40.77 3.82a284.358 284.358 0 0 1 77.8 24.86A284.412 284.412 0 0 1 568 360a58.345 58.345 0 0 1 29.4-15.21 58.361 58.361 0 0 1 32.95 3.21 58.384 58.384 0 0 1 25.91 20.61A58.384 58.384 0 0 1 666.8 400zm-396.96 55.31c2.02 4.85 4.96 9.26 8.68 12.97 3.71 3.72 8.12 6.66 12.97 8.68A40.049 40.049 0 0 0 306.8 480c16.18 0 30.76-9.75 36.96-24.69 6.19-14.95 2.76-32.15-8.68-43.59s-28.64-14.87-43.59-8.68c-14.94 6.2-24.69 20.78-24.69 36.96 0 5.25 1.03 10.45 3.04 15.31zm229.1 96.02c2.05-2 3.22-4.73 3.26-7.59.04-2.87-1.07-5.63-3.07-7.68s-4.73-3.22-7.59-3.26c-2.87-.04-5.63 1.07-7.94 2.8a131.06 131.06 0 0 1-19.04 11.35 131.53 131.53 0 0 1-20.68 7.99c-7.1 2.07-14.37 3.54-21.72 4.39-7.36.85-14.77 1.07-22.16.67-7.38.33-14.78.03-22.11-.89a129.01 129.01 0 0 1-21.64-4.6c-7.08-2.14-13.95-4.88-20.56-8.18s-12.93-7.16-18.89-11.53c-2.07-1.7-4.7-2.57-7.38-2.44s-5.21 1.26-7.11 3.15c-1.89 1.9-3.02 4.43-3.15 7.11s.74 5.31 2.44 7.38c7.03 5.3 14.5 9.98 22.33 14s16 7.35 24.4 9.97 17.01 4.51 25.74 5.66c8.73 1.14 17.54 1.53 26.33 1.17 8.79.36 17.6-.03 26.33-1.17A153.961 153.961 0 0 0 476.87 564c7.83-4.02 15.3-8.7 22.33-14zm-7.34-68.13c5.42.06 10.8-.99 15.81-3.07 5.01-2.09 9.54-5.17 13.32-9.06s6.72-8.51 8.66-13.58A39.882 39.882 0 0 0 532 441.6c0-16.18-9.75-30.76-24.69-36.96-14.95-6.19-32.15-2.76-43.59 8.68s-14.87 28.64-8.68 43.59c6.2 14.94 20.78 24.69 36.96 24.69z" fill="#fff"/>
        </svg>
      `;
      break;
    case CONTENT_TYPES.PDF:
      // SVG for PDF icon (document outline with PDF text)
      iconSvg = `
        <svg class="pdf-icon w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2V8H20" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          {/* Replaced text with simple lines to avoid text rendering issues */}
          <path d="M9 13H15" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 17H12" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      break;
    case CONTENT_TYPES.GENERAL:
    default:
      // SVG for General Web Content (Globe/Web icon)
      iconSvg = `
        <svg class="general-icon w-5 h-5" viewBox="0 0 24 24" fill="${generalColor}" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 10.199l-3.64 1.801 3.64 1.796v2.204l-6-2.935v-2.131l6-2.934v2.199zm8 2.866l-6 2.935v-2.204l3.64-1.796-3.64-1.801v-2.199l6 2.935v2.13z"/>
        </svg>
      `;
      break;
  }
  return iconSvg;
}
```

# src/shared/utils/message-utils.js

```js
// src/shared/utils/message-utils.js
import logger from '../logger';

const RETRY_DELAY = 250;

/**
 * Sends a message to the background script, handling potential connection errors
 * and performing a single retry if the Service Worker was inactive.
 * @param {object} message - The message object to send. Must include an 'action' property.
 * @param {number} [retries=1] - Maximum number of retries allowed (default is 1 retry).
 * @returns {Promise<any>} A promise that resolves with the response or rejects with an error.
 */
export async function robustSendMessage(message, retries = 1) {
  if (!message || typeof message.action !== 'string') {
    logger.message.error('robustSendMessage: Invalid message object. "action" property is required.', message);
    return Promise.reject(new Error('Invalid message object passed to robustSendMessage'));
  }

  return new Promise((resolve, reject) => {
    // Ensure chrome API is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      logger.message.error('robustSendMessage: Chrome runtime API is not available.');
      return reject(new Error('Chrome runtime API not available'));
    }

    logger.message.info(`robustSendMessage: Sending action "${message.action}"...`);
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        // Check if it's a connection error and retries are left
        const isConnectionError = lastError.message?.includes('Receiving end does not exist') ||
                                  lastError.message?.includes('Could not establish connection');

        if (retries > 0 && isConnectionError) {
          logger.message.warn(`robustSendMessage: Connection error for action "${message.action}". Retrying in ${RETRY_DELAY}ms... (Retries left: ${retries - 1})`);
          setTimeout(() => {
            robustSendMessage(message, retries - 1) // Recursive call with decremented retries
              .then(resolve)
              .catch(reject);
          }, RETRY_DELAY);
        } else {
          // Not a retryable error or retries exhausted
          logger.message.error(`robustSendMessage: Unrecoverable error for action "${message.action}":`, { message: lastError.message });
          reject(new Error(lastError.message || 'Unknown runtime error'));
        }
      } else {
        // Success
        logger.message.info(`robustSendMessage: Received response for action "${message.action}".`);
        resolve(response);
      }
    });
  });
}
```

# src/shared/utils/prompt-utils.js

```js
// src/shared/utils/prompt-utils.js
import { STORAGE_KEYS, SHARED_TYPE } from '../constants';

/**
 * Loads custom prompts relevant to a specific content type, including shared prompts.
 * 
 * @param {string} contentType - The content type to load prompts for (e.g., 'general', 'youtube').
 * @returns {Promise<Array<{id: string, name: string, content: string, contentType: string}>>} - A promise that resolves to a sorted array of relevant prompt objects.
 */
export async function loadRelevantPrompts(contentType) {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    const promptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

    // Step 1: Correctly access the .prompts object for the given contentType
    const typePromptsObj = promptsByType[contentType]?.prompts || {};

    // Step 2: Correctly access the .prompts object for SHARED_TYPE, avoid duplication
    const sharedPromptsObj = contentType !== SHARED_TYPE 
      ? (promptsByType[SHARED_TYPE]?.prompts || {}) 
      : {};

    // Step 3: Convert type-specific prompts object to array and add contentType
    const typeSpecificPromptsArray = Object.values(typePromptsObj).map(prompt => ({
      ...prompt,
      contentType: contentType 
    }));

    // Step 4: Convert shared prompts object to array and add contentType
    const sharedPromptsArray = Object.values(sharedPromptsObj).map(prompt => ({
      ...prompt,
      contentType: SHARED_TYPE
    }));

    // Step 5: Combine the arrays
    const combinedPrompts = [...typeSpecificPromptsArray, ...sharedPromptsArray];

    // Step 6: Ensure uniqueness using a Map based on prompt.id
    const uniquePromptsMap = new Map();
    combinedPrompts.forEach(prompt => {
      if (prompt && prompt.id) { // Ensure prompt and id exist
        uniquePromptsMap.set(prompt.id, prompt);
      }
    });

    // Step 7: Convert Map values back to an array
    let relevantPrompts = Array.from(uniquePromptsMap.values());

    // Step 8: Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    // Step 9: Return the sorted array
    return relevantPrompts;
  } catch (error) {
    console.error("Error loading relevant prompts:", error);
    return []; // Return empty array on error
  }
}

```

# src/sidebar/components/ChatArea.jsx

```jsx
// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { debounce } from '../../shared/utils/debounce';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from './messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { Tooltip } from '../../components/layout/Tooltip';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';
import logger from '../../shared/logger'; // Import the logger

// --- Icon Definitions ---
const InputTokenIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 18V6M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const OutputTokenIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 6v12M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ContextWindowIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21H3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 3L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 21L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const FreeTierIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const ScrollDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
// --- End Icon Definitions ---


// --- Helper Function ---
const formatContextWindow = (value) => {
    if (typeof value !== 'number') return '';
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
};
// --- End Helper Function ---


function ChatArea({ className = '' }) {
    const {
        messages,
        isContentExtractionEnabled,
        setIsContentExtractionEnabled,
        modelConfigData
    } = useSidebarChat();
    const { contentType, currentTab } = useContent();
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null); // Ref for the scrollable div
    const [hoveredElement, setHoveredElement] = useState(null);
    const inputPriceRef = useRef(null);
    const outputPriceRef = useRef(null);
    const contextWindowRef = useRef(null);
    const freeTierRef = useRef(null);
    const {
        platforms,
        selectedPlatformId,
        selectedModel,
        hasAnyPlatformCredentials,
    } = useSidebarPlatform();

    // --- State for Scroll Button Visibility ---
    const [showScrollDownButton, setShowScrollDownButton] = useState(false);

    // --- Local State for Stable Display ---
    const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
    const [displayModelConfig, setDisplayModelConfig] = useState(null);
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

    useEffect(() => {
        const targetPlatform = platforms.find(p => p.id === selectedPlatformId);
        const isModelConfigReady = modelConfigData && selectedModel && modelConfigData.id === selectedModel;
        const isPlatformReady = !!targetPlatform;

        if (isPlatformReady && isModelConfigReady) {
            setDisplayPlatformConfig({
                id: targetPlatform.id,
                name: targetPlatform.name,
                iconUrl: targetPlatform.iconUrl
            });
            setDisplayModelConfig(modelConfigData);
            if (!hasCompletedInitialLoad) {
                setHasCompletedInitialLoad(true);
            }
        }
    }, [platforms, selectedPlatformId, modelConfigData, selectedModel, hasCompletedInitialLoad]);
    // --- End Local State ---

    // --- Get Content Type Name ---
    const getContentTypeName = (type) => {
        switch (type) {
            case CONTENT_TYPES.YOUTUBE: return "YouTube Video";
            case CONTENT_TYPES.REDDIT: return "Reddit Post";
            case CONTENT_TYPES.PDF: return "PDF Document";
            case CONTENT_TYPES.GENERAL: return "Web Page";
            default: return "Content";
        }
    };
    // --- End Get Content Type Name ---

    // --- Scroll Handling Logic ---
    const SCROLL_THRESHOLD = 10;
    const DEBOUNCE_DELAY = 200; // Debounce for manual scroll listener

    // --- Auto-Scroll Effect ---
    useEffect(() => {
        if (messages.length > 0) {
            logger.sidebar.debug('[ChatArea] Messages length changed, auto-scrolling to bottom.');
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages.length]);
    // --- End Auto-Scroll Effect ---


    const scrollToBottom = useCallback((behavior = 'smooth') => {
        logger.sidebar.debug('[ChatArea] scrollToBottom called manually');
        messagesEndRef.current?.scrollIntoView({ behavior: behavior, block: 'end' });
    }, []);

    // --- Function to Check Scroll Position ---
    const checkScrollPosition = useCallback(() => {
        // --- ADDED CHECK: Hide button if there are no messages ---
        if (messages.length === 0) {
            setShowScrollDownButton(prev => {
                if (prev === true) {
                    logger.sidebar.debug('[ChatArea] checkScrollPosition: No messages, ensuring button is hidden.');
                    return false;
                }
                return prev;
            });
            return; // Exit early
        }
        // --- END ADDED CHECK ---

        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
            logger.sidebar.warn('[ChatArea] checkScrollPosition: scrollContainerRef is null');
            return;
        }
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const scrollFromBottom = scrollHeight - scrollTop - clientHeight;
        const isNearBottom = scrollFromBottom <= SCROLL_THRESHOLD + 1;

        // logger.sidebar.debug(`[ChatArea] checkScrollPosition: scrollTop=${scrollTop.toFixed(1)}, scrollHeight=${scrollHeight.toFixed(1)}, clientHeight=${clientHeight.toFixed(1)}, scrollFromBottom=${scrollFromBottom.toFixed(1)}, isNearBottom=${isNearBottom}`);

        const shouldShow = !isNearBottom;
        setShowScrollDownButton(prev => {
            if (prev !== shouldShow) {
                 logger.sidebar.info(`[ChatArea] Setting showScrollDownButton to: ${shouldShow}`);
            }
            return shouldShow;
        });

    }, [messages.length, SCROLL_THRESHOLD]); // Add messages.length as dependency

    // --- Debounced version for the scroll listener ---
    const debouncedCheckScrollPosition = useMemo(
        () => debounce(checkScrollPosition, DEBOUNCE_DELAY),
        [checkScrollPosition] // Dependency: the check function itself
    );

    // --- Effect for Manual Scroll Listener ---
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            logger.sidebar.info('[ChatArea] Adding scroll listener for manual scroll.');
            scrollContainer.addEventListener('scroll', debouncedCheckScrollPosition, { passive: true });
            checkScrollPosition(); // Initial check

            return () => {
                logger.sidebar.info('[ChatArea] Removing scroll listener for manual scroll.');
                scrollContainer.removeEventListener('scroll', debouncedCheckScrollPosition);
                if (debouncedCheckScrollPosition && typeof debouncedCheckScrollPosition.cancel === 'function') {
                    debouncedCheckScrollPosition.cancel();
                }
            };
        } else {
            logger.sidebar.error('[ChatArea] CRITICAL: scrollContainerRef.current is null in manual scroll listener setup.');
        }
    }, [debouncedCheckScrollPosition, checkScrollPosition]); // Add checkScrollPosition here too


    // --- Effect to check scroll on content update (during streaming) ---
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    useEffect(() => {
        if (lastMessage && lastMessage.isStreaming) {
            queueMicrotask(() => {
                if (scrollContainerRef.current) {
                    logger.sidebar.debug('[ChatArea] Last message content updated while streaming, checking scroll position.');
                    checkScrollPosition();
                } else {
                    logger.sidebar.warn('[ChatArea] Microtask ran, but scrollContainerRef was null.');
                }
            });
        }
    }, [lastMessage?.content, lastMessage?.isStreaming, checkScrollPosition]);
    // --- End Effect ---

    logger.sidebar.debug(`[ChatArea] Rendering with showScrollDownButton state: ${showScrollDownButton}`);


    // --- Open API Settings ---
    const openApiSettings = () => {
        try {
            if (chrome && chrome.tabs && chrome.runtime) {
                chrome.tabs.create({ url: chrome.runtime.getURL('settings.html#api-settings') });
            } else {
                console.warn("Chrome APIs not available. Cannot open settings tab.");
            }
        } catch (error) {
            console.error('Could not open API options page:', error);
        }
    };
    // --- End Open API Settings ---

    const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;

    // --- Render Initial View Content (Helper Function) ---
    const renderInitialView = () => {
        if (!hasAnyPlatformCredentials) {
            return (
                <div className={`flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}>
                    <button
                        onClick={openApiSettings}
                        className="flex flex-col items-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark"
                        aria-label="Configure API Credentials in Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 text-theme-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
                        <p className="text-sm">
                            Click here to configure API keys in settings.
                        </p>
                    </button>
                </div>
            );
        }
        if (hasAnyPlatformCredentials && !hasCompletedInitialLoad) {
            return (
                <div className={`flex items-center justify-center h-full`}>
                    <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading model information"></div>
                </div>
            );
        }
        if (hasAnyPlatformCredentials && hasCompletedInitialLoad) {
            return (
                <div className={`flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-3`}>
                     {/* SECTION 1: Platform Logo, Model Name, and Details Section */}
                     <div className="flex flex-col items-center py-3 w-full">
                         {displayPlatformConfig ? (
                             <img
                                 src={displayPlatformConfig.iconUrl}
                                 alt={`${displayPlatformConfig.name || 'Platform'} logo`}
                                 className="w-8 h-8 mb-2 object-contain"
                             />
                         ) : (
                             <div className="w-12 h-12 mb-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                         )}
                         {displayModelConfig ? (
                             <>
                                 <div className="text-sm text-theme-primary dark:text-theme-primary-dark font-medium" title={displayModelConfig.id}>
                                     {displayModelConfig.name || displayModelConfig.id}
                                 </div>
                                 {displayModelConfig.description && (
                                     <p className="text-xs text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto">
                                         {displayModelConfig.description}
                                     </p>
                                 )}
                                 <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-theme-secondary mt-1">
                                     {displayModelConfig.inputTokenPrice === 0 && displayModelConfig.outputTokenPrice === 0 ? (
                                         <div ref={freeTierRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('freeTier')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('freeTier')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                             <FreeTierIcon /> <span>Free</span>
                                             <Tooltip show={hoveredElement === 'freeTier'} message="This model is currently free to use via API." targetRef={freeTierRef} position="bottom" />
                                         </div>
                                     ) : (
                                         <>
                                             {typeof displayModelConfig.inputTokenPrice === 'number' && displayModelConfig.inputTokenPrice >= 0 && (
                                                 <div ref={inputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('inputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('inputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                                     <InputTokenIcon /> <span>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                                                     <Tooltip show={hoveredElement === 'inputPrice'} message={`$${displayModelConfig.inputTokenPrice.toFixed(2)} / 1M input tokens.`} targetRef={inputPriceRef} position="bottom" />
                                                 </div>
                                             )}
                                             {typeof displayModelConfig.outputTokenPrice === 'number' && displayModelConfig.outputTokenPrice > 0 && (
                                                 <div ref={outputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('outputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('outputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                                     <OutputTokenIcon /> <span>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                                                     <Tooltip show={hoveredElement === 'outputPrice'} message={`$${displayModelConfig.outputTokenPrice.toFixed(2)} / 1M output tokens.`} targetRef={outputPriceRef} position="bottom" />
                                                 </div>
                                             )}
                                         </>
                                     )}
                                     {typeof displayModelConfig.contextWindow === 'number' && displayModelConfig.contextWindow > 0 && (
                                         <div ref={contextWindowRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('contextWindow')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('contextWindow')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                                             <ContextWindowIcon /> <span>{formatContextWindow(displayModelConfig.contextWindow)}</span>
                                             <Tooltip show={hoveredElement === 'contextWindow'} message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`} targetRef={contextWindowRef} position="bottom" />
                                         </div>
                                     )}
                                 </div>
                             </>
                         ) : (
                             <div className="h-5 mt-1 mb-2"></div>
                         )}
                     </div>

                     {/* SECTION 2: Start a conversation message Section */}
                     <div className="flex flex-col items-center py-3 w-full">
                         <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
                         <p className="text-xs max-w-xs mx-auto">
                             {getWelcomeMessage(contentType, isPageInjectable)}
                         </p>
                     </div>

                     {/* SECTION 3: Content Type / Extraction Info Section */}
                     <div className="flex flex-col items-center py-3 w-full">
                         {isPageInjectable ? (
                             <>
                                 {getContentTypeIconSvg(contentType) && (
                                     <div className="mb-3">
                                         <div
                                             className="inline-flex items-center px-4 py-2 rounded-full shadow-sm bg-gray-100 dark:bg-gray-800 text-theme-primary dark:text-theme-primary-dark"
                                             aria-label={`Current content type: ${getContentTypeName(contentType)}`}
                                         >
                                             <div
                                                 className="mr-3 flex-shrink-0 w-5 h-5"
                                                 dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                                                 aria-hidden="true"
                                             />
                                             <span className="text-sm font-medium">
                                                 {getContentTypeName(contentType)}
                                             </span>
                                         </div>
                                     </div>
                                 )}
                                 <div className="flex items-center gap-3 text-xs text-theme-secondary">
                                     <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                                     <Toggle
                                         id="content-extract-toggle"
                                         checked={isContentExtractionEnabled}
                                         onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                                         disabled={!hasAnyPlatformCredentials}
                                         className='w-10 h-5'
                                     />
                                 </div>
                             </>
                         ) : (
                             <div className="mb-2">
                                 <span className="text-xs text-theme-secondary">
                                     This page content cannot be extracted.
                                 </span>
                             </div>
                         )}
                     </div>
                 </div>
            );
        }
        return null;
    };
    // --- End Initial View Rendering ---


    // --- Main Component Render ---
    return (
        <div className={`flex-1 flex flex-col relative ${className}`}>

            {/* Scrollable container - ALWAYS RENDERED */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto flex flex-col pt-4"
            >
                {/* Conditional Content Inside Scrollable Container */}
                {messages.length === 0 ? (
                    renderInitialView()
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                content={message.content}
                                role={message.role}
                                isStreaming={message.isStreaming}
                                model={message.model}
                                platformIconUrl={message.platformIconUrl}
                            />
                        ))}
                        <div ref={messagesEndRef} style={{ height: '1px' }} />
                    </>
                )}
            </div>

            {/* Scroll Down Button */}
            {showScrollDownButton && logger.sidebar.debug('[ChatArea] Rendering Scroll Down Button')}
            <button
                onClick={() => scrollToBottom('smooth')}
                className={`
                    absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10
                    p-1.5 rounded-full shadow-md
                    bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
                    text-theme-primary dark:text-theme-primary-dark
                    transition-opacity duration-300 ease-in-out
                    ${showScrollDownButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                aria-label="Scroll to bottom"
                title="Scroll to bottom"
                aria-hidden={!showScrollDownButton}
                tabIndex={showScrollDownButton ? 0 : -1}
            >
                <ScrollDownIcon />
            </button>
            {/* --- End Scroll Down Button --- */}
        </div>
    );
}

// Helper function for welcome message
function getWelcomeMessage(contentType, isPageInjectable) {
    if (!isPageInjectable) {
        return "Ask me anything! Type your question or prompt below.";
    }
    switch (contentType) {
        case CONTENT_TYPES.YOUTUBE:
            return "Ask about this YouTube video or request a summary.";
        case CONTENT_TYPES.REDDIT:
            return "Ask me anything about this Reddit post or request key takeaways.";
        case CONTENT_TYPES.PDF:
            return "Ask specific questions about this PDF document or request a summary.";
        case CONTENT_TYPES.GENERAL:
        default:
            return "Ask about this page's content, request a summary, or start a related chat.";
    }
}

export default ChatArea;
```

# src/sidebar/components/Header.jsx

```jsx
import React, { useEffect, useState, useRef, createContext } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import ModelSelector from './ModelSelector';

// Create a context for dropdown state coordination
export const DropdownContext = createContext({
  openDropdown: null,
  setOpenDropdown: () => {}
});

// SVG Icons
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

function Header() {
  const {
    platforms,
    selectedPlatformId,
    selectPlatform,
    hasAnyPlatformCredentials,
    isLoading,
    isRefreshing,
    refreshPlatformData
  } = useSidebarPlatform();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const dropdownRef = useRef(null);
  const refreshButtonRef = useRef(null);
  const triggerRef = useRef(null);
  const prevIsRefreshingRef = useRef(isRefreshing);

  // Filter platforms based on credentials
  const availablePlatforms = platforms.filter(p => p.hasCredentials);

  // Find selected platform details
  const selectedPlatformDetails = platforms.find(p => p.id === selectedPlatformId);

  const isPlatformDropdownOpen = openDropdown === 'platform';

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        (dropdownRef.current && !dropdownRef.current.contains(event.target)) &&
        (triggerRef.current && !triggerRef.current.contains(event.target))
      ) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Effect to handle selection change if current platform loses credentials
  useEffect(() => {
    if (isLoading || !hasAnyPlatformCredentials) return; 

    const isSelectedPlatformAvailable = availablePlatforms.some(p => p.id === selectedPlatformId);

    if (!isSelectedPlatformAvailable && availablePlatforms.length > 0) {
      selectPlatform(availablePlatforms[0].id);
    }
  }, [platforms, selectedPlatformId, hasAnyPlatformCredentials, isLoading, selectPlatform, availablePlatforms]);

  // Effect to handle refresh animation
  useEffect(() => {
    if (isRefreshing) {
      setShowAnimation(true);
    }
    
    if (prevIsRefreshingRef.current && !isRefreshing) {
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // Update previous state reference
    prevIsRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const handleSelectPlatform = (platformId) => {
    selectPlatform(platformId);
    setOpenDropdown(null);
  };

  const selectedPlatformForDisplay = selectedPlatformDetails; 

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div className="flex items-center px-5">
        <div className="flex items-center w-full min-w-0">
          {hasAnyPlatformCredentials ? (
            <>
              {/* 1. Platform Selector - fixed width, non-shrinkable */}
              <div className="relative flex items-center h-9 flex-shrink-0 mr-2">
                {selectedPlatformForDisplay && (
                  <div ref={triggerRef}>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === 'platform' ? null : 'platform')}
                      className="flex items-center h-9 px-2 py-2 rounded focus:outline-none transition-colors"
                      aria-label="Change Platform"
                      aria-haspopup="true"
                      aria-expanded={isPlatformDropdownOpen}
                    >
                      <img
                        src={selectedPlatformForDisplay.iconUrl}
                        alt={`${selectedPlatformForDisplay.name} logo`}
                        className="w-4 h-4 object-contain mr-1"
                      />
                      <span className="text-theme-secondary">
                        <ChevronIcon />
                      </span>
                    </button>
                  </div>
                )}
  
                {/* Platform Dropdown */}
                {isPlatformDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 py-1 w-max max-w-sm"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="platform-menu-button"
                  >
                    {availablePlatforms.map((platform) => {
                      const isSelected = platform.id === selectedPlatformId;
                      return (
                        <button
                          key={platform.id}
                          role="menuitem"
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-theme-hover ${
                            isSelected ? 'font-medium' : ''
                          }`}
                          onClick={() => handleSelectPlatform(platform.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <img src={platform.iconUrl} alt="" className="w-4 h-4 object-contain" />
                              <span className="text-sm">{platform.name}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
  
              {/* 2. Model Selector - constrained width, allows truncation */}
              <div className="min-w-0">
                <ModelSelector 
                  selectedPlatformId={selectedPlatformId}
                />
              </div>
  
              {/* 3. Spacer Element */}
              <div className="flex-grow" style={{ pointerEvents: 'none' }}></div>
            </>
          ) : (
            // When no credentials, show message
            <div className="flex-grow py-1.5 h-9"> 
              <span className="text-theme-secondary text-sm">No API credentials configured.</span>
            </div>
          )}
          
          {/* 4. Refresh Button - updated with rotation animation */}
          <div className="flex-shrink-0 ml-2 h-9 flex items-center justify-center">
            <button
              ref={refreshButtonRef}
              onClick={refreshPlatformData}
              disabled={isRefreshing || isLoading}
              // The button's classes remain the same
              className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh platforms and credentials"
              title="Refresh platforms and credentials"
            >
              <svg xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 ${showAnimation ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </DropdownContext.Provider>
  );
}

export default Header;
```

# src/sidebar/components/messaging/EnhancedCodeBlock.jsx

```jsx
// src/components/EnhancedCodeBlock.jsx
import React, { useState, memo, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CopyButtonIcon from './icons/CopyButtonIcon';
import { copyToClipboard } from './utils/clipboard';

/**
 * Enhanced CodeBlock with syntax highlighting and copy functionality.
 * This version allows the code block to grow vertically to fit its content.
 * @param {Object} props - Component props
 * @param {string} props.className - Class containing language information
 * @param {React.ReactNode} props.children - Content to be rendered inside the code block
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @returns {JSX.Element} - A formatted code block with syntax highlighting
 */
const EnhancedCodeBlock = memo(({ className, children, isStreaming = false }) => {
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error
  const codeContent = String(children).replace(/\n$/, '');
  const [isDarkMode, setIsDarkMode] = useState(
    // Check for window availability for SSR/build environments
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Listen for theme changes
  useEffect(() => {
    // Ensure window and matchMedia are available
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);

    // Use addEventListener if available, otherwise fallback to addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) { // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Extract language from className (format: language-python, language-javascript, etc.)
  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1] : 'text'; // Default to 'text' if no language found

  // Format the raw language name - just capitalize first letter
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);

  const copyCodeToClipboard = async () => {
    try {
      await copyToClipboard(codeContent);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Copy method failed: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // Define the syntax highlighter theme based on current app theme
  const syntaxTheme = isDarkMode ? oneDark : oneLight;

  return (
    <div className="relative rounded-lg overflow-visible border border-gray-200 dark:border-gray-700 my-4 shadow-sm">
      {/* Minimal header with language display */}
      <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1.5 flex justify-between items-center rounded-t-lg">
        {/* Language name */}
        <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{displayLanguage}</span>

        {/* Copy button - Only show when not streaming */}
        {!isStreaming && (
          <button
            onClick={copyCodeToClipboard}
            className={`rounded transition-all duration-200 px-1.5 py-0.5 text-xs
                      ${copyState === 'copied' ? 'text-green-600 dark:text-green-400' :
                        copyState === 'error' ? 'text-red-500 dark:text-red-400' :
                        'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            aria-label="Copy code to clipboard"
            title="Copy code to clipboard"
            disabled={copyState !== 'idle'}
          >
            <CopyButtonIcon state={copyState} />
          </button>
        )}
      </div>

      {/* Code content area with syntax highlighting */}
      <div className="bg-gray-100 dark:bg-gray-900 overflow-x-auto w-full rounded-b-lg">
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={{
            margin: 0,
            padding: '0.75rem 1rem', // equivalent to py-3 px-4
            background: 'transparent', // Handled by parent div
            fontSize: '0.875rem', // text-sm
            lineHeight: 1.5, // Increased slightly for better readability
            minHeight: '1.5rem', // Ensure a minimum height even for empty/short code
            whiteSpace: 'pre-wrap', // Ensures wrapping respects whitespace and newlines
            wordBreak: 'break-all', // Helps break long words if wrapLongLines isn't enough
          }}
          wrapLongLines={true} 
          codeTagProps={{ className: 'font-mono text-gray-800 dark:text-gray-200' }}
        >
          {codeContent || ' '} {/* Render a space if content is empty to maintain height */}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

EnhancedCodeBlock.displayName = 'EnhancedCodeBlock'; // Add display name for easier debugging

export default EnhancedCodeBlock;
```

# src/sidebar/components/messaging/icons/CopyButtonIcon.jsx

```jsx
import React, { memo } from 'react';

/**
 * Reusable Copy Button Icon component
 * Provides consistent SVG icons for different copy states
 * @param {Object} props - Component props
 * @param {string} props.state - Current copy state ('idle', 'copied', or 'error')
 * @returns {JSX.Element} - The appropriate icon based on state
 */
const CopyButtonIcon = memo(({ state = 'idle' }) => {
  switch (state) {
    case 'copied':
      // Checkmark icon for copied state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    case 'error':
      // X icon for error state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    default:
      // Default copy icon
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352.804 352.804" fill="currentColor" className="w-3 h-3">
          <path d="M318.54,57.282h-47.652V15c0-8.284-6.716-15-15-15H34.264c-8.284,0-15,6.716-15,15v265.522c0,8.284,6.716,15,15,15h47.651v42.281c0,8.284,6.716,15,15,15H318.54c8.284,0,15-6.716,15-15V72.282C333.54,63.998,326.824,57.282,318.54,57.282z M49.264,265.522V30h191.623v27.282H96.916c-8.284,0-15,6.716-15,15v193.24H49.264z M303.54,322.804H111.916V87.282H303.54V322.804z"/>
        </svg>
      );
  }
});

export default CopyButtonIcon;
```

# src/sidebar/components/messaging/MathFormulaBlock.jsx

```jsx
// src/components/MathFormulaBlock.jsx
import React, { memo, useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Enhanced math formula block component
 * Safely renders math expressions with error handling
 * @param {Object} props - Component props
 * @param {string} props.content - The LaTeX content to render
 * @param {boolean} props.inline - Whether to render inline or block math
 * @returns {JSX.Element} - The rendered math formula
 */
const MathFormulaBlock = memo(({ content, inline = false }) => {
  // Use state to track if rendering fails
  const [renderError, setRenderError] = useState(false);

  // Safely render math with error boundary
  const renderMathSafely = () => {
    try {
      return inline ?
        <InlineMath math={content} /> :
        <BlockMath math={content} />;
    } catch (error) {
      console.error('Math rendering error:', error);
      setRenderError(true);
      return null;
    }
  };

  // If there was an error, show original content with error styling
  if (renderError) {
    return (
      <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded my-4 font-mono text-sm whitespace-pre-wrap">
        <div className="mb-2 text-xs text-red-600 dark:text-red-400 font-semibold">Unable to render formula - showing LaTeX source:</div>
        <code className='text-red-700 dark:text-red-300'>{content}</code>
      </div>
    );
  }

  const renderedMath = renderMathSafely();

  // Only render if math was successfully generated
  if (!renderedMath) return null;

  // Normal rendering with appropriate KaTeX component
  return inline ? (
    <span className="inline-flex items-center align-middle my-2 mx-1">
      {renderedMath}
    </span>
  ) : (
    // Removed 'flex justify-center' to fix left-truncation with overflow
    <div className="my-3 overflow-x-auto max-w-full">
      {renderedMath}
    </div>
  );
});

export default MathFormulaBlock;
```

# src/sidebar/components/messaging/MessageBubble.jsx

```jsx
// src/components/messaging/MessageBubble.jsx
import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import 'katex/dist/katex.min.css';

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import MathFormulaBlock from './MathFormulaBlock'
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';
import logger from '../../../shared/logger';

// Placeholder Regex - matches @@MATH_(BLOCK|INLINE)_(\d+)@@
const MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_(\d+)@@/g;
// Regex for checking if *any* placeholder exists (used for optimization)
const HAS_MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_\d+@@/;

/**
 * Utility function to check if processed children contain a block-level element (div).
 * @param {React.ReactNode|React.ReactNodeArray} processedChildren - Children processed by renderWithPlaceholdersRecursive.
 * @returns {boolean} - True if a direct child is a div element.
 */
const containsBlockElementCheck = (processedChildren) => {
    return React.Children.toArray(processedChildren).some(
        child => React.isValidElement(child) && child.type === 'div'
    );
};

/**
 * RECURSIVE function to process children, find placeholders, and replace them with MathFormulaBlock
 */
const renderWithPlaceholdersRecursive = (children, mathMap) => {
  return React.Children.toArray(children).flatMap((child, index) => {
    // 1. Process String Children
    if (typeof child === 'string') {
      const parts = [];
      let lastIndex = 0;
      let match;
      MATH_PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state for each string

      while ((match = MATH_PLACEHOLDER_REGEX.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const placeholder = match[0];
        const mathType = match[1];
        const mathData = mathMap.get(placeholder);
        if (mathData) {
          parts.push(
            <MathFormulaBlock
              key={`${placeholder}-${index}`}
              content={mathData.content}
              inline={mathData.inline}
            />
          );
        } else {
          logger.sidebar.warn(`Math placeholder ${placeholder} not found in map. Rendering fallback marker.`);
          const fallbackText = mathType === 'INLINE' ? '[ inline math ]' : '[ block math ]';
          parts.push(fallbackText);
        }
        lastIndex = MATH_PLACEHOLDER_REGEX.lastIndex;
      }
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      return parts.length > 0 ? parts : [child];
    }

    // 2. Process React Element Children (Recursively)
    if (React.isValidElement(child) && child.props.children) {
      const processedGrandchildren = renderWithPlaceholdersRecursive(child.props.children, mathMap);
      const key = child.key ?? `child-${index}`;
      return React.cloneElement(child, { ...child.props, key: key }, processedGrandchildren);
    }

    // 3. Return other children as is
    return child;
  });
};


/**
 * Message bubble component
 */
export const MessageBubble = memo(({
  content,
  role = 'assistant',
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = ''
}) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const [copyState, setCopyState] = useState('idle');

  const handleCopyToClipboard = async () => {
    if (!content || isStreaming) return;
    try {
      await copyUtil(content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      logger.sidebar.error('Failed to copy text: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // System messages 
  if (isSystem) {
     return (
        <div className={`px-5 py-4 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md ${className}`}>
          <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
        </div>
      );
  }

  // User messages 
  if (isUser) {
    return (
      <div className={`px-5 py-2 mb-2 w-full flex justify-end items-start ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant Message Rendering
  if (role === 'assistant') {

    // --- Preprocessing Step  ---
    const mathMap = new Map();
    let preprocessedContent = '';
    let mathIndex = 0; // Renamed from idx for clarity
    try {
        const segments = parseTextAndMath(content || '');
        const processedSegments = segments.map((segment) => {
            if (segment.type === 'math') {
                const placeholder = `@@MATH_${segment.inline ? 'INLINE' : 'BLOCK'}_${mathIndex++}@@`;
                mathMap.set(placeholder, { content: segment.value, inline: segment.inline });
                return placeholder;
            }
            return segment.value;
        });
        preprocessedContent = processedSegments.join('');
    } catch (error) {
        logger.sidebar.error("Error during math preprocessing:", error);
        preprocessedContent = content || ''; // Fallback
    }

    // --- Optimization Check  ---
    const hasMathPlaceholders = HAS_MATH_PLACEHOLDER_REGEX.test(preprocessedContent);

    // --- Define Component Overrides ---
    const markdownComponents = {
        // --- Headings h1-h6 (Conditional processing, no nesting issue expected) ---
        h1: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h1 className="text-xl font-semibold mt-6 mb-4" {...props}>{processedChildren}</h1>;
        },
        h2: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h2 className="text-lg font-medium mt-5 mb-3" {...props}>{processedChildren}</h2>;
        },
        h3: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h3 className="text-base font-medium mt-4 mb-3" {...props}>{processedChildren}</h3>;
        },
        h4: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h4 className="text-sm font-medium mt-3 mb-2" {...props}>{processedChildren}</h4>;
        },
        h5: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h5 className="text-xs font-semibold mt-2 mb-1" {...props}>{processedChildren}</h5>;
        },
        h6: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h6 className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1" {...props}>{processedChildren}</h6>;
        },
        // --- Lists ul, ol, li (Conditional processing for li, no nesting issue expected) ---
        ul: ({node, ...props}) => <ul className="list-disc pl-5 my-4 space-y-2" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-4 space-y-2" {...props} />,
        li: ({node, children, ...props}) => {
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           return <li className="leading-relaxed text-sm" {...props}>{processedChildren}</li>;
        },

        // --- Paragraph Override ---
        p: ({ node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            const containsBlockElement = containsBlockElementCheck(processedChildren);
            const commonClasses = "mb-4 leading-relaxed text-sm";
            // Use div wrapper if block math is present to avoid p > div nesting
            const Tag = containsBlockElement ? 'div' : 'p';
            return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        // --- Code and Pre ---
        code: ({node, inline, className, children, ...props}) => {
           // Block code: Render EnhancedCodeBlock, no placeholder processing needed inside
           if (className && className.startsWith('language-')) {
              const codeContent = String(children).replace(/\n$/, '');
              const match = /language-(\w+)/.exec(className);
              const language = match ? match[1] : 'text';
              return <EnhancedCodeBlock className={`language-${language}`} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
           }

           // Inline code: Apply conditional placeholder processing AND nesting fix
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           const containsBlockElement = containsBlockElementCheck(processedChildren);
           const commonClasses = "bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5";
           // Use span wrapper if block math is present to avoid code > div nesting
           const Tag = containsBlockElement ? 'span' : 'code';
           return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        pre: ({node, children, ...props}) => {
          // Pre should typically contain only code, let code override handle it.
          // It can validly contain divs if needed.
          return <pre {...props}>{children}</pre>; // Render pre directly, code override handles content
        },
        // --- Link Override (Fixed) ---
        a: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "text-primary hover:underline";
          // Use span wrapper if block math is present to avoid a > div nesting
          const Tag = containsBlockElement ? 'span' : 'a';
          const tagProps = containsBlockElement
            ? { className: commonClasses, ...props } // Apply classes to span, keep other props
            : { className: commonClasses, target: "_blank", rel: "noopener noreferrer", ...props }; // Apply classes and link attrs to <a>
          return <Tag {...tagProps}>{processedChildren}</Tag>;
        },
        // --- Blockquote (Conditional processing, no nesting issue expected) ---
        blockquote: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          // blockquote can contain div
          return <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-4 py-1 text-sm" {...props}>{processedChildren}</blockquote>;
        },
        // --- Strong Override ---
        strong: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "font-semibold";
          // Use span wrapper if block math is present to avoid strong > div nesting
          const Tag = containsBlockElement ? 'span' : 'strong';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        // --- Emphasis Override ---
        em: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "italic";
          // Use span wrapper if block math is present to avoid em > div nesting
          const Tag = containsBlockElement ? 'span' : 'em';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
     };
    // --- End Component Overrides ---


    return (
      <div className={`group px-5 py-2 w-full message-group relative mb-2 ${className}`}>
        <div className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-3`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[]}
            components={markdownComponents}
            children={preprocessedContent}
           />
        </div>

        {/* Footer section  */}
        <div className="flex justify-between items-center -mt-1">
           <div className="text-xs opacity-70 flex items-center space-x-2">
            {platformIconUrl && !isUser && (
              <img src={platformIconUrl} alt="AI Platform" className="w-3.5 h-3.5 object-contain" />
            )}
            {model && !isUser && <span>{model}</span>}
            {isStreaming && (
              <div className="flex gap-1 items-center">
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          <div className="w-7 h-7 flex items-center justify-center">
            {!isStreaming && content && content.trim() && (
              <button
                onClick={handleCopyToClipboard}
                className={`p-1 rounded-md transition-opacity duration-200 z-10 ${copyState === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                aria-label="Copy to clipboard" title="Copy to clipboard"
              >
                <CopyButtonIcon state={copyState} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata  */}
        {Object.keys(metadata).length > 0 && (
          <div className="text-xs mt-3 opacity-70 overflow-hidden text-ellipsis space-x-3">
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} className="inline-block break-words">
                <span className='font-medium'>{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null; // Fallback return
});

MessageBubble.displayName = 'MessageBubble';
```

# src/sidebar/components/messaging/utils/clipboard.js

```js
/**
 * Utility function for clipboard operations
 * Implements the modern clipboard API with fallback to document.execCommand
 * @param {string} text - The text content to copy to clipboard
 * @returns {Promise<void>} - Resolves if successful, rejects with error otherwise
 */
export const copyToClipboard = async (text) => {
  // First try the modern clipboard API if available
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn('navigator.clipboard.writeText failed, falling back:', error);
      // Continue to fallback method
    }
  }

  // Fallback to document.execCommand
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  try {
    textarea.select();
    const successful = document.execCommand('copy');
    
    if (!successful) {
      throw new Error('Fallback copy method (execCommand) failed');
    }
  } catch (error) {
    console.error('Fallback copy method failed:', error);
    throw error;
  } finally {
    document.body.removeChild(textarea);
  }
};

```

# src/sidebar/components/messaging/utils/parseTextAndMath.js

```js
/**
 * Parses text and math expressions from a given string.
 * It identifies LaTeX-style math expressions and separates them from regular text.
 * @param {string} text - The input string containing text and math expressions.
 * @returns {Array} - An array of objects representing the parsed content.
 * Each object has a 'type' property ('text' or 'math') and a 'value' property containing the content.
 * The 'inline' property indicates whether the math expression is inline or block.
 */
export const parseTextAndMath = (text) => {
  if (!text) {
      return [];
  }
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\]|\$.+?\$|\\\(.+?\\\))/g;
  const result = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textValue = text.slice(lastIndex, match.index);
      result.push({ type: 'text', value: textValue, inline: false });
    }
    const part = match[0];
    let mathContent = '';
    let inline = true;
    if (part.startsWith('$$') && part.endsWith('$$')) {
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('\\[')) {
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      mathContent = part.slice(1, -1);
      inline = true;
    } else if (part.startsWith('\\(')) {
      mathContent = part.slice(2, -2);
      inline = true;
    } else {
       result.push({ type: 'text', value: part, inline: false });
       lastIndex = regex.lastIndex;
       continue;
    }
    const trimmedMathContent = mathContent.trim();
    if (trimmedMathContent) {
       result.push({ type: 'math', value: trimmedMathContent, inline });
    } else {
       result.push({ type: 'text', value: part, inline: false });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    result.push({ type: 'text', value: remainingText, inline: false });
  }
  return result;
};
```

# src/sidebar/components/ModelSelector.jsx

```jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { DropdownContext } from './Header';

// SVG Icons
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

function ModelSelector({ className = '', selectedPlatformId = null }) {
  const {
    models,
    selectedModel,
    selectModel,
  } = useSidebarPlatform();

  const [formattedModels, setFormattedModels] = useState([]);
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const isOpen = openDropdown === 'model';
  const dropdownRef = useRef(null);
  const modelTriggerRef = useRef(null);

  // Format models for dropdown display
  useEffect(() => {
    if (!models || models.length === 0) {
      setFormattedModels([]);
      return;
    }

    // Convert models to consistent format
    const formatted = models.map(model => {
      if (typeof model === 'object' && model !== null) {
        return {
          id: model.id,
          name: model.name || model.id
        };
      } else {
        return {
          id: model,
          name: model
        };
      }
    });

    setFormattedModels(formatted);
  }, [models]);

  // Effect to handle clicks outside the model dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        modelTriggerRef.current && !modelTriggerRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenDropdown]);

  const handleModelChange = async (modelId) => {
    if (modelId && selectedPlatformId) {
      await selectModel(modelId);
      setOpenDropdown(null);
    }
  };

  const selectedModelName = formattedModels.find(m => m.id === selectedModel)?.name
                           || selectedModel
                           || "Loading...";

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : 'model');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={modelTriggerRef}
        onClick={toggleDropdown}
        className="flex items-center px-2 py-1.5 h-9 bg-transparent border-0 rounded text-theme-primary text-sm transition-colors cursor-pointer w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate mr-1">{selectedModelName}</span>
        <span className="text-theme-secondary flex-shrink-0">
          <ChevronIcon />
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 w-auto overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          role="listbox" // ARIA role
          aria-labelledby={modelTriggerRef.current?.id || undefined} // Link to button if it has an ID
        >
          {formattedModels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-theme-secondary">
              No models available
            </div>
          ) : (
            formattedModels.map((model) => (
              <button
                key={model.id}
                role="option" // ARIA role for item
                aria-selected={selectedModel === model.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-hover whitespace-nowrap ${
                  selectedModel === model.id ? 'font-medium bg-theme-hover' : ''
                }`}
                onClick={() => handleModelChange(model.id)}
              >
                {model.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
```

# src/sidebar/components/TokenCounter.jsx

```jsx
import React, { useState, useRef } from 'react';
import { Tooltip } from '../../components/layout/Tooltip';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  const {
    outputTokens = 0,
    accumulatedCost = 0,
    historyTokensSentInLastApiCall = 0,
    inputTokensInLastApiCall = 0,
    lastApiCallCost = 0,
    promptTokensInLastApiCall = 0,
    systemTokensInLastApiCall = 0
  } = tokenStats || {};

  // Toggle for expanded details view
  const [showDetails, setShowDetails] = useState(false);

  // Tooltip hover states
  const [hoveredElement, setHoveredElement] = useState(null);

  // Refs for tooltip targets
  const inputTokensRef = useRef(null);
  const outputTokensRef = useRef(null);
  const costRef = useRef(null);
  const lastCostRef = useRef(null);
  const promptRef = useRef(null);
  const historySentRef = useRef(null);
  const systemRef = useRef(null);
  const contextWindowRef = useRef(null);

  // Format cost with appropriate decimal places
  const formatCost = (cost) => {
    if (cost === 0) return '$0.00';

    if (cost < 0.01) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }).format(cost);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(cost);
  };

  const formattedCost = formatCost(accumulatedCost);

  // Ensure we have context status data with safe defaults
  const contextData = contextStatus || {
    warningLevel: 'none',
    percentage: 0,
    tokensRemaining: 0,
    totalTokens: 0 // Ensure totalTokens exists for the tooltip
  };

  // Ensure tokensRemaining is always defined with a safe default
  const tokensRemaining = contextData.tokensRemaining || 0;

  // Tooltip content definitions (Incorporating the base disclaimer)
  const tooltipContent = {
    inputTokens: `Est. total input tokens (system + history + prompt) sent in the last API request.`,
    outputTokens: `Est. total output tokens generated in this chat session.`,
    cost: `Est. total accumulated cost for this chat session.`,
    lastCost: `Est. cost of the last API call.`,
    prompt: `Est. tokens in the user prompt sent in the last API request.`,
    historySent: `Est. tokens from conversation history sent in the last API request.`,
    system: `Est. tokens from system instructions sent in the last API request.`,
    contextWindow: `Est. ${tokensRemaining.toLocaleString()} tokens remaining in context window (${contextData.totalTokens?.toLocaleString()} used).`
  };

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          {/* Input tokens with tooltip */}
          <div
            ref={inputTokensRef}
            className="flex items-center relative cursor-help"
            onMouseEnter={() => setHoveredElement('inputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('inputTokens')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 18V6M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{inputTokensInLastApiCall.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'inputTokens'} message={tooltipContent.inputTokens} targetRef={inputTokensRef} />
          </div>

          {/* Output tokens (Cumulative) with tooltip */}
          <div
            ref={outputTokensRef}
            className="flex items-center relative cursor-help"
            onMouseEnter={() => setHoveredElement('outputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('outputTokens')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 6v12M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{outputTokens.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'outputTokens'} message={tooltipContent.outputTokens} targetRef={outputTokensRef} />
          </div>
        </div>

        <div className="flex items-center">
          {/* Last Call Cost with tooltip */}
          <div
            ref={lastCostRef}
            className="relative cursor-help text-gray-400 dark:text-gray-500 mr-2"
            onMouseEnter={() => setHoveredElement('lastCost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('lastCost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span>({formatCost(lastApiCallCost)})</span>
            <Tooltip show={hoveredElement === 'lastCost'} message={tooltipContent.lastCost} targetRef={lastCostRef} />
          </div>

          {/* Accumulated Cost with tooltip */}
          <div
            ref={costRef}
            className="relative cursor-help"
            onMouseEnter={() => setHoveredElement('cost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('cost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span>{formattedCost}</span>
            <Tooltip show={hoveredElement === 'cost'} message={tooltipContent.cost} targetRef={costRef} />
          </div>


          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
            title="Toggle token details"
          >
          <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 15l-7 -7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          </button>
        </div>
      </div>

      {/* --- Expanded Details Section --- */}
      {showDetails && (
        <>
          {/* Grid for detailed token breakdown */}
          <div className="mt-2 py-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
            {/* Prompt tokens */}
            <div
              ref={promptRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('prompt')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('prompt')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">Prompt</span>
              <span>{promptTokensInLastApiCall.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'prompt'} message={tooltipContent.prompt} targetRef={promptRef} />
            </div>

            {/* History Sent tokens */}
            <div
              ref={historySentRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('historySent')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('historySent')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">History</span>
              <span>{historyTokensSentInLastApiCall.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'historySent'} message={tooltipContent.historySent} targetRef={historySentRef} />
            </div>

            {/* System Sent tokens */}
            <div
              ref={systemRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('system')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('system')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">System</span>
              <span>{systemTokensInLastApiCall.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'system'} message={tooltipContent.system} targetRef={systemRef} />
            </div>
          </div>

          {/* Context window progress bar */}
          <div>
            <div
              ref={contextWindowRef}
              className="flex items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('contextWindow')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('contextWindow')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mr-2">
                <div
                  className={`h-1.5 rounded-full ${
                    contextData.warningLevel === 'critical' ? 'bg-red-500' :
                    contextData.warningLevel === 'warning' ? 'bg-yellow-500' :
                    contextData.warningLevel === 'notice' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min(100, contextData.percentage || 0)}%` }}
                ></div>
              </div>
              <span className="text-xs whitespace-nowrap">
                {Math.min(100, contextData.percentage || 0).toFixed(1)}%
              </span>
              <Tooltip show={hoveredElement === 'contextWindow'} message={tooltipContent.contextWindow} position="bottom" targetRef={contextWindowRef} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TokenCounter;
```

# src/sidebar/components/UserInput.jsx

```jsx
// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
import { useContent } from '../../contexts/ContentContext';

export function UserInput({ className = '' }) {
  const { contentType } = useContent();
  const {
    inputValue,
    setInputValue,
    sendMessage,
    cancelStream,
    isProcessing,
    isCanceling,
    tokenStats,
    contextStatus
  } = useSidebarChat();

  const handleInputChange = (value) => {
    setInputValue(value);
  };

  const handleSend = (value) => {
    sendMessage(value);
  };

  const handleCancel = () => {
    cancelStream();
  };

  return (
    <UnifiedInput
      value={inputValue}
      onChange={handleInputChange}
      onSubmit={handleSend}
      onCancel={handleCancel}
      disabled={isProcessing && isCanceling}
      isProcessing={isProcessing}
      isCanceling={isCanceling}
      placeholder="Type a message or select a prompt..."
      contentType={contentType}
      showTokenInfo={true}
      tokenStats={tokenStats}
      contextStatus={contextStatus}
      layoutVariant='sidebar'
      className={className}
    />
  );
}

```

# src/sidebar/contexts/SidebarChatContext.jsx

```jsx
// src/sidebar/contexts/SidebarChatContext.jsx

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../contexts/ContentContext';
import { useTokenTracking } from '../hooks/useTokenTracking';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../../shared/constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { robustSendMessage } from '../../shared/utils/message-utils';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const {
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    tabId,
    platforms,
    getPlatformApiConfig
  } = useSidebarPlatform();

  const { contentType, currentTab } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [contextStatus, setContextStatus] = useState({ warningLevel: 'none' });
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] = useState(true);
  const [modelConfigData, setModelConfigData] = useState(null);
  const batchedStreamingContentRef = useRef('');
  const rafIdRef = useRef(null);

  // Use the token tracking hook
  const {
    tokenStats,
    calculateContextStatus,
    clearTokenData,
    calculateStats
  } = useTokenTracking(tabId);

  // Use the content processing hook
  const {
    processContentViaApi,
    isProcessing,
    error: processingError,
    reset: resetContentProcessing,
  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);

  // Get platform info
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  // Load full platform configuration when platform or model changes
  useEffect(() => {
    const loadFullConfig = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId) return;

      try {
        // Get API configuration using the new function (synchronous)
        const config = await getPlatformApiConfig(selectedPlatformId);
        if (!config || !config.models) {
          console.warn('Platform API configuration missing required structure:', {
            platformId: selectedPlatformId,
            hasModels: !!config?.models
          });
          setModelConfigData(null); // Clear model data if config is invalid
          return;
        }

        // Find model data directly in config.models
        const modelData = config.models.find(m => m.id === selectedModel);
        setModelConfigData(modelData);
      } catch (error) {
        console.error('Failed to load or process platform API configuration:', error);
        setModelConfigData(null);
      }
    };

    loadFullConfig();
  }, [selectedPlatformId, selectedModel, tabId, getPlatformApiConfig]);

  // Update context status when model config or token stats change
  useEffect(() => {
    const updateContextStatus = async () => {
      if (!tabId || !modelConfigData) {
        setContextStatus({ warningLevel: 'none' });
        return;
      }

      try {
        const status = await calculateContextStatus(modelConfigData);
        setContextStatus(status);
      } catch (error) {
        console.error('Error calculating context status:', error);
        setContextStatus({ warningLevel: 'none' });
      }
    };

    updateContextStatus();
  }, [tabId, modelConfigData, tokenStats, calculateContextStatus]);

  // Load chat history for current tab
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!tabId) return;

      try {
        // Load chat history for this tab
        const history = await ChatHistoryService.getHistory(tabId);
        setMessages(history);

        // Calculate token statistics based on the history
        if (history.length > 0 && modelConfigData) {
          await calculateStats(history, modelConfigData);
        }

        // Reset extracted content flag when tab changes
        setExtractedContentAdded(history.length > 0);
      } catch (error) {
        console.error('Error loading tab chat history:', error);
      }
    };

    loadChatHistory();
  }, [tabId]);

  // Get visible messages (filtering out extracted content)
  const visibleMessages = useMemo(() => {
    return messages.filter(msg => !msg.isExtractedContent);
  }, [messages]);

  // Reset processing when the tab changes
  useEffect(() => {
    if (tabId) {
      resetContentProcessing();
    }
  }, [tabId, resetContentProcessing]);

  // --- State Update Logic (using requestAnimationFrame) ---
  const performStreamingStateUpdate = useCallback(() => {
    rafIdRef.current = null; // Reset the ref after the frame executes
    const messageId = streamingMessageId; // Read current streaming ID from state
    const accumulatedContent = batchedStreamingContentRef.current; // Read buffered content

    if (!messageId) return; // Safety check

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: accumulatedContent, // Update with the full batched content
              isStreaming: true, // Keep streaming flag true during debounced updates
            }
          : msg
      )
    );
  }, [streamingMessageId]); // Dependency: streamingMessageId state

  // Handle streaming response chunks
  useEffect(() => {
    /**
     * Finalizes the state of a message after its stream completes, errors out, or is cancelled.
     * Calculates output tokens for the final content, updates the message in the state array,
     * potentially prepends extracted content, saves history, and triggers token recalculation.
     *
     * @param {string} messageId - ID of the message being finalized.
     * @param {string} finalContentInput - The complete content string received.
     * @param {string|null} model - The model used for the response.
     * @param {boolean} [isError=false] - Flag indicating if the stream ended due to an error.
     * @param {boolean} [isCancelled=false] - Flag indicating if the stream was cancelled by the user.
     */
    const handleStreamComplete = async (messageId, finalContentInput, model, isError = false, isCancelled = false) => {
      try {
        // Calculate output tokens using the potentially modified finalContent - Removed await
        const outputTokens = TokenManagementService.estimateTokens(finalContentInput);
        let finalContent = finalContentInput; // Use a mutable variable
        if (isCancelled) {
          // Append cancellation notice if the stream was cancelled
          finalContent += '\n\n_Stream cancelled by user._';
        }

        // Update message with final content (using the potentially modified finalContent)
        let updatedMessages = messages.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                content: finalContent,
                isStreaming: false, // Explicitly mark as not streaming
                model: model || selectedModel,
                platformIconUrl: msg.platformIconUrl,
                outputTokens,
                // If this is an error, change the role to system
                role: isError ? MESSAGE_ROLES.SYSTEM : msg.role
              }
            : msg
        );

        // If content not added yet, add extracted content message
        if (!extractedContentAdded && !isError) {
          try {
            // Get formatted content from storage
            const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_FORMATTED_CONTENT]);
            const allTabContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

            if (allTabContents) {
              const tabIdKey = tabId.toString();
              const extractedContent = allTabContents[tabIdKey];

              if (extractedContent && typeof extractedContent === 'string' && extractedContent.trim()) {
                const contentMessage = {
                  id: `extracted_${Date.now()}`,
                  role: MESSAGE_ROLES.USER,
                  content: extractedContent,
                  timestamp: new Date().toISOString(),
                  inputTokens: TokenManagementService.estimateTokens(extractedContent),
                  outputTokens: 0,
                  isExtractedContent: true
                };

                // Add extracted content at beginning
                updatedMessages = [contentMessage, ...updatedMessages];

                // Mark as added to prevent duplicate additions
                setExtractedContentAdded(true);
              }
            }
          } catch (extractError) {
            console.error('Error adding extracted content:', extractError);
          }
        }

        // Set messages with all updates at once
        setMessages(updatedMessages);
        batchedStreamingContentRef.current = ''; // Clear buffer on completion

        // Save history
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, updatedMessages, modelConfigData);
        }
      } catch (error) {
        console.error('Error handling stream completion:', error);
      }
    };

    /**
     * Processes incoming message chunks from the background script during an active stream.
     * Handles error chunks, completion chunks (including cancellation), and intermediate content chunks.
     * Updates the UI live and calls `handleStreamComplete` to finalize the message state.
     * Resets streaming-related state variables upon stream completion, error, or cancellation.
     *
     * @param {object} message - The message object received from `chrome.runtime.onMessage`.
     *                           Expected structure: `{ action: 'streamChunk', chunkData: {...}, streamId: '...' }`
     *                           `chunkData` contains `chunk`, `done`, `error`, `cancelled`, `fullContent`, `model`.
     */
    const handleStreamChunk = async (message) => {
      if (message.action === 'streamChunk' && streamingMessageId) {
        const { chunkData } = message;

        // Ensure chunkData is properly formatted
        if (!chunkData) {
          console.error('Invalid chunk data received:', message);
          return;
        }

        // Handle stream error
        if (chunkData.error) {
          const errorMessage = chunkData.error;
          console.error('Stream error:', errorMessage);

          // Complete the stream with the error message
          await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true);

          setStreamingMessageId(null);
          setIsCanceling(false);

          return;
        }

        // Process chunk content - ensure it's a string
        const chunkContent = typeof chunkData.chunk === 'string'
          ? chunkData.chunk
          : (chunkData.chunk ? JSON.stringify(chunkData.chunk) : '');

        // Handle stream completion, cancellation, or error
        if (chunkData.done) {
          // Cancel any pending animation frame before completing
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          if (chunkData.cancelled === true) {
            // Handle Cancellation: Stream was cancelled by the user (via background script signal)
            console.info(`Stream ${message.streamId} received cancellation signal.`);
            // Use partial content received so far, mark as cancelled but not an error
            const finalContent = chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            await handleStreamComplete(streamingMessageId, finalContent, chunkData.model, false, true); // isError=false, isCancelled=true

          } else if (chunkData.error) {
            // Handle Error: Stream ended with an error (other than user cancellation)
            const errorMessage = chunkData.error;
            console.error(`Stream ${message.streamId} error:`, errorMessage);
            // Update the message with the error, mark as error, not cancelled
            // Use buffered ref as fallback for error message context if needed, though error message itself is primary
            const finalContentOnError = chunkData.fullContent || batchedStreamingContentRef.current;
            await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true, false); // isError=true, isCancelled=false

          } else {
            // Handle Success: Stream completed normally
            const finalContent = chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            console.info(`Stream ${message.streamId} completed successfully. Final length: ${finalContent.length}`);
            // Update message with final content, mark as success (not error, not cancelled)
            await handleStreamComplete(streamingMessageId, finalContent, chunkData.model, false, false); // isError=false, isCancelled=false

          }
          // Reset state regardless of outcome (completion, cancellation, error)
          setStreamingMessageId(null);
          // setStreamingContent(''); // Keep this commented or remove, buffer cleared elsewhere
          setIsCanceling(false); // Reset canceling state
        } else if (chunkContent) {
          // Process Intermediate Chunk: Append chunk to the ref buffer
          batchedStreamingContentRef.current += chunkContent;
          // Schedule UI update using requestAnimationFrame if not already scheduled
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(performStreamingStateUpdate);
          }
        }
      }
    };

    // Add listener
    chrome.runtime.onMessage.addListener(handleStreamChunk);

    return () => {
      chrome.runtime.onMessage.removeListener(handleStreamChunk);
      // Cancel any pending animation frame on cleanup
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null; // Also reset the ref here
      }
    };
  }, [streamingMessageId, messages, visibleMessages, tabId, selectedModel,
      selectedPlatformId, modelConfigData, extractedContentAdded]);

  /**
   * Sends a user message, triggers the API call via processContentViaApi,
   * handles the streaming response (via handleStreamChunk/handleStreamComplete),
   * updates message state, and saves history.
   */
  const sendMessage = async (text = inputValue) => {
    // Retrieve platform/model state from context *inside* the function
    // This ensures we get the latest values when the function is called
    const currentPlatformId = selectedPlatformId;
    const currentModelId = selectedModel;
    const currentHasCreds = hasAnyPlatformCredentials;

    // Pre-flight validation check
    if (!currentPlatformId || !currentModelId || !currentHasCreds) {
      let errorMessage = 'Error: ';
      if (!currentPlatformId) errorMessage += 'Please select a platform. ';
      if (!currentModelId) errorMessage += 'Please select a model. ';
      if (!currentHasCreds) errorMessage += 'Valid API credentials are required for the selected platform.';

      setMessages(prev => [...prev, {
        id: `sys_err_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
        content: errorMessage.trim(),
        timestamp: new Date().toISOString()
      }]);
      return; // Abort if validation fails
    }

    // Original checks remain
    if (!text.trim() || isProcessing || !tabId) return;

    // Estimate tokens for the user message - Removed await
    const inputTokens = TokenManagementService.estimateTokens(text.trim());
    const userMessageId = `msg_${Date.now()}`;

    const userMessage = {
      id: userMessageId,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString(),
      inputTokens,
      outputTokens: 0
    };

    // Create placeholder for assistant response with explicit streaming flag
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: '', // Empty initially, will be streamed
      model: selectedModel,
      platformIconUrl: selectedPlatform.iconUrl,
      timestamp: new Date().toISOString(),
      isStreaming: true,
      inputTokens: 0, // No input tokens for assistant messages
      outputTokens: 0 // Will be updated when streaming completes
    };

    // Update UI with user message and assistant placeholder
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setStreamingMessageId(assistantMessageId);
    batchedStreamingContentRef.current = ''; // Reset buffer

    // Determine if this is the first message (before adding the current user message)
    const isFirstMessage = messages.length === 0;
    // Determine if the current page is injectable
    const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false; // Added injectability check

    try {
      // Format conversation history for the API - Filter out streaming messages and extracted content messages
      const conversationHistory = messages
        .filter(msg => (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) && !msg.isStreaming)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

      // Process with API in streaming mode - Pass explicit IDs
      const result = await processContentViaApi({
        platformId: currentPlatformId, // Use the ID retrieved at the start
        modelId: currentModelId,       // Use the ID retrieved at the start
        promptContent: text.trim(),
        conversationHistory,
        streaming: true,
        // Determine if extraction should be skipped for the first message
        skipInitialExtraction: isFirstMessage ? (!isContentExtractionEnabled || !isPageInjectable) : true, // Updated logic
        // Pass tabId and source explicitly if needed by the hook/API
        options: { tabId, source: INTERFACE_SOURCES.SIDEBAR }
      });

      // Handle case where context extraction was skipped (e.g., non-injectable page)
      if (result && result.skippedContext === true) {
        console.info('Context extraction skipped by background:', result.reason);

        // Create the system message explaining why
        const systemMessage = {
          id: `sys_${Date.now()}`,
          role: MESSAGE_ROLES.SYSTEM,
          content: `Note: ${result.reason || 'Page content could not be included.'}`,
          timestamp: new Date().toISOString(),
        };

        const finalMessages = messages // Use 'messages' which doesn't include the placeholder yet
            .concat(userMessage, systemMessage); // Add user msg + system msg

        setMessages(finalMessages); // Update UI immediately

        // Save this state (user message + system message) to history
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, finalMessages, modelConfigData);
          // No API call made, so no cost to update here, user msg tokens already tracked
        }

        // Reset streaming state as no stream was initiated
        setStreamingMessageId(null);
        resetContentProcessing(); // Reset the hook's processing state

        return; // Stop further processing for this message send
      }

      if (!result || !result.success) {
        // Use the error from the result if available, otherwise use a default
        const errorMsg = result?.error || 'Failed to initialize streaming';
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('Error processing streaming message:', error);

      // Update streaming message to show error
      const errorMessages = messages.map(msg => // Use 'messages' which doesn't include the placeholder yet
        msg.id === userMessageId // Find the user message we just added
          ? msg // Keep user message as is
          : null // Placeholder for where the assistant message would have been
      ).filter(Boolean); // Remove the null placeholder

      // Add the system error message
      const systemErrorMessage = {
        id: assistantMessageId, // Reuse the ID intended for the assistant
        role: MESSAGE_ROLES.SYSTEM,
        content: `Error: ${error.message || 'Failed to process request'}`,
        timestamp: new Date().toISOString(),
        isStreaming: false // Turn off streaming state
      };

      const finalErrorMessages = [...errorMessages, systemErrorMessage];

      setMessages(finalErrorMessages);

      // Save error state to history
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, finalErrorMessages, modelConfigData);
      }

      setStreamingMessageId(null);
      resetContentProcessing(); // Ensure hook state is reset on error too
    }
  };

  /**
   * Sends a cancellation request to the background script for the currently active stream,
   * updates the UI state to reflect cancellation, and saves the final state.
   */
  const cancelStream = async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const result = await chrome.storage.local.get(STORAGE_KEYS.STREAM_ID);
    // Extract the actual string ID from the object
    const streamId = result[STORAGE_KEYS.STREAM_ID];
    setIsCanceling(true);
    // Cancel any pending animation frame immediately on cancellation request
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      // Send cancellation message to background script
      const result = await robustSendMessage({
        action: 'cancelStream',
        streamId: streamId,
      });

      // Update the streaming message content to indicate cancellation
      const cancelledContent = batchedStreamingContentRef.current + '\n\n_Stream cancelled by user._';

      // Calculate output tokens for the cancelled content - Removed await
      const outputTokens = TokenManagementService.estimateTokens(cancelledContent);

      let messagesAfterCancel = messages; // Start with current messages

      if (!extractedContentAdded) {
        try {
          const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_FORMATTED_CONTENT]);
          const allTabContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

          if (allTabContents) {
            const tabIdKey = tabId.toString();
            const extractedContent = allTabContents[tabIdKey];

            if (extractedContent && typeof extractedContent === 'string' && extractedContent.trim()) {
              const contentMessage = {
                id: `extracted_${Date.now()}`,
                  role: MESSAGE_ROLES.USER,
                  content: extractedContent,
                  timestamp: new Date().toISOString(),
                  inputTokens: TokenManagementService.estimateTokens(extractedContent),
                  outputTokens: 0,
                  isExtractedContent: true
                };

              // Find index of the message being cancelled
              const cancelledMsgIndex = messages.findIndex(msg => msg.id === streamingMessageId);

              if (cancelledMsgIndex !== -1) {
                // Insert content message before the cancelled message
                const messagesWithContent = [
                  ...messages.slice(0, cancelledMsgIndex),
                  contentMessage,
                  ...messages.slice(cancelledMsgIndex)
                ];

                // Update the local variable holding the messages
                messagesAfterCancel = messagesWithContent;

                // Update state immediately to reflect added content
                setMessages(messagesAfterCancel);
                setExtractedContentAdded(true);

              } else {
                 console.warn('Cancelled message not found, cannot insert extracted content correctly.');
              }
            }
          }
        } catch (extractError) {
          console.error('Error adding extracted content during cancellation:', extractError);
        }
      }

      // Update the cancelled message content within the potentially updated array
      const finalMessages = messagesAfterCancel.map(msg =>
        msg.id === streamingMessageId
          ? {
              ...msg,
              content: cancelledContent,
              isStreaming: false,
              outputTokens
            }
          : msg
      );

      // Update state with the final message list
      setMessages(finalMessages);

      // Save the final state to history
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, finalMessages, modelConfigData);
      }

      // Reset streaming state
      setStreamingMessageId(null);
      batchedStreamingContentRef.current = ''; // Clear buffer on cancellation

    } catch (error) {
      console.error('Error cancelling stream:', error);
      setStreamingMessageId(null);
    } finally {
      setIsCanceling(false);
    }
  };

  // Clear chat history and token metadata
  const clearChat = async () => {
    if (!tabId) return;

    setMessages([]);
    setExtractedContentAdded(false); // Reset the flag so content can be added again
    await ChatHistoryService.clearHistory(tabId);

    // Clear token metadata
    await clearTokenData();
  };

  /**
   * Clears all chat history, token data, and formatted content stored
   * for the current tab by sending a message to the background script.
   * Prompts the user for confirmation before proceeding.
   * Also cancels any ongoing stream.
   */
  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      console.warn('resetCurrentTabData called without a valid tabId.');
      return;
    }

    if (window.confirm("Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.")) {
      try {
        if (streamingMessageId && isProcessing && !isCanceling) {
          console.info('Refresh requested: Cancelling ongoing stream first...');
          await cancelStream(); // Wait for cancellation to attempt completion
          console.info('Stream cancellation attempted.');
        }

        const response = await robustSendMessage({
          action: 'clearTabData',
          tabId: tabId
        });

        if (response && response.success) {
          setMessages([]);
          setInputValue('');
          setStreamingMessageId(null); // Ensure streaming ID is cleared if cancellation didn't reset it
          setExtractedContentAdded(false); // Allow extracted content to be added again
          setIsCanceling(false); // Ensure canceling state is reset

          // Clear token data (which also recalculates stats)
          await clearTokenData();

        } else {
          throw new Error(response?.error || 'Background script failed to clear data.');
        }
      } catch (error) {
        console.error('Failed to reset tab data:', error);
        // Ensure canceling state is reset even on error
        setIsCanceling(false);
      }
    }
  }, [
    tabId,
    clearTokenData,
    setMessages,
    setInputValue,
    setStreamingMessageId,
    setExtractedContentAdded,
    setIsCanceling,
    streamingMessageId,
    isProcessing,
    isCanceling,
    cancelStream
  ]);

  /**
   * Clears only the stored formatted page content (extracted content)
   * for the current tab from local storage. Also resets the `extractedContentAdded` flag.
   */
  const clearFormattedContentForTab = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      console.warn('clearFormattedContentForTab called without a valid tabId.');
      return;
    }

    const tabIdKey = tabId.toString();
    console.info(`Attempting to clear formatted content for tab: ${tabIdKey}`);

    try {
      // Retrieve the entire formatted content object
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};

      // Check if the key exists before deleting
      if (allFormattedContent.hasOwnProperty(tabIdKey)) {
        // Create a mutable copy to avoid modifying the original object directly from storage result
        const updatedFormattedContent = { ...allFormattedContent };

        // Delete the entry for the current tab
        delete updatedFormattedContent[tabIdKey];

        // Save the modified object back to storage
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: updatedFormattedContent });
        console.info(`Successfully cleared formatted content for tab: ${tabIdKey}`);
      } else {
        console.info(`No formatted content found in storage for tab: ${tabIdKey}. No action needed.`);
      }

      // Also reset the local flag indicating if extracted content was added to the current chat view
      setExtractedContentAdded(false);
      console.info(`Reset extractedContentAdded flag for tab: ${tabIdKey}`);

    } catch (error) {
      console.error(`Error clearing formatted content for tab ${tabIdKey}:`, error);
    }
  }, [tabId, setExtractedContentAdded]);

  return (
    <SidebarChatContext.Provider value={{
      messages: visibleMessages,
      allMessages: messages,
      inputValue,
      setInputValue,
      sendMessage,
      cancelStream,
      isCanceling,
      clearChat,
      isProcessing,
      apiError: processingError,
      contentType,
      tokenStats,
      contextStatus,
      resetCurrentTabData,
      clearFormattedContentForTab,
      isContentExtractionEnabled,
      setIsContentExtractionEnabled,
      modelConfigData
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

```

# src/sidebar/hooks/useTokenTracking.js

```js
// src/sidebar/hooks/useTokenTracking.js

import { useState, useEffect, useCallback } from 'react';
import TokenManagementService from '../services/TokenManagementService';
import { STORAGE_KEYS } from "../../shared/constants";

/**
 * Hook for tracking token usage and providing token statistics in React components
 * Thin wrapper around TokenManagementService for React state management
 * 
 * @param {number} tabId - Tab ID
 * @returns {Object} - Token tracking capabilities and statistics
 */
export function useTokenTracking(tabId) {
  // Initialize state using the updated structure from TokenManagementService
  const [tokenStats, setTokenStats] = useState(TokenManagementService._getEmptyStats());
  const [isLoading, setIsLoading] = useState(true);

  // Load token data for the tab on mount and when tab changes
  useEffect(() => {
    const loadData = async () => {
      if (!tabId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Load token stats using service
        const stats = await TokenManagementService.getTokenStatistics(tabId);
        setTokenStats(stats);
      } catch (error) {
        console.error('Error loading token data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    // Set up a listener for storage changes to keep state in sync
    const handleStorageChange = (changes, area) => {
      if (area !== 'local' || !tabId) return;
      
      // Check if token statistics were updated directly in storage
      if (changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS] &&
          changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue) {
        const allTokenStats = changes[STORAGE_KEYS.TAB_TOKEN_STATISTICS].newValue;
        const tabStats = allTokenStats[tabId];
        if (tabStats) {
          // Ensure all fields, including new ones, are updated
          setTokenStats(prevStats => ({
            ...TokenManagementService._getEmptyStats(), // Start with default empty stats
            ...tabStats, // Overwrite with values from storage
            isCalculated: true // Mark as calculated
          }));
        }
      }
    };
    
    // Add storage change listener
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // Clean up listener
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [tabId]);

  /**
   * Calculate context window status based on current token stats
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status object
   */
  const calculateContextStatus = useCallback(async (modelConfig) => {
    if (!tabId || !modelConfig) {
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
    
    // Use direct service call with current token stats
    return TokenManagementService.calculateContextStatus(tokenStats, modelConfig);
  }, [tabId, tokenStats]);

  /**
   * Clear all token data for the current tab
   * @returns {Promise<boolean>} - Success indicator
   */
  const clearTokenData = useCallback(async () => {
    if (!tabId) return false;
    
    try {
      const success = await TokenManagementService.clearTokenStatistics(tabId);
      
      if (success) {
        // Reset state to empty stats
        setTokenStats(TokenManagementService._getEmptyStats());
      }
      
      return success;
    } catch (error) {
      console.error('Error clearing token data:', error);
      return false;
    }
  }, [tabId]);

  /**
   * Calculate and update token statistics for the current tab
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Updated token statistics
   */
  const calculateStats = useCallback(async (messages, modelConfig = null) => {
    if (!tabId) return tokenStats;
    
    try {
      const stats = await TokenManagementService.calculateAndUpdateStatistics(
        tabId,
        messages,
        modelConfig
      );
      
      setTokenStats(stats);
      return stats;
    } catch (error) {
      console.error('Error calculating token statistics:', error);
      return tokenStats;
    }
  }, [tabId, tokenStats]);

  return {
      tokenStats,
      setTokenStats,
      isLoading,
      calculateContextStatus,
      clearTokenData,
      calculateStats,
      estimateTokens: TokenManagementService.estimateTokens,
      getPricingInfo: TokenManagementService.getPricingInfo,
      calculateCost: TokenManagementService.calculateCost
  };
}

```

# src/sidebar/index.jsx

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarApp from './SidebarApp';
import { UIProvider } from '../contexts/UIContext';
import { SidebarPlatformProvider } from '../contexts/platform';
import { SidebarChatProvider } from './contexts/SidebarChatContext';
import { ContentProvider } from '../contexts/ContentContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);
  
  root.render(
    <UIProvider>
      <ContentProvider>
        <SidebarPlatformProvider>
          <SidebarChatProvider>
            <SidebarApp />
          </SidebarChatProvider>
        </SidebarPlatformProvider>
      </ContentProvider>
    </UIProvider>
  );
});

```

# src/sidebar/services/ChatHistoryService.js

```js
// src/sidebar/services/ChatHistoryService.js

import { STORAGE_KEYS } from "../../shared/constants";
import TokenManagementService from "./TokenManagementService";

/**
 * Service for managing tab-specific chat histories
 */
class ChatHistoryService {
  static STORAGE_KEY = STORAGE_KEYS.TAB_CHAT_HISTORIES;
  static MAX_MESSAGES_PER_TAB = 200;
  
  /**
   * Get chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<Array>} Chat history messages
   */
  static async getHistory(tabId) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for getHistory');
        return [];
      }
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Return history for this tab or empty array
      return allTabHistories[tabId] || [];
    } catch (error) {
      console.error('TabChatHistory: Error getting chat history:', error);
      return [];
    }
  }
  
  /**
   * Get system prompts for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<Object>} System prompt for the tab
   */
  static async getSystemPrompt(tabId) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for getSystemPrompt');
        return null;
      }
      
      // Get all tab system prompts
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_SYSTEM_PROMPTS]);
      const allTabSystemPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] || {};
      
      // Return system prompts for this tab or null
      return allTabSystemPrompts[tabId] || null;
    } catch (error) {
      console.error('TabChatHistory: Error getting system prompt:', error);
      return null;
    }
  }
  
  /**
   * Save chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @param {Array} messages - Chat history messages
   * @param {Object} modelConfig - Model configuration (optional, for token tracking)
   * @returns {Promise<boolean>} Success status
   */
  static async saveHistory(tabId, messages, modelConfig = null) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for saveHistory');
        return false;
      }
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Limit number of messages to prevent storage problems
      const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_TAB);
      
      // Update history for this tab
      allTabHistories[tabId] = limitedMessages;
      
      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });
      
      // Calculate and save token statistics using TokenManagementService
      await TokenManagementService.calculateAndUpdateStatistics(tabId, limitedMessages, modelConfig);
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error saving chat history:', error);
      return false;
    }
  }
  
  /**
   * Clear chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<boolean>} Success status
   */
  static async clearHistory(tabId) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for clearHistory');
        return false;
      }
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Remove history for this tab
      delete allTabHistories[tabId];
      
      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });
      
      // Clear token statistics
      await TokenManagementService.clearTokenStatistics(tabId);
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error clearing chat history:', error);
      return false;
    }
  }
  
  /**
   * Clean up histories for closed tabs
   * @param {Array<number>} activeTabIds - List of currently active tab IDs
   * @returns {Promise<boolean>} Success status
   */
  static async cleanupClosedTabs(activeTabIds) {
    try {
      if (!activeTabIds || !Array.isArray(activeTabIds)) {
        console.error('TabChatHistory: Invalid activeTabIds for cleanup');
        return false;
      }
      
      // Create a Set for faster lookups
      const activeTabsSet = new Set(activeTabIds.map(id => id.toString()));
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Check if any cleanup is needed
      let needsCleanup = false;
      const tabIds = Object.keys(allTabHistories);
      
      for (const tabId of tabIds) {
        if (!activeTabsSet.has(tabId)) {
          delete allTabHistories[tabId];
          needsCleanup = true;
          
          // Also clear token statistics for this tab
          await TokenManagementService.clearTokenStatistics(tabId);
        }
      }
      
      // Only update storage if something was removed
      if (needsCleanup) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });
        console.log('TabChatHistory: Cleaned up histories for closed tabs');
      }
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error cleaning up closed tabs:', error);
      return false;
    }
  }
  
  /**
   * Get token statistics for a specific tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async calculateTokenStatistics(tabId) {
    return TokenManagementService.getTokenStatistics(tabId);
  }
  
  /**
   * Calculate context window status for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status
   */
  static async calculateContextStatus(tabId, modelConfig) {
    const stats = await TokenManagementService.getTokenStatistics(tabId);
    return TokenManagementService.calculateContextStatus(stats, modelConfig);
  }
  
  /**
   * Update token statistics for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @param {Array} messages - Chat messages
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(tabId, messages, modelConfig = null) {
    return TokenManagementService.calculateAndUpdateStatistics(tabId, messages, modelConfig);
  }
  
  /**
   * Clear token statistics for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    return TokenManagementService.clearTokenStatistics(tabId);
  }
}

export default ChatHistoryService;

```

# src/sidebar/services/TokenManagementService.js

```js
// src/sidebar/services/TokenManagementService.js

import { encode } from 'gpt-tokenizer';
import { STORAGE_KEYS } from "../../shared/constants";
import ChatHistoryService from "./ChatHistoryService";

/**
 * Service for token estimation, cost calculation, storage, and context window monitoring
 * Central authority for all token-related operations
 */
class TokenManagementService {

  /**
   * Get token statistics for a specific tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async getTokenStatistics(tabId) {
    if (!tabId) {
      return this._getEmptyStats();
    }

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};
      const tabStats = allTokenStats[tabId] || {};

      // Return merged stats, ensuring all default fields are present
      return { ...this._getEmptyStats(), ...tabStats };
    } catch (error) {
      console.error('TokenManagementService: Error getting token statistics:', error);
      return this._getEmptyStats();
    }
  }

  /**
   * Update token statistics for a specific tab
   * @param {number} tabId - Tab identifier
   * @param {Object} stats - Token statistics to store
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(tabId, stats) {
    if (!tabId) return false;

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Update stats for this tab
      allTokenStats[tabId] = {
        ...stats,
        lastUpdated: Date.now()
      };

      // Save all token statistics
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats });
      return true;
    } catch (error) {
      console.error('TokenManagementService: Error updating token statistics:', error);
      return false;
    }
  }

  /**
   * Calculate token statistics from chat history
   * @param {Array} messages - Chat messages
   * @param {string} systemPrompt - System prompt text (optional)
   * @returns {Object} - Token statistics focused on the last API call. (Made synchronous again)
   */
  static calculateTokenStatisticsFromMessages(messages, systemPrompt = '') { // Removed async

    let outputTokens = 0;
    let promptTokensInLastApiCall = 0;

    let historyTokensSentInLastApiCall = 0;
    let systemTokensInLastApiCall = 0;

    // Find indices of the last user and assistant messages
    let lastUserMsgIndex = -1;
    let lastAssistantMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && lastUserMsgIndex === -1) {
        lastUserMsgIndex = i;
      }
      if (messages[i].role === 'assistant' && lastAssistantMsgIndex === -1) {
        lastAssistantMsgIndex = i;
      }
      // Optimization: Stop if both are found
      if (lastUserMsgIndex !== -1 && lastAssistantMsgIndex !== -1) {
        break;
      }
    }

    // Process system prompt if present
    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      // Removed await as estimateTokens is now sync
      const systemPromptTokensCount = this.estimateTokens(systemPrompt);

      // Assign tokens *only* from the initial system prompt provided.
      systemTokensInLastApiCall = systemPromptTokensCount;
      // DO NOT add systemPromptTokensCount to historyTokensSentInLastApiCall here
    }

    // Process each message - needs await inside, so can't use forEach directly with async/await
    // Use a standard for...of loop or Promise.all if parallelization is desired (not needed here)
    for (const [index, msg] of messages.entries()) {
      if (msg.role === 'user') {
        // Removed await as estimateTokens is now sync
        const msgInputTokens = msg.inputTokens || this.estimateTokens(msg.content);

        // Determine if this is the most recent user prompt
        const isLastUserPrompt = index === lastUserMsgIndex;

        if (isLastUserPrompt) {
          // Assign tokens only for the message identified as the last user prompt.
          promptTokensInLastApiCall = msgInputTokens;

        } else {

          // Also add to history sent in last call if it's a USER message and not excluded
          if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
            // Add tokens from past user messages to history sent in the last call.
            historyTokensSentInLastApiCall += msgInputTokens;
          }
        }
      } else if (msg.role === 'assistant') {
        // Removed await as estimateTokens is now sync
        const msgOutputTokens = typeof msg.outputTokens === 'number'
            ? msg.outputTokens
            : this.estimateTokens(msg.content);
        // Calculate cumulative output tokens by summing output from all assistant messages.
        outputTokens += msgOutputTokens;

        // Add to history sent in last call if it's an ASSISTANT message and not excluded
        if (index !== lastUserMsgIndex && index !== lastAssistantMsgIndex) {
          // Add tokens from past assistant messages to history sent in the last call.
          historyTokensSentInLastApiCall += msgOutputTokens;
        }
        // System messages (like errors) are not counted towards API call tokens.
        // Note: The initial system prompt is handled separately above.
      }
    } // End of for loop replacing forEach

    // Calculate total input tokens for the last API call by summing system, history sent, and last prompt tokens.
    const inputTokensInLastApiCall = (systemTokensInLastApiCall || 0) + (historyTokensSentInLastApiCall || 0) + (promptTokensInLastApiCall || 0);

    // Calculate output tokens for the last assistant message
    let outputTokensInLastApiCall = 0;
    if (lastAssistantMsgIndex !== -1) {
      const lastAssistantMsg = messages[lastAssistantMsgIndex];
      // Removed await as estimateTokens is now sync
      outputTokensInLastApiCall = lastAssistantMsg.outputTokens || this.estimateTokens(lastAssistantMsg.content);
    }

    return {
      outputTokens,
      promptTokensInLastApiCall,
      historyTokensSentInLastApiCall,
      systemTokensInLastApiCall,
      inputTokensInLastApiCall,
      outputTokensInLastApiCall,
    };
  }

  /**
   * Clear token statistics for a tab
   * @param {number} tabId - Tab identifier
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    if (!tabId) return false;

    try {
      // Get all tab token statistics
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_TOKEN_STATISTICS]);
      const allTokenStats = result[STORAGE_KEYS.TAB_TOKEN_STATISTICS] || {};

      // Remove stats for this tab
      delete allTokenStats[tabId];

      // Save updated stats
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TOKEN_STATISTICS]: allTokenStats });
      return true;
    } catch (error) {
      console.error('TokenManagementService: Error clearing token statistics:', error);
      return false;
    }
  }

  /**
   * Calculate token statistics for a specific chat history
   * @param {number} tabId - Tab identifier
   * @param {Array} messages - Chat messages
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Token statistics
   */
  static async calculateAndUpdateStatistics(tabId, messages, modelConfig = null) {
    if (!tabId) return this._getEmptyStats();

    try {
      // 1. Get existing accumulated cost BEFORE calculating new stats
      const currentStats = await this.getTokenStatistics(tabId);
      const existingAccumulatedCost = currentStats.accumulatedCost || 0;

      // 2. Get the actual system prompt string
      const systemPrompt = await ChatHistoryService.getSystemPrompt(tabId);

      // 3. Calculate base token statistics from messages (includes input/output tokens for last call)
      // Removed await as calculateTokenStatisticsFromMessages is now sync
      const baseStats = this.calculateTokenStatisticsFromMessages(messages, systemPrompt);

      // 4. Calculate Cost of the Last Call
      let currentCallCost = 0;
      if (modelConfig) {
        // Use the specific input/output tokens for the *last call*
        const costInfo = this.calculateCost(
          baseStats.inputTokensInLastApiCall,
          baseStats.outputTokensInLastApiCall,
          modelConfig
        );
        currentCallCost = costInfo.totalCost || 0;
      }

      // 5. Calculate New Accumulated Cost
      const newAccumulatedCost = existingAccumulatedCost + currentCallCost;

      // 6. Prepare Final Stats Object to Save (Explicitly matching _getEmptyStats structure)
      const finalStatsObject = {
        // Cumulative stats (take latest calculated/updated values)
        outputTokens: baseStats.outputTokens || 0,
        accumulatedCost: newAccumulatedCost,

        // Last API call stats (from base calculation)
        promptTokensInLastApiCall: baseStats.promptTokensInLastApiCall || 0,
        historyTokensSentInLastApiCall: baseStats.historyTokensSentInLastApiCall || 0,
        systemTokensInLastApiCall: baseStats.systemTokensInLastApiCall || 0,
        inputTokensInLastApiCall: baseStats.inputTokensInLastApiCall || 0,
        outputTokensInLastApiCall: baseStats.outputTokensInLastApiCall || 0,
        lastApiCallCost: currentCallCost,
        isCalculated: true
      };

      // 7. Save the complete, updated statistics
      await this.updateTokenStatistics(tabId, finalStatsObject);

      // 8. Return the final statistics object
      return finalStatsObject;
    } catch (error) {
      console.error('TokenManagementService: Error calculating token statistics:', error);
      return this._getEmptyStats();
    }
  }

  /**
   * Estimate tokens for a string using the gpt-tokenizer library.
   * @param {string} text - Input text
   * @returns {number} - Estimated token count (synchronous)
   */
  static estimateTokens(text) { // Made synchronous again
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return 0;
    }

    try {
      // Directly use the imported encode function
      const tokens = encode(text);
      return tokens.length;
    } catch (error) {
      console.error("TokenManagementService: Error encoding text with gpt-tokenizer:", error);
      // Fallback on encoding error
      console.warn("TokenManagementService: gpt-tokenizer encoding failed, falling back to char count.");
      return Math.ceil(text.length / 4); // Keep fallback or return 0
    }
  }

  /**
   * Calculate pricing for token usage
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {Object} modelConfig - Model configuration with pricing
   * @returns {Object} - Pricing information
   */
  static calculateCost(inputTokens, outputTokens, modelConfig) {
    if (!modelConfig) return { totalCost: 0 };

    const inputPrice = modelConfig.inputTokenPrice || 0;
    const outputPrice = modelConfig.outputTokenPrice || 0;

    // Convert from price per million tokens
    const inputCost = (inputTokens / 1000000) * inputPrice;
    const outputCost = (outputTokens / 1000000) * outputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      inputTokenPrice: inputPrice,
      outputTokenPrice: outputPrice
    };
  }

  /**
   * Extract pricing information from model configuration
   * @param {Object} modelConfig - Model configuration
   * @returns {Object|null} - Pricing information object or null
   */
  static getPricingInfo(modelConfig) {
    if (!modelConfig) return null;

    return {
      inputTokenPrice: modelConfig.inputTokenPrice,
      outputTokenPrice: modelConfig.outputTokenPrice
    };
  }

  /**
   * Calculate context window usage status
   * @param {Object} tokenStats - Token usage statistics
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Object} - Context window status
   */
  static calculateContextStatus(tokenStats, modelConfig) {
    if (!tokenStats || !modelConfig || !modelConfig.contextWindow) {
      return {
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }

    // Context window usage should be based on the total input tokens sent in the *last* API call,
    // as this represents the context the *next* call will potentially build upon.
    // Use inputTokensInLastApiCall which already includes system, history sent, and the last prompt.
    const totalTokensInContext = tokenStats.inputTokensInLastApiCall || 0;
    const contextWindow = modelConfig.contextWindow;
    const tokensRemaining = Math.max(0, contextWindow - totalTokensInContext);
    const percentage = contextWindow > 0 ? (totalTokensInContext / contextWindow) * 100 : 0;
    const exceeds = totalTokensInContext > contextWindow;

    // Determine warning level
    let warningLevel = 'none';
    if (percentage > 90) {
      warningLevel = 'critical';
    } else if (percentage > 75) {
      warningLevel = 'warning';
    } else if (percentage > 50) {
      warningLevel = 'notice';
    }

    return {
      warningLevel,
      percentage,
      tokensRemaining,
      exceeds,
      totalTokens: totalTokensInContext // Return the context usage total
    };
  }

  /**
   * Create empty token statistics object
   * @private
   * @returns {Object} - Empty token statistics, focusing on last call details.
   */
  static _getEmptyStats() {
    return {
      // Cumulative stats
      outputTokens: 0,
      accumulatedCost: 0,

      // Last API call stats
      promptTokensInLastApiCall: 0,
      historyTokensSentInLastApiCall: 0,
      systemTokensInLastApiCall: 0,
      inputTokensInLastApiCall: 0,
      outputTokensInLastApiCall: 0,
      lastApiCallCost: 0,
      isCalculated: false
    };
  }
}

export default TokenManagementService;

```

# src/sidebar/SidebarApp.jsx

```jsx
// src/sidebar/SidebarApp.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useSidebarPlatform } from '../contexts/platform';
import { useSidebarChat } from './contexts/SidebarChatContext';
import { useContent } from '../contexts/ContentContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput'; 
import { AppHeader } from '../components'; 

export default function SidebarApp() {
  const { tabId, setTabId } = useSidebarPlatform();
  const { resetCurrentTabData, clearFormattedContentForTab } = useSidebarChat();
  const { updateContentContext } = useContent();
  const [isReady, setIsReady] = useState(false); // Tracks if tabId initialization is complete
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const portRef = useRef(null);

  // --- Effect to determine Tab ID ---
  useEffect(() => {
    console.info('SidebarApp mounted, attempting to determine tab context...');
    let foundTabId = NaN; // Use a local variable first

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabIdFromUrl = urlParams.get('tabId');
      const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;

      if (tabIdFromUrl && !isNaN(parsedTabId)) {
        console.info(`Found valid tabId ${parsedTabId} in URL.`);
        foundTabId = parsedTabId;
      } else {
        console.error('FATAL: Sidebar loaded without a valid tabId in URL. Cannot initialize.');
        // Keep foundTabId as NaN
      }
    } catch (error) {
      console.error('Error parsing tabId from URL:', error);
      // Keep foundTabId as NaN
    }

    // Set the tabId in context *if* it's valid
    if (!isNaN(foundTabId)) {
      setTabId(foundTabId);
    }

    // Mark as ready (or not) based on whether a valid ID was found
    // Use a small timeout to allow initial rendering before potentially heavy context updates
    const timer = setTimeout(() => {
        setIsReady(!isNaN(foundTabId));
        console.info(`Sidebar initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`);
    }, 50); // Small delay 50ms

    return () => clearTimeout(timer); // Cleanup timeout on unmount/re-run

  }, [setTabId]); // Dependency ensures it runs once when setTabId is available

  // --- Effect for Page Navigation Listener ---
  useEffect(() => {
    // Only run if we have a valid tabId and are ready
    if (!isReady || !tabId) {
      console.info(`Skipping pageNavigated listener setup (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    const messageListener = (message, sender, sendResponse) => {
      // Ensure the message is for *this* sidebar instance's tab
      if (message.action === 'pageNavigated' && message.tabId === tabId) {
        console.info(`Received pageNavigated event for current tab ${tabId}:`, message);
        try {
          // Update the content context with the new URL and type
          updateContentContext(message.newUrl, message.newContentType);
          console.info(`Content context updated for tab ${tabId} to URL: ${message.newUrl}, Type: ${message.newContentType}`);
        } catch (error) {
          console.error(`Error handling pageNavigated event for tab ${tabId}:`, error);
        }
      }
    };

    // Ensure chrome APIs are available before adding listener
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      console.info(`Added runtime message listener for pageNavigated events (tabId: ${tabId})`);
    } else {
      console.warn("Chrome runtime API not available for message listener.");
    }

    // Cleanup function
    return () => {
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.info(`Removed runtime message listener for pageNavigated events (tabId: ${tabId})`);
      }
    };
    // Dependencies: run when tabId is confirmed, or context functions change
  }, [isReady, tabId, updateContentContext, resetCurrentTabData]); // Added isReady, resetCurrentTabData

  // --- Effect for Background Connection Port ---
  useEffect(() => {
    // Only run if we have a valid tabId and are ready
    if (!isReady || !tabId) {
      console.info(`Skipping background port connection (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    // Prevent reconnecting if already connected
    if (portRef.current) {
        console.log(`[SidebarApp] Port already exists for tab ${tabId}. Skipping reconnection.`);
        return;
    }

    // Ensure chrome APIs are available
    if (!(chrome && chrome.runtime && chrome.runtime.connect)) {
        console.warn("[SidebarApp] Chrome runtime connect API not available.");
        return;
    }

    const portName = `sidepanel-connect-${tabId}`;
    console.log(`[SidebarApp] Attempting to connect to background with name: ${portName}`);
    try {
      portRef.current = chrome.runtime.connect({ name: portName });
      console.log(`[SidebarApp] Connection established for tab ${tabId}`, portRef.current);

      portRef.current.onDisconnect.addListener(() => {
        console.log(`[SidebarApp] Port disconnected for tab ${tabId}.`);
        if (chrome.runtime.lastError) {
          console.error(`[SidebarApp] Disconnect error for tab ${tabId}:`, chrome.runtime.lastError.message);
        }
        portRef.current = null; // Clear the ref on disconnect
      });

    } catch (error) {
      console.error(`[SidebarApp] Error connecting to background for tab ${tabId}:`, error);
      portRef.current = null; // Ensure ref is null on error
    }

    // Cleanup function: Disconnect the port when the component unmounts or tabId/isReady changes
    return () => {
      if (portRef.current) {
        console.log(`[SidebarApp] Disconnecting port for tab ${tabId} due to cleanup.`);
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [isReady, tabId]); // Re-run effect if isReady or tabId changes

  // --- Render Logic ---
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary">
      {!isReady ? (
        // ----- Loading State -----
        // Show spinner while isReady is false (during initial tabId determination)
        <div className="flex h-full w-full items-center justify-center" aria-live="polite" aria-busy="true">
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status">
             <span className="sr-only">Loading sidebar...</span> {/* Accessibility */}
          </div>
        </div>
      ) : tabId ? (
        // ----- Ready State -----
        // Show main content only when isReady is true AND tabId is valid
        <>
          <AppHeader
            showRefreshButton={true}
            onRefreshClick={resetCurrentTabData}
            isExpanded={headerExpanded}
            onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
            showExpandToggle={true}
            showBorder={true}
            className='px-5 py-2 flex-shrink-0' // Prevent header from shrinking
          />

          {/* Collapsible header section */}
          <div className="relative flex-shrink-0 z-10">
            <div
              className={`transition-all duration-300 ease-in-out border-b border-theme ${
                headerExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 invisible' // Keep invisible when collapsed
              }`}
              // Add aria-hidden based on expansion state for accessibility
              aria-hidden={!headerExpanded}
            >
              {/* Conditionally render Header to prevent potential issues when hidden */}
              {headerExpanded && <Header />}
            </div>
          </div>

          {/* Make ChatArea flexible and ensure it's behind the header dropdowns */}
          <ChatArea className="flex-1 min-h-0 relative z-0" /> {/* Ensure ChatArea can grow/shrink*/}

          {/* User input at the bottom */}
          <UserInput className="flex-shrink-0 relative z-10 border-t border-theme" /> {/* Ensure input is above chat area visually */}
        </>
      ) : (
        // ----- Error State -----
        // Show error if ready check finished (isReady=true) but tabId is still invalid (e.g., NaN)
         <div className="flex flex-col h-full w-full items-center justify-center p-4">
           <div className="text-center text-error">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <p className="font-semibold">Initialization Error</p>
             <p className="text-sm">Sidebar context could not be determined.</p>
             <p className="text-xs mt-2">(Missing or invalid tabId)</p>
           </div>
         </div>
      )}
    </div>
  );
}
```

# src/styles/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Import Inter font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

/* Base styles */
@layer base {
  body {
    font-family: 'Inter', sans-serif;
    @apply bg-theme-primary text-theme-primary;
    margin: 0;
    padding: 0;
  }
}

/* Component abstractions */
@layer components {
  .btn {
    @apply inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm transition-colors;
  }

  .btn-primary {
    @apply bg-primary text-white hover:bg-primary-hover;
  }

  .btn-secondary {
    @apply bg-theme-surface text-theme-primary border border-theme hover:border-primary;
  }

  .btn-danger {
    @apply bg-error text-white hover:bg-red-600;
  }

  .btn:disabled {
    @apply bg-gray-500 text-gray-300 cursor-not-allowed hover:bg-gray-500;
  }

  /* Toggle switch component */
  .toggle-switch {
    @apply relative inline-block w-9 h-5;
  }

  .toggle-switch input {
    @apply opacity-0 w-0 h-0;
  }

  .slider {
    @apply absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-theme-hover rounded-full transition-all;
  }

  .slider:before {
    @apply absolute content-[''] h-4 w-4 left-0.5 bottom-0.5 bg-white rounded-full transition-all;
  }

  input:checked + .slider {
    @apply bg-primary;
  }

  input:checked + .slider:before {
    @apply transform translate-x-4;
  }

  /* Status indicators */
  .notification,
  .toast {
    @apply fixed p-4 bg-theme-surface text-theme-primary rounded-lg shadow-theme-medium transform -translate-y-full opacity-0 transition-all duration-300 z-50 border-l-4 border-primary;
  }

  .notification.show,
  .toast.show {
    @apply translate-y-0 opacity-100;
  }

  .notification.error,
  .toast.error {
    @apply border-l-error;
  }

  .notification.warning,
  .toast.warning {
    @apply border-l-warning;
  }

  .notification.success,
  .toast.success {
    @apply border-l-success;
  }

  .status-message {
    @apply text-sm text-theme-secondary p-2 rounded-md bg-opacity-5 min-h-[18px] transition-all;
  }

  .error-message {
    @apply text-error text-sm p-2 text-center;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    @apply w-2 h-2;
  }

  ::-webkit-scrollbar-track {
    @apply bg-theme-primary rounded;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-gray-300 dark:bg-theme-hover rounded; /* Base style */
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-400 dark:bg-gray-500; /* Subtle hover effect */
  }
}

/* Utility classes */
@layer utilities {
  .focus-primary {
    @apply focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary focus:outline-none;
  }

  /* Apply general focus styles, but allow overrides */
  input:focus, select:focus, textarea:focus {
    @apply ring-2 ring-primary ring-opacity-50 border-primary outline-none;
  }

  /* For link styling */
  .link {
    @apply text-primary hover:text-primary-hover hover:underline transition-colors;
  }
}

/* Custom Slider Styles */
.custom-slider {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  height: 8px; /* Specified height */
  background: transparent; /* Background set on the track */
  cursor: pointer;
  border-radius: 9999px; /* Fully rounded */
}

/* Webkit Track */
.custom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  cursor: pointer;
  background: theme('colors.gray.300');
  border-radius: 9999px;
}
.dark .custom-slider::-webkit-slider-runnable-track {
  background: theme('colors.gray.700');
}

/* Webkit Thumb */
.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -4px; /* Center thumb vertically (half of thumb height - half of track height) */
  height: 16px;
  width: 16px;
  background: theme('colors.primary.DEFAULT');
  border-radius: 50%;
  cursor: pointer;
  transition: background .2s ease-in-out;
}
.custom-slider:hover::-webkit-slider-thumb {
   background: theme('colors.primary.hover');
}
.custom-slider:active::-webkit-slider-thumb {
   background: theme('colors.primary.hover');
}

/* Disabled State (Webkit Only) */
.custom-slider:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.custom-slider:disabled::-webkit-slider-thumb {
  background: theme('colors.gray.400');
  cursor: not-allowed;
}
.dark .custom-slider:disabled::-webkit-slider-thumb {
  background: theme('colors.gray.500');
}
.custom-slider:disabled::-webkit-slider-runnable-track {
  background: theme('colors.gray.200');
  cursor: not-allowed;
}
.dark .custom-slider:disabled::-webkit-slider-runnable-track {
  background: theme('colors.gray.800');
}

/* Hide spin buttons on ALL number inputs */
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

```

# tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./popup.html",
    "./settings.html",
    "./sidepanel.html", // Added sidepanel.html just in case
    "./*.html"
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: { // Applies to the base 'prose' class
          css: {
            // Target inline code elements specifically
            'code': {
              // Reset potential default styles if needed, though usually handled by prose
            },
            // Explicitly remove content from pseudo-elements for inline code
            'code::before': {
              content: 'none', // Remove backtick before
            },
            'code::after': {
              content: 'none', // Remove backtick after
            },
            // Ensure block code (pre code) is not affected if it had different defaults
            'pre code::before': null, // Use null to potentially revert to any other defaults if needed
            'pre code::after': null,
          },
        },
      }),

      colors: {
        // Brand colors (consistent across themes)
        primary: {
          DEFAULT: '#FF7B00',
          hover: '#E06E00',
          secondary: '#FF9D45',
        },
        error: '#FF4545',
        success: '#4CAF50',
        warning: '#FFC107',
      },
      animation: {
        'bounce': 'bounce 1s infinite',
      },
      keyframes: {
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    // Original theme-aware utility classes
    function({ addUtilities }) {
      // Define theme-aware utility classes
      const themeUtilities = {
        // Light theme (default)
        '.bg-theme-primary': { backgroundColor: '#F8F8F8' },
        '.bg-theme-surface': { backgroundColor: '#FFFFFF' },
        '.bg-theme-hover': { backgroundColor: '#F2F2F2' },
        '.bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.05)' },

        '.text-theme-primary': { color: '#333333' },
        '.text-theme-secondary': { color: '#666666' },

        '.border-theme': { borderColor: '#E0E0E0' },
        '.divide-theme': { divideColor: '#E0E0E0' },

        '.shadow-theme-light': { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
        '.shadow-theme-medium': { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' },

        '.dark .bg-theme-primary': { backgroundColor: '#1E1E1E' },
        '.dark .bg-theme-surface': { backgroundColor: '#2D2D2D' },
        '.dark .bg-theme-hover': { backgroundColor: '#353535' },
        '.dark .bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.1)' },

        '.dark .text-theme-primary': { color: '#FFFFFF' },
        '.dark .text-theme-secondary': { color: '#B0B0B0' },

        '.dark .border-theme': { borderColor: '#3D3D3D' },
        '.dark .divide-theme': { divideColor: '#3D3D3D' },

        '.dark .shadow-theme-light': { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' },
        '.dark .shadow-theme-medium': { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' },
      };

      addUtilities(themeUtilities);
    },

    // New custom group variants for code block hover states
    function({ addVariant, e }) {
      // Add custom group variants for code blocks and message containers
      addVariant('code-block-group-hover', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.code-block-group:hover .${e(`code-block-group-hover${separator}${className}`)}`
        })
      });

      addVariant('message-group-hover', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.message-group:hover .${e(`message-group-hover${separator}${className}`)}`
        })
      });
    }
  ],
}
```

# webpack.config.js

```js
const path = require('path');
const isProduction = process.env.NODE_ENV === 'production';
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/index.js',
    popup: './src/popup/index.jsx',
    settings: './src/settings/index.jsx',
    sidebar: './src/sidebar/index.jsx',
    'content-script': './src/content/index.js',
    'platform-content': './src/content/platform-content.js',
    'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'source-map', // Disable source maps for production

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: "135"
                },
                useBuiltIns: "usage",
                corejs: 3
              }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    modules: [
      'node_modules',
      path.resolve(__dirname, 'src')
    ],
    fallback: {
      "path": false,
      "fs": false
    }
  },
  optimization: {
    minimize: isProduction,
    minimizer: [
      // Only add Terser config if in production
      ...(isProduction ? [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: false, // This explicitly removes console.* statements
            },
          },
        }),
      ] : []),
    ],
  },
  performance: {
    hints: isProduction ? 'warning' : false
  },
  performance: {
    hints: isProduction ? 'warning' : false // Show hints only in production
  }
};

```

