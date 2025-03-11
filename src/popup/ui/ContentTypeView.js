// popup/ui/ContentTypeView.js
import { CONTENT_TYPES } from '../constants.js';

export default class ContentTypeView {
  constructor(element) {
    this.element = element;
  }

  update(contentType) {
    if (!this.element) return;
    
    let typeText = 'Unknown Content';
    let typeClass = 'unknown';
    
    switch (contentType) {
      case CONTENT_TYPES.YOUTUBE:
        typeText = 'YouTube Video';
        typeClass = 'youtube';
        break;
      case CONTENT_TYPES.REDDIT:
        typeText = 'Reddit Post';
        typeClass = 'reddit';
        break;
      case CONTENT_TYPES.GENERAL:
        typeText = 'Web Content';
        typeClass = 'general';
        break;
      default:
        typeText = 'Unsupported Content';
        typeClass = 'unsupported';
    }
    
    this.element.textContent = typeText;
    this.element.className = `content-type ${typeClass}`;
  }
}