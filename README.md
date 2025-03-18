# AI Content Summarizer

A Chrome extension that extracts and summarizes web content, Reddit posts, YouTube videos, PDFs, and selected text using multiple AI platforms (Claude, ChatGPT, DeepSeek, and Mistral).

## Key Features

- **Multi-platform AI support**: Claude, ChatGPT, DeepSeek, and Mistral AI
- **Smart content extraction** for various content types:
  - General web pages and articles
  - Reddit posts with comments
  - YouTube videos with transcript and comments
  - PDF documents with text extraction (NEW!)
  - Selected text from any webpage (NEW!)
- **Flexible prompt system**:
  - Template prompts with customizable parameters
  - Custom prompts for specific content types
  - Quick prompts for one-time use (NEW!)
  - Template customization for advanced users (NEW!)
- **One-click summarization** with context menu integration
- **Dark/light theme support** that adapts to your browser preferences
- **User-friendly interface** with status notifications and error handling

## How It Works

1. The extension extracts relevant content from the current page or selection
2. The content is formatted based on its type (web, Reddit, YouTube, PDF, or selection)
3. Your chosen AI platform (Claude, ChatGPT, DeepSeek, or Mistral) receives the content with your prompt
4. The AI generates a summary tailored to the content type and your preferences

## Usage Guide

### Basic Usage

1. Navigate to any webpage, Reddit post, YouTube video, or PDF document
2. Click the extension icon in your Chrome toolbar
3. Select your preferred AI platform 
4. Choose between template, custom, or quick prompt types
5. Customize prompt parameters if needed
6. Click "Summarize Content"

### Selected Text Summarization

1. Select any text on a webpage
2. Click the extension icon or use the context menu
3. The extension automatically detects your selection
4. Configure your prompt preferences
5. Click "Summarize Content"

### Context Menu Integration

Right-click on any webpage and choose:
- "Summarize with AI" to summarize the whole page
- "Summarize Selection with AI" when text is selected

### Prompt Types

- **Template**: Pre-configured prompts with customizable parameters (length, style, language, etc.)
- **Custom**: Your own saved prompts that you can create and manage in settings
- **Quick**: One-time prompts that don't need to be saved (NEW!)

## Customization Options

### Template Prompt Parameters

- **Length**: Concise, Normal, Detailed, or Exhaustive
- **Style**: Adaptive, Narrative, Bullet Points, Analytical, Executive, Simplified, Technical, or Academic
- **Language**: English, French, Spanish, or German
- **Content-specific options**:
  - YouTube: Comment analysis
  - PDF: Table of contents, visuals analysis
  - Reddit: Fact checking
  - Selected Text: Context awareness

### Settings Page

- **Custom Prompt Management**: Create, edit, and delete custom prompts
- **Content Configuration**: Set extraction parameters for different content types
- **Template Customization**: Advanced editing of template parameters and values (NEW!)

## Architecture Overview

The extension is built on Chrome's Extension Manifest V3 architecture with a modular design:

- **Core Framework**: Chrome Extension API (Manifest V3)
- **Build System**: Webpack + Babel
- **Storage**: Chrome Storage API
- **External Libraries**: 
  - youtube-transcript for transcript extraction
  - pdfjs-dist for PDF document parsing (NEW!)

## Key Components

### Content Extractors

- **General Web Pages**: Extracts main content and metadata
- **Reddit Posts**: Extracts post content, metadata, and comments
- **YouTube Videos**: Extracts transcript, metadata, and comments
- **PDF Documents**: Extracts text content and metadata from PDF files (NEW!)
- **Selected Text**: Extracts user-selected text with contextual information (NEW!)

### AI Platform Integration

The extension integrates with six AI platforms:
- **Claude**: Anthropic's Claude AI assistant
- **ChatGPT**: OpenAI's ChatGPT interface
- **DeepSeek**: DeepSeek AI's interface
- **Mistral**: Mistral AI's chat interface
- **Gemini**: Gamini AI's chat interface
- **Grok**: Grok AI's chat interface

### User Interface

- **Popup Interface**: Content type detection, AI platform selection, prompt customization
- **Settings Interface**: Custom prompt management, extraction configuration, template customization
- **Theme Support**: Light and dark mode with system preference detection

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
├── css/                   # Stylesheets for UI components
├── src/
│   ├── background.js      # Background service worker
│   ├── popup/             # Popup UI components
│   ├── settings/          # Settings UI components
│   ├── content/           # Content scripts
│   ├── extractor/         # Content extraction strategies
│   ├── platforms/         # AI platform implementations
│   ├── services/          # Shared services (config, templates)
│   ├── shared/            # Shared constants and utilities
│   └── utils/             # Utility functions
├── prompt-config.json     # Default prompt configurations
├── platform-config.json   # AI platform configurations
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
- **PDF Text Extraction Issues**: Some PDFs may have limited text extraction if they contain primarily images or are scanned documents
- **AI Platform Integration Issues**: Ensure you're logged into the AI platform before use
- **Comment Loading for YouTube**: You may need to scroll down to load comments before summarizing if comment analysis is enabled
