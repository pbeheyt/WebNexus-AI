# WebNexus AI: Summarize & Interact with Web Content, PDFs & YouTube Videos using AI | Side Panel or Web UI

WebNexus AI acts as a central hub utilizing diverse AI models directly on encountered web content. It supports interaction methods for both in-depth analysis via direct API chat in the Side Panel, and quick actions sending content to AI websites through the Popup/Context Menu (Web UI Mode). You can interact with web pages, PDFs, YouTube videos, and Reddit Posts, using the selected AI Platform.

---

This extension uses latest AI models to analyze and interact with online content. It offers two distinct methods:

1.  **Side Panel (API Mode):** A persistent panel alongside web content for direct chat conversations using the selected platform's official API. Requires API key configuration in Settings.
2.  **Popup/Context Menu (Web UI Mode):** Quick actions to send extracted content and prompts to the AI platform's website in a new tab. Does *not* use API keys for the interaction itself but requires you to be logged into the respective platform's website.

## Supported Platforms

WebNexus AI supports interaction with the following AI platforms:

*   Gemini (Google)
*   ChatGPT (OpenAI)
*   Claude (Anthropic)
*   DeepSeek
*   Grok (xAI)
*   Mistral

Both API access (Side Panel) and Web UI interaction (Popup/Context Menu) are supported for these platforms.

---

## Core Functionality

*   **Analyze Diverse Content:** Extracts key information from standard web pages, YouTube video transcripts, Reddit posts & comments, and PDF documents.
*   **Side Panel (API Mode):**
    *   Direct chat with AI models via API.
    *   Requires API key configuration in **Settings > API Settings**.
    *   Selection of specific AI platforms and models.
    *   Maintains separate conversation history per browser tab.
    *   Provides estimated token usage and API cost tracking (based on OpenAI tokenizer, may differ from official billing).
    *   Supports system prompts (where applicable by the model).
    *   Toggle to include/exclude page content on the first message.
*   **Popup & Context Menu (Web UI Mode):**
    *   Send content and prompts to the AI platform's *website*.
    *   **Popup:** Platform selection, prompt entry/selection, context inclusion toggle.
    *   **Context Menu:** Right-click page -> "Process in Web UI (Default Prompt)" sends content with the default prompt for that content type to the preferred platform.
    *   Does *not* require API keys for interaction (relies on website login).
    *   Attempts to auto-fill the platform's website input.
*   **Prompt Management:** Create, save, edit, delete, and set default prompts for different content types via **Settings > Prompts**. Prompts are accessible in both Side Panel and Popup.
*   **API Configuration & Security (for Side Panel):**
    *   **API Key Storage:** Your API keys are stored securely using the browser's local storage (`chrome.storage.local`) directly on your computer. **They are never transmitted to WebNexus AI's developers or any third-party servers.** Keys are only sent directly from your browser to the respective AI platform's official API endpoint when you use the Side Panel.
    *   **Local Security:** While stored locally, please be aware that API keys could potentially be accessed if your computer itself is compromised by malware or unauthorized access.
    *   **Parameter Tuning:** Fine-tuning parameters (e.g., temperature, max tokens, system prompts) can be adjusted per model (**Settings > API Settings**) and are also stored locally in your browser's sync storage (`chrome.storage.sync`) for convenience across your devices.
*   **UI Customization:** Light/Dark themes and adjustable text sizes (Small, Base, Large) available in headers.
*   **Keyboard Shortcuts:**
    *   `Alt+W` : Open WebNexus AI Popup.
    *   `Alt+Q` : Quick page content process with default prompt via Web UI (like Context Menu).
    *   To customize these shortcuts, visit `chrome://extensions/shortcuts` in your Chrome browser or go to Chrome Settings → Extensions → Keyboard Shortcuts. Look for WebNexus AI in the list to modify its assigned keys.

---

## Usage Overview

1.  **Install** and pin the extension.
2.  **(For Side Panel):** Open **Settings > API Settings**. Enter and save API keys for the platforms intended for Side Panel use. Review the API key storage details above.
3.  **Choose Interaction Method:**
    *   **Popup (Web UI):** Click extension icon, select platform, write/select prompt, toggle context, click send. Opens platform website.
    *   **Context Menu (Web UI):** Right-click page, select "Process in Web UI". Opens platform website with default prompt.
    *   **Side Panel (API):** Toggle via Popup icon or context menu. Select platform/model (API key required), chat directly.

## Usage Notes

*   **Content Extraction Notes:** Extraction performs well on standard website layouts. However, on highly complex or non-standard sites, some page context might not be fully captured. **Pro Tip for Dynamic Content:** To ensure comprehensive extraction of comment sections (e.g., YouTube, Reddit), scroll down the page to fully load all desired comments *before* activating WebNexus AI on the content.
*   **Web UI Automation (Popup/Context Menu):** Auto-filling functionality depends on the AI platform's website structure and may require updates if the site changes. Extension updates will aim to address this.
*   **Token Estimation (Side Panel):** Estimates are based on OpenAI tokenizer and may differ from official provider billing. Use provider dashboards for accurate cost/usage.