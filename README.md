# WebNexus AI: Interact on Web, PDFs, YouTube w/ ChatGPT, Gemini+ | SidePanel or Web UI

WebNexus AI acts as a central hub utilizing diverse AI models directly on encountered web content. It supports interaction methods for both in-depth analysis via direct API chat in the Side Panel, and quick actions sending content to AI websites through the Popup/Context Menu (Web UI Mode). You can interact with web pages, PDFs, YouTube videos, and Reddit Posts, using the selected AI tools.

---

This extension uses various AI models to analyze and interact with online content. It offers two distinct methods:

1.  **Side Panel (API Mode):** A persistent panel alongside web content for direct chat conversations using the selected platform's official API. Requires API key configuration in Settings. Access via the Popup icon's toggle or Keyboard Shorcut (`Alt+W` > `Alt+S`).
2.  **Popup/Context Menu (Web UI Mode):** Quick actions to send extracted content and prompts to the AI platform's website in a new tab. Does _not_ use API keys for the interaction itself but requires you to be logged into the respective platform's website.

## Supported Platforms

WebNexus AI supports interaction with the following AI platforms:

- Gemini (Google)
- ChatGPT (OpenAI)
- Claude (Anthropic)
- DeepSeek
- Grok (xAI)
- Mistral

Both API access (Side Panel) and Web UI interaction (Popup/Context Menu) are supported for these platforms.

---

## Core Functionality

- **Analyze Diverse Content:** Extracts key information from standard web pages, YouTube video transcripts, Reddit posts & comments, and PDF documents.
- **Local Data & Settings Management:** User settings—including custom prompts, API keys, and model parameters—are stored locally (`chrome.storage.local`) for privacy and performance. This data **does not sync automatically** but can be fully exported to a JSON file and imported on other devices via `Settings > Data Management`.
- **Side Panel (API Mode):**
  - Direct chat with AI models via API.
  - Requires API key configuration in **Settings > API Settings**.
  - Selection of specific AI platforms and models.
  - Maintains separate conversation history per browser tab.
  - Provides estimated token usage and API cost tracking (based on OpenAI tokenizer, may differ from official billing).
  - Supports system prompts (where applicable by the model).
  - Toggle to include/exclude page content on the first message.
- **Popup & Context Menu (Web UI Mode):**
  - Send content and prompts to the AI platform's _website_.
  - **Popup:** Platform selection, prompt entry/selection, context inclusion toggle.
  - **Context Menu:** Right-click page -> "Process in Web UI (Default Prompt)" sends content with the default prompt for that content type to the preferred platform.
  - Does _not_ require API keys for interaction (relies on website login).
  - Attempts to auto-fill the platform's website input.
- **Prompt Management:** Create, save, edit, delete, and set default prompts for different content types via **Settings > Prompts**. Prompts are accessible in both Side Panel and Popup. **Note:** Custom prompts are managed as part of your local data (see 'Local Data & Settings Management' above).
- **Secure API Key Handling (Side Panel):** Keys are stored as local data (see 'Local Data & Settings Management' above) and sent directly to AI platforms. _Note: Local storage is vulnerable if your computer is compromised._
- **Configuration:** Customize API parameters (temperature, max tokens, system prompts) for models used in the Side Panel, UI themes (Light/Dark), and interface text size. These configurations, including model parameters, are managed locally (see 'Local Data & Settings Management').
- **UI Customization:** Light/Dark themes and adjustable text sizes (Small, Base, Large) available in headers.
- **Keyboard Shortcuts:**
  - **Global Commands:** Shortcuts for opening the Popup (default: `Alt+W`) or quick processing (default: `Alt+Q`) are managed in Chrome's settings (`chrome://extensions/shortcuts`).
  - **Side Panel Toggle:** A dedicated shortcut (default: `Alt+S`) opens/closes the Side Panel. It's active from the Popup or when the Side Panel itself is focused (to close). Customize this in `Settings > Keyboard Shortcuts`. To use: `Alt+W` then `Alt+S` (or your custom key).

---

## Usage Overview

1.  **Install** and pin the extension.
2.  **(For Side Panel):** Open **Settings > API Settings**. Enter and save API keys for the platforms intended for Side Panel use.
3.  **Choose Interaction Method:**
    - **Popup (Web UI):** Click extension icon, select platform, write/select prompt, toggle context, click send. Opens platform website.
    - **Context Menu (Web UI):** Right-click page, select "Process in Web UI". Opens platform website with default prompt.
    - **Side Panel (API):** Toggle via Popup icon or context menu (`Alt+W` > `Alt+S`). Select platform/model (API key required), chat directly.

## Usage Notes

- **Web Content Extraction:** For general web pages, the extension attempts to identify and extract the main article or primary textual content. This process aims to provide focused content for AI analysis by excluding common website boilerplate such as headers, footers, and navigation elements.
- **Content Extraction Notes:** Extraction performs well on standard website layouts. However, on highly complex or non-standard sites, some page context might not be fully captured. **Pro Tip for Dynamic Content:** To ensure comprehensive extraction of comment sections (e.g., YouTube, Reddit), scroll down the page to fully load all desired comments _before_ activating WebNexus AI on the content.
- **Web UI Automation (Popup/Context Menu):** Auto-filling functionality depends on the AI platform's website structure and may require updates if the site changes. Extension updates will aim to address this.
- **Token Estimation (Side Panel):** Estimates are based on OpenAI tokenizer and may differ from official provider billing. Use provider dashboards for accurate cost/usage.

## Getting Started

1.  Install & pin the extension.
2.  **(Optional - For Side Panel):** Add API keys in `Settings > API Settings`.
3.  **(Optional - For Quick Actions):** Set your preferred platform & default prompts in `Settings > Prompts`.
4.  Interact via Side Panel (`Alt+W` > `Alt+S`), Popup (`Alt+W`), Context Menu, or Quick Shortcut (`Alt+Q`).
