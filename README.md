# AI Content Summarizer

A Chrome extension that extracts and summarizes web content, Reddit posts, and YouTube videos using Claude AI.

## Overview

AI Content Summarizer is a browser extension that bridges web content with Claude's AI capabilities, allowing you to quickly summarize any webpage, Reddit post, or YouTube video. The extension handles the extraction of relevant content, automatically feeds it to Claude AI with appropriate prompts, and lets Claude generate structured summaries.

## Features

### Content Extraction
- **General Web Pages**: 
  - Extracts visible text while filtering out navigation elements, ads, and non-essential content
  - Preserves document structure and formatting
  - Supports user text selection for more targeted analysis

- **Reddit Posts**: 
  - Extracts post title, content, author information
  - Captures top comments with author names and upvote counts
  - Configurable comment extraction limit (default: 200)
  - Works with both old and new Reddit layouts

- **YouTube Videos**: 
  - Extracts complete video transcript using youtube-transcript library
  - Includes video title, channel info, and description
  - Captures top comments with like counts
  - Configurable comment extraction limit (default: 50)

### Claude AI Integration
The extension seamlessly interfaces with Claude AI by:
1. Extracting content from the current page
2. Opening a new Claude AI session
3. Automatically inputting the appropriate prompt template
4. Adding the extracted content formatted specifically for each content type
5. Submitting the prompt to generate a summary

### Customizable Prompts
- **Default Prompt Templates**:
  - Web Content Summary: Structured analysis of general web content
  - Reddit Post Analysis: Detailed breakdown of posts and comment discussions
  - YouTube Video Summary: Concise summary of video content with key points

- **Custom Prompt Management**:
  - Create and save custom prompts for each content type
  - Set preferred prompts as defaults
  - Edit and delete custom prompts through the settings interface

### User Interface
- **Browser Toolbar Popup**:
  - Simple interface showing detected content type
  - Dropdown for selecting prompt templates
  - One-click summarization button

- **Context Menu Integration**:
  - Right-click menu option for summarizing entire pages
  - Selection-specific summarization for targeted content

- **Settings Page**:
  - Prompt management interface 
  - Content-specific extraction settings
  - Comment limits for Reddit and YouTube

## Installation

### From Source
1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the extension directory

## Usage

### Method 1: Extension Icon
1. Navigate to any web page, Reddit post, or YouTube video
2. Click the AI Content Summarizer icon in your browser toolbar
3. Select your desired prompt template from the dropdown
4. Click "Summarize with Claude"

### Method 2: Context Menu
1. Right-click anywhere on a web page, Reddit post, or YouTube video
2. Select "Summarize with Claude" from the context menu

### Method 3: Text Selection
1. Select specific text on any page
2. Right-click on the selection
3. Choose "Summarize Selection with Claude"

## Advanced Configuration

### Custom Prompt Creation
1. Click the ⚙️ icon in the extension popup or open the extension's options page
2. Select the content type tab (Web Content, Reddit Posts, or YouTube Videos)
3. Use the "Add New Prompt" form to create your custom prompt
4. Fill in a name and prompt content
5. Click "Save Prompt"
6. Set as preferred (optional) to make it the default for that content type

### Comment Extraction Settings
1. Open the extension's options page
2. Select the Reddit or YouTube tab
3. Adjust the "Maximum Comments to Extract" setting
4. Changes are saved automatically

## Technical Architecture

The extension is built using JavaScript and Chrome Extension Manifest V3, with the following components:

- **Background Service Worker**: Manages context menus, tab operations, and coordinates content extraction
- **Content Scripts**: Specialized extractors for different content types
- **Popup Interface**: User-friendly control panel
- **Settings Management**: Storage and retrieval of user preferences
- **Claude Integration**: Automated input handling in Claude's interface

## Permissions Explained

The extension requires the following permissions:
- `contextMenus`: For right-click menu integration
- `activeTab`: To access the content of the active tab
- `scripting`: To inject content scripts for extraction
- `storage`: To store extracted content and user preferences
- `tabs`: To manage tab operations when opening Claude

## Data Privacy

- All content extraction happens locally in your browser
- The extension does not store or send your data to any third-party servers
- Content is processed locally and sent directly to Claude AI
- Requires a Claude AI account to use

## Troubleshooting

- **Content Not Extracting**: Some websites with complex layouts may require selecting specific content manually
- **YouTube Transcript Missing**: Some videos don't have transcripts available; in these cases, only metadata and comments will be extracted
- **Claude Integration Issues**: Ensure you're logged into Claude AI before using the extension

## Development

To modify the extension:
1. Edit files in the `src` directory
2. Run `npm run watch` for development with hot reloading
3. Run `npm run build` for production build
4. Refresh the extension in Chrome

### Directory Structure
- `src/`: Source code
  - `background.js`: Background service worker
  - `content/`: Content scripts for different platforms
  - `utils/`: Utility functions
- `dist/`: Compiled JavaScript bundles
- `images/`: Extension icons
- `config.json`: Default prompt templates