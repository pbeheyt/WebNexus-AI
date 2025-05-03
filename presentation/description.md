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

2.  **Side Panel (Direct API Interaction):**
    *   Chat directly with specific AI models via their API for analysis.
    *   Requires configuring your API keys in `Settings > API Settings`.
    *   Maintains conversation history per tab.
    *   Includes token/cost estimation (see notes below).
    *   Supports system prompts and fine-tuning parameters.
    *   Access via the Popup icon's toggle.


## Core Features

*   **Content Analysis:** Extracts information from web pages (main article/text content), YouTube transcripts, Reddit posts/comments, and PDFs.
*   **Supported Platforms:** Works with Gemini, ChatGPT, Claude, DeepSeek, Grok, and Mistral via both API (Side Panel) and Web UI modes.
*   **Prompt Management:** Create, save, edit, and set default prompts (used by Quick Actions) in `Settings > Prompts`.
*   **Secure API Key Handling (Side Panel):** Keys stored locally (`chrome.storage.local`) on your computer, never sent to WebNexus AI developers. Sent directly to the AI platform's API endpoint only. *Note: Local storage is vulnerable if your computer is compromised.*
*   **Configuration:** Adjust API parameters (e.g., temperature, max tokens, system prompts) per model, UI themes (Light/Dark), text size, and keyboard shortcuts (`chrome://extensions/shortcuts`).

## Usage Notes

*   **Website Content Extraction:** Extracts the main text content from web pages. Works best on standard article/blog layouts. Complex or highly dynamic sites might result in incomplete extraction. **Tip:** For comments (YouTube, Reddit), scroll to load all desired content *before* processing the content.
*   **Web UI Automation:** Relies on current AI website structures. Significant site changes (infrequent) might temporarily affect auto-filling; functionality is maintained via updates.
*   **Token Estimation (Side Panel):** The token count shown is an **estimate for guidance purposes only**, calculated using OpenAI's TikToken for consistency. Actual token counts billed by platforms like Claude, Gemini, Mistral etc., may differ (often 10-30% higher) due to their unique tokenizers. Please refer to the official platform dashboard for accurate billing information.

## Getting Started

1.  Install & pin the extension.
2.  **(Optional - For Side Panel):** Add API keys in `Settings > API Settings`.
3.  **(Optional - For Quick Actions):** Set your preferred platform & default prompts in `Settings > Prompts`.
4.  Interact via Side Panel, Popup (`Alt+W`), Context Menu, or Quick Shortcut (`Alt+Q`).