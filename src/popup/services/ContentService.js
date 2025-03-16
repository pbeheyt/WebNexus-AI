// popup/services/ContentService.js
import { CONTENT_TYPES } from '../constants.js';

export default class ContentService {
  constructor(tabService) {
    this.tabService = tabService;
  }

  detectContentType(url) {
    const isPdf = url.endsWith('.pdf');
    const containsPdfPath = url.includes('/pdf/');
    const containsPdfViewer = url.includes('pdfviewer');
    const isChromeExtensionPdf = url.includes('chrome-extension://') && url.includes('pdfviewer');
    
    if (isPdf || containsPdfPath || containsPdfViewer || isChromeExtensionPdf) {
      return CONTENT_TYPES.PDF;
    } else if (url.includes('youtube.com/watch')) {
      return CONTENT_TYPES.YOUTUBE;
    } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
      return CONTENT_TYPES.REDDIT;
    } else {
      return CONTENT_TYPES.GENERAL;
    }
  }

  async injectContentScript(tabId, contentType) {
    let scriptFile = 'dist/general-content.bundle.js';
    
    if (contentType === CONTENT_TYPES.YOUTUBE) {
      scriptFile = 'dist/youtube-content.bundle.js';
    } else if (contentType === CONTENT_TYPES.REDDIT) {
      scriptFile = 'dist/reddit-content.bundle.js';
    } else if (contentType === CONTENT_TYPES.PDF) {
      scriptFile = 'dist/pdf-content.bundle.js';
    }
    
    const result = await this.tabService.executeScript(tabId, scriptFile);
    
    // Wait a moment for script to initialize
    if (result) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return result;
  }

  async isContentScriptLoaded(tabId) {
    const response = await this.tabService.sendMessage(tabId, { action: 'ping' });
    return !!(response && !response.error);
  }
}