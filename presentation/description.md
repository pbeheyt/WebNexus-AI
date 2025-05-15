# WebNexus AI: Summarize & Interact with Web Content, PDFs & YouTube Videos using AI | Web UI or Side Panel

WebNexus AI connects you to Gemini, ChatGPT, Claude, DeepSeek, Grok, and Mistral, allowing you to analyze and interact with web pages, PDFs, YouTube videos, and Reddit posts. Choose your preferred interaction method:

1.  **Web UI Mode (Send to AI Websites):**
    *   Sends selected content and your prompt directly to the AI platform's *website*.
    *   Uses your existing website login (no API key needed).
    *   **Access Methods:**
        *   **Popup (`Alt+W`):** Select platform, enter or select prompt, toggle context inclusion, then send.
        *   **Quick Actions (Instant):** Use default prompt & preferred platform (set in Settings).
            *   **Context Menu (`Right-Click`):** Choose "Process in Web UI...".
            *   **Keyboard Shortcut (`Alt+Q`):** Instantly process the page.

2.  **Side Panel (Direct API Interaction):**run away turn away
    *   Chat directly with specific AI models via their API for analysis.
    *   Requires configuring your API keys in `Settings > API Settings`.
    *   Maintains conversation history per tab.
    *   Includes token/cost estimation (see notes below).
    *   Supports system prompts and fine-tuning parameters.
    *   Access via the Popup icon's toggle or Keyboard Shorcut (`Alt+W` > `Alt+S`).


## Core Features

*   **Content Analysis:** Extracts the primary article or main textual content from web pages, aiming to exclude common website boilerplate. Also processes YouTube transcripts, Reddit posts/comments, and PDFs.
*   **Supported Platforms:** Works with Gemini, ChatGPT, Claude, DeepSeek, Grok, and Mistral via both API (Side Panel) and Web UI modes.
*   **Prompt Management:** Create, save, edit, and set default prompts (used by Quick Actions) in `Settings > Prompts`. **Note:** Custom prompts are managed as part of your local data (see 'Local Data & Settings Management' below).
*   **Configuration:** Customize API parameters (temperature, max tokens, system prompts) for models used in the Side Panel, UI themes (Light/Dark), and interface text size.
*   **Secure API Key Handling (Side Panel):** Keys are stored as local data (see 'Local Data & Settings Management' below) and sent directly to AI platforms. *Note: Local storage is vulnerable if your computer is compromised.*
*   **Local Data & Settings Management:** User settings—including custom prompts, API keys, and model parameters—are stored locally (`chrome.storage.local`) for privacy and performance. This data **does not sync automatically** but can be fully exported to a JSON file and imported on other devices via `Settings > Data Management`.
*   **Keyboard Shortcuts:**
    *   **Global Commands:** Shortcuts for opening the Popup (default: `Alt+W`) or quick processing (default: `Alt+Q`) are managed in Chrome's settings (`chrome://extensions/shortcuts`).
    *   **Side Panel Toggle:** A dedicated shortcut (default: `Alt+S`) opens/closes the Side Panel. It's active from the Popup or when the Side Panel itself is focused (to close). Customize this in `Settings > Keyboard Shortcuts`. To use: `Alt+W` then `Alt+S` (or your custom keys).

## Usage Notes

*   **Web Content Extraction :** For general web pages, the extension attempts to identify and extract the main article or primary textual content. This process aims to provide focused content for AI analysis by excluding common website boilerplate such as headers, footers, and navigation elements.
*   **YouTube & Reddit Content:** For YouTube videos and Reddit posts, scroll the page to load all desired comments *before* initiating processing. Scrolling allows the extension to access all dynamically loaded comment data present on the page at the time of extraction.
*   **Web UI Automation:** Relies on current AI website structures. Significant site changes (infrequent) might temporarily affect auto-filling; functionality is maintained via updates.
*   **Token Estimation (Side Panel):** The token count shown is an **estimate for guidance purposes only**, calculated using OpenAI's TikToken for consistency. Actual token counts billed by platforms like Claude, Gemini, Mistral etc., may differ (often 10-30% higher) due to their unique tokenizers. Please refer to the official platform dashboard for accurate billing information.

## Getting Started

1.  Install & pin the extension.
2.  **(Optional - For Side Panel):** Add API keys in `Settings > API Settings`.
3.  **(Optional - For Quick Actions):** Set your preferred platform & default prompts in `Settings > Prompts`.
4.  Interact via Side Panel (`Alt+W` > `Alt+S`), Popup (`Alt+W`), Context Menu, or Quick Shortcut (`Alt+Q`).