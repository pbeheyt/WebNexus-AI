# Permission Justifications

---

### Permission: `activeTab`

WebNexus AI requires access to the `activeTab` to allow users to explicitly invoke the extension (e.g., via the popup or context menu) on the web page they are currently viewing. This enables the core functionality of extracting page content for summarization or interaction with user-selected AI platforms. The extension only accesses the content of the tab when the user actively chooses to use its features on that specific page.

---

### Permission: `scripting`

The `scripting` permission is essential for WebNexus AI to perform its primary functions. It allows the extension, upon user initiation, to:

1.  Inject scripts into the active tab to accurately extract textual content from web articles, PDF documents (when opened in the browser), and YouTube video transcripts. This extracted content is then used for AI processing as directed by the user.
2.  Automate interactions with AI platform websites when the user selects the 'Web UI Mode', such as pre-filling prompts and extracted content.
    This permission is used only when the user actively engages with the extension's features.

---

### Permission: `storage`

WebNexus AI uses the `storage` permission (specifically `chrome.storage.local` and `chrome.storage.sync`) to save user settings and preferences directly on their local computer. This includes:

- API keys for different AI platforms (for Side Panel mode, stored in `local` storage).
- User-created custom prompts (stored in `local` storage).
- User preferences for default AI platforms and models (some in `local`, some global UI preferences in `sync`).
- Side Panel chat history per tab (stored in `local` storage).
  This allows for a personalized experience and ensures user data like API keys remains on their device and is not transmitted to external servers other than the chosen AI platforms.

---

### Permission: `tabs`

The `tabs` permission is necessary for WebNexus AI to provide a seamless user experience:

1.  To open AI platform websites in new tabs when the user initiates an action via the 'Web UI Mode'.
2.  To manage and interact with the extension's Side Panel in relation to specific browser tabs, ensuring context and history are maintained correctly.
3.  To retrieve the URL of the current tab. This is used to determine the type of content (e.g., PDF, YouTube, general web page) for appropriate content extraction and processing, and to check if the Side Panel can be enabled on the current page.

---

### Permission: `contextMenus`

WebNexus AI uses the `contextMenus` permission to add a convenient 'Process in Web UI (Default Prompt)' option to the browser's right-click menu. This allows users to quickly send the content of the current page to their preferred AI platform using their pre-configured default prompt, streamlining their workflow.

---

### Permission: `sidePanel`

This permission is fundamental for enabling the WebNexus AI Side Panel interface. The Side Panel allows users to have direct, in-browser chat conversations with AI models via their APIs, keeping the interaction alongside the web content they are viewing or analyzing. This is a core interaction mode offered by the extension.

---

### Permission: `notifications`

WebNexus AI uses the `notifications` permission to provide essential, non-intrusive feedback to the user for actions initiated from contexts without a visible UI, such as keyboard shortcuts or context menu actions. For example, if a user tries to process content with a shortcut but has not configured a required setting (like a default prompt), the extension will display a system notification to inform the user of the issue and guide them on how to resolve it. This prevents silent failures and improves the overall user experience.

---

### Host Permissions (`host_permissions`)

**(A) If a single field is provided for _all_ `host_permissions` in the CWS Dashboard:**

WebNexus AI requires access to various hosts to fulfill its core purpose as a versatile AI interaction tool, enabling users to analyze, summarize, and interact with web content from diverse sources using multiple AI platforms. All data access and communication are initiated by the user through the extension's interface. Specifically, permissions are needed for:

1.  **Content Extraction from General Web Pages (`<all_urls>`):** To extract textual content from any general web article, blog post, or online document the user is actively browsing and chooses to process with an AI.
2.  **Interaction with Local PDF Files (`file://*.pdf`):** To access and extract text from local PDF files that the user opens in Chrome.
3.  **Specialized Content Extraction:** For `https://*.youtube.com/` (video transcripts) and `https://*.reddit.com/` (post/comment data).
4.  **Enabling "Web UI Mode":** Access to `https://claude.ai/`, `https://chatgpt.com/`, `https://chat.deepseek.com/`, `https://chat.mistral.ai/`, `https://gemini.google.com/` to open these official AI websites and pre-fill content.
5.  **Enabling "Side Panel (API Mode)":** Access to `https://api.anthropic.com/`, `https://api.openai.com/`, `https://api.mistral.ai/`, `https://api.deepseek.com/`, `https://generativelanguage.googleapis.com/`, `https://api.grok.ai/` to send user data directly to these official AI API endpoints using locally-stored API keys.

**(B) If separate justifications are required for specific host permissions:**

- **For `<all_urls>`:**
  WebNexus AI's primary function is to act as a central hub allowing users to analyze, summarize, and interact with content from _any_ web page they are currently viewing, using a variety of AI tools. The `<all_urls>` permission is essential for the 'Content Extraction' feature to work on general web articles, blog posts, and other online documents across the internet, enabling users to send this content to their chosen AI. This permission is only leveraged when the user explicitly invokes the extension on an active tab. The extension does not automatically access or modify content on all sites without direct user interaction and initiation for a specific task.

- **For `file://*.pdf`:**
  This permission enables WebNexus AI to access and extract text from local PDF files that the user opens directly in the Chrome browser. This is necessary for the core functionality of summarizing and interacting with the content of these PDF documents using the user's selected AI platforms. The extension only accesses PDF files when the user navigates to a `file://` URL ending in `.pdf` and actively chooses to use the extension's features on that document.

- **For `https://*.youtube.com/`:**
  Required to extract video transcripts and related metadata from YouTube pages when the user activates WebNexus AI on a YouTube video, enabling AI-powered summarization and interaction with the video's content. It also allows the 'Web UI Mode' to correctly interact with youtube.com if it were to be selected as a target.

- **For `https://*.reddit.com/`:**
  Required to extract post and comment data from Reddit pages when the user activates WebNexus AI on a Reddit discussion, enabling AI-powered analysis of the content. It also allows the 'Web UI Mode' to correctly interact with reddit.com if it were selected as a target.

- **For `https://claude.ai/`:**
  Needed for 'Web UI Mode' to open the official Claude website and pre-fill it with user-selected content and prompts for direct interaction.

- **For `https://chatgpt.com/`:**
  Needed for 'Web UI Mode' to open the official ChatGPT website and pre-fill it with user-selected content and prompts for direct interaction.

- **For `https://chat.deepseek.com/`:**
  Needed for 'Web UI Mode' to open the official DeepSeek Chat website and pre-fill it with user-selected content and prompts for direct interaction.

- **For `https://chat.mistral.ai/`:**
  Needed for 'Web UI Mode' to open the official Mistral Chat website and pre-fill it with user-selected content and prompts for direct interaction.

- **For `https://gemini.google.com/`:**
  Needed for 'Web UI Mode' to open the official Google Gemini website and pre-fill it with user-selected content and prompts for direct interaction.

- **For `https://api.anthropic.com/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official Claude API, using the user's locally-stored API key.

- **For `https://api.openai.com/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official OpenAI API (for ChatGPT models), using the user's locally-stored API key.

- **For `https://api.mistral.ai/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official Mistral API, using the user's locally-stored API key.

- **For `https://api.deepseek.com/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official DeepSeek API, using the user's locally-stored API key.

- **For `https://generativelanguage.googleapis.com/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official Google AI API (for Gemini models), using the user's locally-stored API key.

- **For `https://api.grok.ai/`:**
  Required for the Side Panel's 'API Mode' to securely send user prompts and relevant page content directly to the official Grok API, using the user's locally-stored API key.

---
