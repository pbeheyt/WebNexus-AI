# AI Content Summarizer: The All-in-One AI Assistant for Your Browser

This Chrome extension provides a comprehensive suite of AI-powered tools to enhance your browsing experience. Summarize web content, analyze discussions, and streamline information gathering across various online platforms.

## Features

*   **Multi-Platform Support:** Works seamlessly with a wide range of content types, including:
    *   General web content
    *   Reddit posts and discussions
    *   YouTube videos (including transcript and comment analysis)
    *   PDF documents
    *   Selected text fragments
*   **AI Platform Flexibility:** Choose from a variety of AI platforms to power your summaries and analyses:
    *   ChatGPT
    *   Claude
    *   DeepSeek
    *   Mistral
    *   Gemini
    *   Grok
*   **Summarization and Analysis:** Quickly generate concise or detailed summaries of web content, extract key themes from discussions, and analyze comment sections.
*   **Customizable Prompts:** Tailor the AI's behavior with customizable prompts. Adjust the length, style, and language of summaries to fit your needs.
*   **Contextual Sidebar Integration:** Access AI features directly within a convenient sidebar for in-depth analysis and conversation.
*   **Keyboard Shortcuts:** Enhance productivity with keyboard shortcuts for common actions.
*   **Theme Management:** Easily switch between light and dark themes for comfortable reading in any environment.
*   **Secure Credential Storage:** API keys for AI platforms are stored securely using Chrome's storage API.
*   **Tab-Specific Preferences:** Customize AI platform and model selections for individual tabs.
*   **Token Tracking and Cost Accounting:** Monitor API token usage with detailed breakdowns and cost estimations (where available).
*   **Content Extraction and Analysis:** Uses smart extraction algorithms for optimal results.
*   **Clear User Interface:** A straightforward and easy-to-navigate interface ensures a smooth user experience.
*   **Continuous Updates:** Regularly updated to support new platforms, models, and features.

## Installation

1.  Download the extension package from [link to be added].
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the directory containing the extension files.
5.  The extension icon will appear in your Chrome toolbar.

## Usage

### Summarizing Content

1.  **Click the Extension Icon:** Activate the extension by clicking its icon in the Chrome toolbar.
2.  **Select an AI Platform:** Choose your preferred AI platform (e.g., ChatGPT, Claude, Gemini) from the dropdown menu.
3.  **Configure Prompt Settings:** Customize the summary's length, style, and language using the available options.
4.  **Process Content:** Click the "Process Content" button.
5.  **View Summary:** The summarized content will be displayed in the popup window.

You can also trigger content processing by right-clicking on a webpage and selecting “Process with AI" or “Process selection with AI” in the context menu.  If selection mode is enabled under the keyboard shortcut options, content processing can also be triggered using the keyboard shortcut: `Ctrl+Shift+Z`

### Using the Sidebar

1.  **Toggle Sidebar:**  Press `Ctrl+Shift+Q` to open or close the sidebar, or select “Toggle Sidebar” from the context menu.
2.  **Chat Interface:** Engage in a conversation with the AI about the current page content.
3.  **Model Selection:** Choose your preferred AI model for the sidebar chat.
4.  **Token Tracking:** View real-time token usage and cost estimates in the sidebar.

### Customizing Prompts

1.  **Open Settings:** Click the extension icon and then the "Settings" button.
2.  **Manage Prompts:**  Navigate to the "Custom Prompt Management" tab.
3.  **Create, Edit, or Delete Prompts:** Add new custom prompts, modify existing ones, or remove unwanted prompts.
4.  **Customize Default Templates:** Modify base template instructions under "Template Customization."
    *  Adjust length, style, and language parameters to refine summary output.
    *  Click the gear icon to create a new prompt with content-specific settings.

### Managing API Credentials

1.  **Open Settings:** Click the extension icon and then the "Settings" button.
2.  **Navigate to API Settings:**  Select the "API Settings" tab.
3.  **Enter API Keys:** Provide your API keys for the AI platforms you want to use.

## Configuration

The extension can be configured via the settings page (accessible via the extension popup):

*   **Content Extraction Settings:**
    *   Maximum number of comments to extract from Reddit and YouTube.

*   **Keyboard Shortcuts:**
    *   "Process Content":  Customize content processing with and without text selection.
    *   "Toggle Sidebar":  Configure sidebar opening behavior.

*   **API Settings:**
    *   Set default parameters like length, style, language, and API keys for each platform.

## Security and Privacy

*   The extension requests necessary permissions to access web content and inject scripts.
*   Your API keys are stored locally and securely using Chrome's storage API.
*   No user data is collected or transmitted by the extension.
*   Review the extension's code on GitHub to verify its security and privacy practices [link to be added].

## Support and Contributing

For bug reports, feature requests, and contributions, please visit the extension's GitHub repository [link to be added].