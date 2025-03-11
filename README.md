# AI Content Summarizer

A Chrome extension that extracts and summarizes web content, Reddit posts, and YouTube videos using multiple AI platforms (Claude, ChatGPT, and DeepSeek).

## Architecture Overview

AI Content Summarizer is built on Chrome's Extension Manifest V3 architecture, implementing a modular design pattern with clear separation of concerns between content extraction, AI platform integration, and user interface components. The system operates through a coordinated pipeline of background services, content scripts, and frontend interfaces.

### Technical Stack

- **Core Framework**: Chrome Extension API (Manifest V3)
- **Build System**: Webpack + Babel for module bundling and transpilation
- **Storage**: Chrome Storage API (sync and local) for persistence
- **External Libraries**:
  - `youtube-transcript` for reliable transcript extraction
  - Core JavaScript libraries for DOM manipulation and data processing

## System Components

### 1. Content Extraction Engine

The extension implements specialized content extractors for three distinct content domains:

#### General Web Pages
- **Extraction Strategy**: DOM traversal with intelligent filtering algorithms to isolate main content
- **Implementation**: `src/content/general.js`
- **Key Features**:
  - Semantic content analysis to differentiate main content from navigation, ads, and auxiliary elements
  - Support for user-selected text prioritization
  - Metadata extraction (title, URL, description, author)
  - Configurable extraction depth

#### Reddit Posts
- **Extraction Strategy**: Post content and comment tree traversal
- **Implementation**: `src/content/reddit.js`
- **Key Features**:
  - Post metadata capture (title, author, subreddit)
  - Hierarchical comment extraction with scoring data
  - Comment permalink preservation
  - Layout-agnostic selectors for compatibility with old and new Reddit interfaces
  - Configurable comment depth limits (default: 200 comments)

#### YouTube Videos
- **Extraction Strategy**: Transcript API integration with metadata and comment capture
- **Implementation**: `src/content/youtube.js`
- **Key Features**:
  - Complete transcript extraction via `youtube-transcript` library
  - Video metadata capture (title, channel, description)
  - Comment extraction with like counts
  - Graceful fallback for videos without transcripts
  - Configurable comment limits (default: 50 comments)

### 2. AI Platform Integration

The extension provides seamless integration with three AI platforms:

- **Claude**: `src/content/claude.js`
- **ChatGPT**: `src/content/chatgpt.js`
- **DeepSeek**: `src/content/deepseek.js`

#### Integration Architecture
- **Connection Method**: Content script injection into AI platform interfaces
- **Data Flow**: 
  1. Content extraction from source page
  2. Storage in Chrome local storage
  3. Opening AI platform in new tab
  4. Injection of content script to interface with AI platform
  5. Retrieval of extracted content and prompt from storage
  6. Automatic input and submission to AI interface

#### Platform-Specific Adaptations
Each integration module implements platform-specific DOM interaction strategies to accommodate differences in editor interfaces, button selectors, and event handling requirements across AI platforms.

### 3. Background Service Worker

- **Implementation**: `src/background.js`
- **Responsibilities**:
  - Context menu management
  - Tab orchestration
  - Content script injection coordination
  - Message routing between extension components
  - Configuration management
  - AI platform session initialization

### 4. User Interface Components

#### Popup Interface
- **Implementation**: `popup.html` + `src/popup.js`
- **Features**:
  - Content type detection and display
  - AI platform selection
  - Prompt template selection
  - One-click summarization

#### Settings Interface
- **Implementation**: `settings.html` + `src/settings.js`
- **Features**:
  - Custom prompt creation and management
  - Preferred prompt selection for each content type
  - Content extraction parameter configuration
  - Responsive tab-based interface

### 5. Prompt Management System

- **Storage Structure**:
  - Organization by content type (general, reddit, youtube)
  - Default and custom prompts
  - Preferred prompt designation
  - Content-type specific settings

- **Default Prompts**:
  - Web Content Summary: Structured analysis template
  - Reddit Post Analysis: Post and comment discussion analysis
  - YouTube Video Summary: Key points extraction with timestamp references

## Data Flow Architecture

1. **Extraction Phase**:
   - Content script receives extraction request
   - DOM is analyzed and content extracted
   - Data is normalized into content-type specific format
   - Extracted content stored in local storage

2. **AI Integration Phase**:
   - AI platform opened in new tab
   - Platform-specific content script injected
   - Script waits for platform interface to load
   - Extracted content and prompt template retrieved from storage
   - Content formatted according to prompt structure
   - Formatted content inserted into AI interface and submitted

## Extension Permissions

| Permission | Purpose |
|------------|---------|
| `contextMenus` | Enables right-click menu integration |
| `activeTab` | Allows content script injection and DOM access |
| `scripting` | Required for programmatic script injection |
| `storage` | Persistence for extracted content and preferences |
| `tabs` | Manages tab operations for AI platform integration |

## Host Permissions

The extension requires access to specific domains for functionality:
- `https://*.youtube.com/*`: For YouTube content extraction
- `https://*.reddit.com/*`: For Reddit content extraction
- `https://claude.ai/*`: For Claude AI integration
- `https://chatgpt.com/*`: For ChatGPT integration
- `https://chat.deepseek.com/*`: For DeepSeek AI integration

## Advanced Usage

### Custom Prompt Creation
The extension supports creating tailored prompts for each content type:

1. Access the settings interface via the gear icon or extension options
2. Select the appropriate content type tab
3. Use the "Add New Prompt" form to create a custom prompt
4. Save and optionally set as preferred for that content type

### Content Extraction Configuration
Fine-tune the extraction behavior:

- **Reddit**: Configure maximum comment extraction depth
- **YouTube**: Set comment extraction limits

## Developer Documentation

### Build Process
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
│   ├── popup.js           # Popup UI controller
│   ├── settings.js        # Settings page controller
│   ├── content/           # Content scripts
│   │   ├── general.js     # Web page extractor
│   │   ├── reddit.js      # Reddit post extractor
│   │   ├── youtube.js     # YouTube video extractor
│   │   ├── claude.js      # Claude AI integration
│   │   ├── chatgpt.js     # ChatGPT integration
│   │   └── deepseek.js    # DeepSeek integration
│   └── utils/
│       └── logger.js      # Logging utility
├── config.json            # Default configurations
├── manifest.json          # Extension manifest
├── popup.html             # Popup UI template
└── settings.html          # Settings page template
```

### Extension Installation

#### From Source
1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the extension directory

## Security and Privacy Considerations

- All content extraction occurs locally within the browser
- No data is transmitted to third-party servers (except when explicitly sent to the AI platform)
- The extension requires an account with the selected AI platform
- No sensitive user data is stored outside the browser's local storage

## Troubleshooting

- **Content Not Extracting**: Some websites with complex layouts may require selecting specific content manually
- **YouTube Transcript Missing**: Some videos don't have transcripts available; in these cases, only metadata and comments will be extracted
- **AI Platform Integration Issues**: Ensure you're logged into the AI platform before using the extension
- **Platform Interface Changes**: If AI platforms update their interfaces, temporary compatibility issues may occur until the extension is updated

## Future Development Roadmap

- Additional AI platform integrations
- Enhanced content extraction algorithms
- Support for more content types (scholarly articles, documentation, etc.)
- Batch processing capabilities
- Export/import functionality for prompts
- Advanced prompt templating system

---

This extension serves as a powerful bridge between web content and advanced AI platforms, streamlining the process of content extraction and summarization for improved productivity and information processing.