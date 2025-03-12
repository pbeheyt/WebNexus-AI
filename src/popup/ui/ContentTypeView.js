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
    let iconSvg = '';
    
    switch (contentType) {
      case CONTENT_TYPES.YOUTUBE:
        typeText = 'YouTube Video';
        typeClass = 'youtube';
        iconSvg = `
          <svg class="youtube-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8387 5.15941C21.498 4.80824 21.0708 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.46C2.92925 4.59318 2.50198 4.84824 2.16135 5.19941C1.82072 5.55057 1.57879 5.98541 1.46 6.46C1.14521 8.20556 0.991235 9.97631 1 11.75C0.988687 13.537 1.14266 15.3213 1.46 17.08C1.57879 17.5546 1.82072 17.9894 2.16135 18.3406C2.50198 18.6918 2.92925 18.9468 3.4 19.08C5.12 19.54 12 19.54 12 19.54C12 19.54 18.88 19.54 20.6 19.08C21.0708 18.9468 21.498 18.6918 21.8387 18.3406C22.1793 17.9894 22.4212 17.5546 22.54 17.08C22.8524 15.3398 23.0063 13.5747 23 11.8C23.0113 10.0129 22.8573 8.22856 22.54 6.47" 
              stroke="#FF0000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.75 15.02L15.5 11.75L9.75 8.48001V15.02Z" fill="#FF0000" stroke="#FF0000" 
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        break;
      case CONTENT_TYPES.REDDIT:
        typeText = 'Reddit Post';
        typeClass = 'reddit';
        iconSvg = `
          <svg class="reddit-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle class="st0" cx="12" cy="12" r="10" fill="#FF4500"/>
            <path class="st1" fill="#FFFFFF" d="M18.6,12c0-0.8-0.7-1.4-1.5-1.4c-0.4,0-0.7,0.2-0.9,0.4c-1.1-0.8-2.4-1.2-3.8-1.2l0.6-3.1l2.1,0.4
              c0.1,0.5,0.5,0.9,1.1,0.9c0.5,0,0.9-0.5,0.9-1.1c0-0.6-0.5-1-1.1-0.9c-0.3,0-0.6,0.2-0.7,0.5l-2.4-0.5c-0.2,0-0.3,0.1-0.4,0.2L12,9.1
              c-1.4,0-2.7,0.4-3.8,1.2c-0.6-0.5-1.5-0.5-2,0.1c-0.5,0.6-0.5,1.5,0.1,2c0.1,0.1,0.2,0.2,0.4,0.3c0,0.1,0,0.3,0,0.4
              c0,2.2,2.6,4,5.8,4c3.2,0,5.8-1.8,5.8-4c0-0.1,0-0.3,0-0.4C18.3,13.1,18.6,12.5,18.6,12z M8.7,13.1c0-0.5,0.4-1,1-1s1,0.4,1,1
              c0,0.5-0.4,1-1,1C9.2,14.1,8.7,13.7,8.7,13.1z M14.3,15.8c-0.7,0.5-1.6,0.8-2.4,0.8c-0.9,0-1.7-0.2-2.4-0.8c-0.1-0.1-0.1-0.3,0-0.4
              c0.1-0.1,0.2-0.1,0.3,0c0.6,0.4,1.3,0.7,2.1,0.6c0.7,0,1.5-0.2,2.1-0.6c0.1-0.1,0.3-0.1,0.4,0C14.4,15.5,14.4,15.7,14.3,15.8z
              M14.3,14.1c-0.5,0-1-0.4-1-1c0-0.5,0.4-1,1-1c0.5,0,1,0.4,1,1C15.3,13.6,14.9,14.1,14.3,14.1z"/>
          </svg>
        `;
        break;
      case CONTENT_TYPES.GENERAL:
        typeText = 'Web Content';
        typeClass = 'general';
        iconSvg = `
          <svg class="general-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 8H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 16H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;
        break;
      default:
        typeText = 'Unsupported Content';
        typeClass = 'unsupported';
        iconSvg = `
          <svg class="general-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;
    }
    
    this.element.className = `content-type ${typeClass}`;
    this.element.innerHTML = iconSvg + typeText;
  }
}