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
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
              fill="#FF4500" fill-opacity="0.2" stroke="#FF4500" stroke-width="1.5"/>
            <path d="M16.5 12C16.5 11.1716 15.8284 10.5 15 10.5C14.1716 10.5 13.5 11.1716 13.5 12" stroke="#FF4500" stroke-width="1.5"/>
            <path d="M10.5 12C10.5 11.1716 9.82843 10.5 9 10.5C8.17157 10.5 7.5 11.1716 7.5 12" stroke="#FF4500" stroke-width="1.5"/>
            <path d="M14.8246 15.8648C14.1887 16.4995 13.1143 17.0228 11.9973 17.0228C10.8803 17.0228 9.80825 16.4995 9.17234 15.8648" 
              stroke="#FF4500" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M17.1359 8.05306C17.1359 7.27358 16.5057 6.64337 15.7262 6.64337C15.3893 6.64337 15.0775 6.76158 14.8327 6.95707" 
              stroke="#FF4500" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M17.9518 10.4985C17.9518 9.54706 17.1843 8.7796 16.2329 8.7796C15.2814 8.7796 14.5139 9.54706 14.5139 10.4985C14.5139 11.45 15.2814 12.2175 16.2329 12.2175" 
              stroke="#FF4500" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12.0025 12.2175C13.9054 12.2175 15.7262 12.6883 17.0765 13.4979C18.4268 14.3075 19.2363 15.4126 19.2363 16.5892C19.2363 17.7659 18.4268 18.871 17.0765 19.6806C15.7262 20.4902 13.9054 20.961 12.0025 20.961C10.0996 20.961 8.27878 20.4902 6.92849 19.6806C5.5782 18.871 4.76862 17.7659 4.76862 16.5892C4.76862 15.4126 5.5782 14.3075 6.92849 13.4979C8.27878 12.6883 10.0996 12.2175 12.0025 12.2175Z" 
              stroke="#FF4500" stroke-width="1.5"/>
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