# AI Content Summarizer

A Chrome extension that extracts and summarizes web content, Reddit posts, and YouTube videos using multiple AI platforms (Claude, ChatGPT, and DeepSeek).

## Key Features

- Multi-platform support for Claude, ChatGPT, and DeepSeek
- Smart content extraction from general web pages
- Specialized extractors for Reddit posts and YouTube videos
- Default and custom prompt templates for different content types
- Configurable extraction settings (comment limits, etc.)
- One-click summarization with context menu integration
- Dark/light theme support

## How It Works

1. The extension extracts relevant content from the current page
2. The content is sent to your chosen AI platform with a prompt template
3. The AI generates a summary based on the content
4. You receive a comprehensive summary suited to the content type

## Usage Guide

### Basic Usage

1. Navigate to any webpage, Reddit post, or YouTube video
2. Click the extension icon in your Chrome toolbar
3. Select your preferred AI platform (Claude, ChatGPT, or DeepSeek)
4. Choose between default or custom prompts
5. Customize prompt parameters if using default prompts
6. Click "Summarize Content"

### Context Menu

Right-click on any webpage or selected text and choose "Summarize with AI" for quick access using your default settings.

### Customization Options

- **Default Prompts**: Customize length, style, language, and additional options
- **Custom Prompts**: Create and manage your own prompt templates in settings
- **Content Settings**: Configure extraction parameters like comment limits

## Architecture Overview

The extension is built on Chrome's Extension Manifest V3 architecture with a modular design:

- **Core Framework**: Chrome Extension API (Manifest V3)
- **Build System**: Webpack + Babel
- **Storage**: Chrome Storage API
- **External Libraries**: youtube-transcript for transcript extraction

## Key Components

### Content Extractors

- **General Web Pages**: Extracts main content and metadata
- **Reddit Posts**: Extracts post content, metadata, and configurable number of comments
- **YouTube Videos**: Extracts video transcript, metadata, and configurable number of comments

### AI Platform Integration

The extension integrates with three AI platforms:
- **Claude**: Anthropic's Claude AI assistant
- **ChatGPT**: OpenAI's ChatGPT interface
- **DeepSeek**: DeepSeek AI's interface

### User Interface

- **Popup Interface**: Content type detection, AI platform selection, prompt customization
- **Settings Interface**: Custom prompt management, extraction configuration
- **Theme Support**: Light and dark mode

## Installation from Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the extension directory

## Development

### Build Commands
```
npm install        # Install dependencies
npm run build      # Production build
npm run watch      # Development build with hot reload
```

### Directory Structure
```
/
├── dist/                  # Compiled JavaScript bundles
├── images/                # Extension icons and logos
├── src/
│   ├── background.js      # Background service worker
│   ├── popup/             # Popup UI components
│   ├── settings/          # Settings UI components
│   ├── content/           # Content scripts
│   ├── extractor/         # Content extraction strategies
│   ├── platforms/         # AI platform implementations
│   └── utils/             # Utility functions
├── config.json            # Default configurations
├── manifest.json          # Extension manifest
├── popup.html             # Popup UI template
└── settings.html          # Settings page template
```

## Privacy & Security

- All content extraction occurs locally within your browser
- No data is transmitted to third-party servers (except to the AI platform)
- The extension requires an account with your selected AI platform
- No sensitive user data is stored outside the browser's local storage

## Troubleshooting

- **Content Not Extracting**: Complex websites may require selecting specific content manually
- **YouTube Transcript Missing**: For videos without transcripts, only metadata and comments will be extracted
- **AI Platform Integration Issues**: Ensure you're logged into the AI platform before use
- **Platform Interface Changes**: If AI platforms update their interfaces, temporary compatibility issues may occur