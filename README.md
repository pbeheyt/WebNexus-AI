# AI Insightr: Web Content Assistant

AI Insightr enhances your browsing by integrating powerful AI capabilities directly into Chrome. Interact with web pages, YouTube videos, PDFs, and Reddit posts using your favorite AI models. Choose your workflow:

1.  **Side Panel (API Mode):** Chat directly with AI APIs (ChatGPT, Claude, Gemini, etc.) in a sidebar alongside your content. Requires API key configuration.
2.  **Popup/Context Menu (Web UI Mode):** Quickly send content and prompts to the AI platforms' standard web interfaces. Requires website login, not API keys for interaction.

## Key Features

*   **Dual Interaction Modes:**
    *   **Side Panel (Direct API Chat):**
        *   Persistent sidebar for direct API communication.
        *   Requires API keys configured in **Settings > API Settings**.
        *   Select specific AI Platforms and Models.
        *   Maintains separate conversation history per tab.
        *   Provides estimated token usage and API cost tracking (estimates may vary).
        *   Supports system prompts for advanced control.
        *   Toggle inclusion of page content for the first message.
        *   Supports message editing and rerunning for conversation refinement.
    *   **Popup & Context Menu (Web Interface Interaction):**
        *   Uses the AI platform's **website** in a new tab.
        *   Does **not** use API keys for the interaction itself (relies on website login).
        *   **Popup:** Select platform, enter/select prompt, toggle context inclusion.
        *   **Context Menu:** Right-click -> "Process in Web UI..." uses the default prompt for the content type.
        *   Attempts to auto-fill content/prompt on the target website.
*   **Multi-Platform Support:**
    *   **Side Panel (via API):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
    *   **Popup/Context Menu (via Web UI):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
*   **Versatile Content Extraction:** Automatically extracts key information from:
    *   General Web Pages (articles, blogs)
    *   YouTube Videos (transcripts if available)
    *   Reddit Posts (post content, comments)
    *   PDF Documents (text content)
*   **Custom Prompt Management:** Create, edit, delete, and set default prompts per content type in **Settings > Prompts**. Usable in both Sidebar and Popup.
*   **API Configuration (for Side Panel):**
    *   Manage API keys (stored locally). Includes validation check.
    *   Fine-tune API parameters (temperature, max tokens, etc.) per model.
*   **UI Customization:** Light/Dark themes and adjustable text sizes (Small/Base/Large).
*   **Quick Access:**
    *   **Context Menu:** Right-click page for Sidebar toggle or Web UI processing.
    *   **Keyboard Shortcuts:** `Alt+I` (Popup), `Alt+U` (Default Web UI Process). *Configurable in Chrome settings.*

## Supported Platforms

*   **Side Panel (via API):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
    *   *Requires API key configuration in Settings.*
*   **Popup/Context Menu (via Web Interface):** ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral.
    *   *Opens the platform's website. Does not use API keys for interaction.*

## How to Use

1.  **Installation:** Load the extension into Chrome (see below). Pin the icon.
2.  **Configure API Keys (Required for Side Panel):**
    *   Open **Settings** (Right-click extension icon > Options, or via Popup/Sidebar).
    *   Go to **API Settings**. Select each platform and enter its API key. Save & Validate.
    *   *Skip if only using Popup/Context Menu mode.*
3.  **Using the Side Panel (API Chat):**
    *   Toggle sidebar via Popup icon or right-click context menu.
    *   Select an AI Platform and Model (only platforms with valid keys work).
    *   Type your prompt or select one using the 'P' button. Toggle content inclusion if needed.
    *   Chat directly; responses appear in the sidebar.
4.  **Using the Popup (Web UI):**
    *   Click the extension icon.
    *   Select an AI platform.
    *   Enter/select prompt, toggle context via the switch.
    *   Click send (arrow button).
    *   The platform's **website** opens; content/prompt are auto-filled (if possible).
5.  **Using the Context Menu (Web UI):**
    *   Right-click on a page -> "Process in Web UI (Default Prompt)".
    *   Opens preferred platform website with content + default prompt auto-filled (if possible).
6.  **Managing Prompts:** Configure custom prompts in **Settings > Prompts**.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and go to `chrome://extensions/`.
3.  Enable "Developer mode" (top-right).
4.  Click "Load unpacked".
5.  Select the directory containing `manifest.json`.

## Development

1.  Requires Node.js and npm.
2.  Install dependencies: `npm install`
3.  Build for development (with source maps): `npm run build:dev`
4.  Watch for changes and rebuild: `npm run watch`
5.  Build for production (minified, no source maps): `npm run build`
6.  Load/reload the extension in Chrome using the `dist` directory after building.

## Permissions Required

*   **`activeTab` & `scripting`:** To read and interact with the current tab's content (extraction, sidebar injection).
*   **`storage`:** To save settings (sync), API keys (local), prompts (sync), chat history (local), etc.
*   **`tabs`:** To get tab info (URLs), create tabs (for Popup mode), manage side panel per tab.
*   **`webRequest`:** (Verify - likely not needed based on current structure, could be leftover. Consider removing if unused).
*   **`contextMenus`:** To add the right-click menu options.
*   **`sidePanel`:** To manage and display the extension's side panel UI.
*   **`host_permissions`:** Needed for:
    *   Popup Mode: Interacting with AI platform websites (e.g., `chatgpt.com`, `claude.ai`, etc.).
    *   Sidebar Mode: Calling AI platform API endpoints (e.g., `api.openai.com`, `api.anthropic.com`, etc.).
    *   Content Extraction: Accessing content from various websites (`<all_urls>`), YouTube, Reddit, PDFs (`file://*.pdf`).
