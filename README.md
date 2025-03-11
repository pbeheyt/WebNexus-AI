# AI Content Summarizer

A Chrome extension that automatically extracts and summarizes web content, Reddit posts, and YouTube videos using Claude AI.

## Overview

AI Content Summarizer seamlessly bridges web content with Claude's AI capabilities, allowing you to quickly summarize any webpage, Reddit post, or YouTube video without manually copying and pasting content.

The extension:
1. Extracts relevant content from the current page
2. Opens a new Claude AI session
3. Automatically inputs the content with an appropriate prompt
4. Lets Claude generate a concise, structured summary

## Features

- **Multiple Content Support**:
  - General web pages: Extracts main text content
  - Reddit posts: Extracts post content and top comments
  - YouTube videos: Extracts video transcript, description, and top comments

- **Optimized Prompts**: Different prompt templates for each content type:
  - Web Content Summary: General content summarization
  - Reddit Post Analysis: Detailed analysis of posts and discussions
  - YouTube Video Summary: Concise summary of video content

- **Easy Access**:
  - Browser toolbar icon with popup interface
  - Context menu integration (right-click)
  - Selection-specific summarization

## How It Works

### Content Extraction

- **Web Pages**: Extracts visible text while filtering out navigation elements, ads, and other non-essential content
- **Reddit**: Captures the post title, content, author information, and most relevant comments
- **YouTube**: Uses transcript API to extract the video transcript, channel information, and top comments

### Claude AI Integration

The extension automatically:
1. Opens a new Claude AI session
2. Inserts the appropriate prompt template
3. Adds the extracted content
4. Submits the prompt to generate a summary

## Installation

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
3. Select the desired summary type (if different from the auto-detected type)
4. Click "Summarize with Claude"

### Method 2: Context Menu
1. Right-click anywhere on a web page, Reddit post, or YouTube video
2. Select "Summarize with Claude" from the context menu

### Method 3: Text Selection
1. Select specific text on any page
2. Right-click on the selection
3. Choose "Summarize Selection with Claude"

## Permissions

The extension requires the following permissions:
- `contextMenus`: For right-click menu integration
- `activeTab`: To access the content of the active tab
- `scripting`: To inject content scripts
- `storage`: To store extracted content temporarily
- `tabs`: To manage tab operations

## Development

- Built with JavaScript and Chrome Extension Manifest V3
- Uses webpack for bundling
- Includes specialized content extractors for different content types

To modify the extension:
1. Edit files in the `src` directory
2. Run `npm run build` to rebuild
3. Refresh the extension in Chrome

## Notes

- The extension does not store or send your data to any third-party servers
- Content is processed locally and sent directly to Claude AI
- Requires a Claude AI account to use