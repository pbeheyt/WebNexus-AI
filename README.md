# AI Content Assistant

AI Content Assistant enhances your browsing by integrating powerful AI capabilities directly into Chrome. Choose how you interact: use the **Sidebar** for direct API-driven chat about page content, or use the **Popup** to quickly send content to an AI platform's standard web interface.

## Key Features

*   **Two Ways to Interact:**
    *   **Sidebar (Direct API Chat):** Open a persistent sidebar on any tab. Chat directly with AI models (like ChatGPT, Claude, Gemini, etc.) about the page's content. Responses are generated via the AI's official API and displayed *within the sidebar*. **Requires configuring API keys in Settings.**
    *   **Popup (Web Interface Interaction):** Use the quick-action popup to select an AI platform. The extension extracts page content, opens the chosen platform's **website** in a new tab, and attempts to paste the content and your prompt into *that website's* chat interface. **Does not use API keys for the interaction itself.**
*   **Multi-Platform Support:**
    *   **Sidebar (API):** Integrates with APIs from Claude, ChatGPT, DeepSeek, Mistral, Gemini, and Grok.
    *   **Popup (Web UI):** Supports sending content to the web interfaces of the same platforms.
*   **Versatile Content Extraction:** Automatically extracts key information for AI processing from:
    *   General Web Pages (main text, metadata)
    *   YouTube Videos (transcripts, comments, metadata)
    *   Reddit Posts (post content, comments, metadata)
    *   PDF Documents (text content, metadata)
*   **Interactive Sidebar Features (API Mode):**
    *   Select specific AI platforms and models for API interactions.
    *   Maintains separate conversation histories for each browser tab.
    *   Provides estimated token usage and accumulated API cost tracking per tab.
    *   Supports system prompts for advanced API control.
*   **Custom Prompt Management:** Create, edit, and manage custom prompts for different content types or shared use across both Popup and Sidebar modes via the Settings page.
*   **API Configuration (for Sidebar Mode):**
    *   Manage API keys obtained from AI providers, stored in the browser's local storage. Includes validation checks.
    *   Fine-tune API request parameters (temperature, max tokens, etc.) for sidebar interactions.
*   **Theme Support:** Adapts to your system's Light or Dark mode.
*   **Quick Access:** Use keyboard shortcuts or the right-click context menu to activate the popup or toggle the sidebar.

## Supported Platforms

*   **Sidebar (via API):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
    *   *Requires API key configuration in Settings for functionality.*
*   **Popup (via Web Interface):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
    *   *Opens the platform's website. API keys are not used for this interaction.*

## How to Use

1.  **Installation:** Load the extension into Chrome (see Installation section below).
2.  **Configure API Keys (Strongly Recommended for Sidebar):**
    *   To use the **Sidebar chat feature**, you **must** configure API keys. Open the extension's **Settings** page (Right-click extension icon > Options, or via Popup).
    *   Go to the **API Settings** tab. Select each AI platform you want to use *in the sidebar* and enter its API key. Save and validate the key (✓ indicates success).
    *   You can skip this step if you only plan to use the Popup mode.
3.  **Using the Sidebar (Direct API Chat):**
    *   Toggle the sidebar using `Ctrl+Shift+Q` (or your shortcut) or the right-click context menu.
    *   Select an AI Platform and Model from the dropdowns. **Only platforms with configured API keys will work here.**
    *   Type your prompt about the current page content. The AI response appears directly **within the sidebar**, using the configured API key.
    *   Token usage and cost estimates are tracked for these API calls.
4.  **Using the Popup (Web Interface Interaction):**
    *   Click the extension icon in your browser toolbar.
    *   Select an AI platform.
    *   Enter your prompt.
    *   Click the send button.
    *   The extension opens the chosen AI platform's **website** in a new tab and attempts to paste the page content and your prompt into **that website's input field.** No API keys are used for this process.
5.  **Managing Prompts:** Configure custom prompts in **Settings > Prompts** for use in either the Sidebar or Popup.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and go to `chrome://extensions/`.
3.  Enable "Developer mode" (top-right).
4.  Click "Load unpacked".
5.  Select the directory containing `manifest.json`.

## Development

1.  Requires Node.js and npm.
2.  Install dependencies: `npm install`
3.  Build: `npm run build`
4.  Watch for changes: `npm run watch`
5.  Load/reload the extension in Chrome as described above.

## Permissions Required

*   **`activeTab` & `scripting`:** To read and interact with the current tab's content.
*   **`storage`:** To save settings, API keys (in local storage), prompts, chat history, etc.
*   **`tabs`:** To get tab info (URLs), create tabs (for Popup mode), and manage the sidebar.
*   **`webRequest`:** (Verify specific usage in `manifest.json`).
*   **`contextMenus`:** To add the "Open Sidebar" right-click option.
*   **`host_permissions`:** Needed for:
    *   Popup Mode: Interacting with AI platform websites (e.g., `chatgpt.com`).
    *   Sidebar Mode: Calling AI platform API endpoints (e.g., `api.openai.com`).
    *   Both Modes: Extracting content from various websites (`<all_urls>`).
