import React from 'react';
import { useSidebarContent } from '../contexts/SidebarContentContext';
import { CONTENT_TYPES } from '../../shared/constants';

function ContentTypeDisplay() {
  const { contentType, isLoading, isTextSelected } = useSidebarContent();
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
        <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        <span>Detecting page type...</span>
      </div>
    );
  }
  
  const contentTypeConfig = {
    [CONTENT_TYPES.YOUTUBE]: {
      label: 'YouTube Video',
      color: '#FF0000',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8387 5.15941C21.498 4.80824 21.0708 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.46C2.92925 4.59318 2.50198 4.84824 2.16135 5.19941C1.82072 5.55057 1.57879 5.98541 1.46 6.46C1.14521 8.20556 0.991235 9.97631 1 11.75C0.988687 13.537 1.14266 15.3213 1.46 17.08C1.57879 17.5546 1.82072 17.9894 2.16135 18.3406C2.50198 18.6918 2.92925 18.9468 3.4 19.08C5.12 19.54 12 19.54 12 19.54C12 19.54 18.88 19.54 20.6 19.08C21.0708 18.9468 21.498 18.6918 21.8387 18.3406C22.1793 17.9894 22.4212 17.5546 22.54 17.08C22.8524 15.3398 23.0063 13.5747 23 11.8C23.0113 10.0129 22.8573 8.22856 22.54 6.47" 
            stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.75 15.02L15.5 11.75L9.75 8.48001V15.02Z" fill="#FF0000" stroke="#FF0000" 
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    [CONTENT_TYPES.REDDIT]: {
      label: 'Reddit Post',
      color: '#FF4500',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#FF4500"/>
          <path fill="#FFFFFF" d="M18.6,12c0-0.8-0.7-1.4-1.5-1.4c-0.4,0-0.7,0.2-0.9,0.4c-1.1-0.8-2.4-1.2-3.8-1.2l0.6-3.1l2.1,0.4
            c0.1,0.5,0.5,0.9,1.1,0.9c0.5,0,0.9-0.5,0.9-1.1c0-0.6-0.5-1-1.1-0.9c-0.3,0-0.6,0.2-0.7,0.5l-2.4-0.5c-0.2,0-0.3,0.1-0.4,0.2L12,9.1
            c-1.4,0-2.7,0.4-3.8,1.2c-0.6-0.5-1.5-0.5-2,0.1c-0.5,0.6-0.5,1.5,0.1,2c0.1,0.1,0.2,0.2,0.4,0.3c0,0.1,0,0.3,0,0.4
            c0,2.2,2.6,4,5.8,4c3.2,0,5.8-1.8,5.8-4c0-0.1,0-0.3,0-0.4C18.3,13.1,18.6,12.5,18.6,12z M8.7,13.1c0-0.5,0.4-1,1-1s1,0.4,1,1
            c0,0.5-0.4,1-1,1C9.2,14.1,8.7,13.7,8.7,13.1z M14.3,15.8c-0.7,0.5-1.6,0.8-2.4,0.8c-0.9,0-1.7-0.2-2.4-0.8c-0.1-0.1-0.1-0.3,0-0.4
            c0.1-0.1,0.2-0.1,0.3,0c0.6,0.4,1.3,0.7,2.1,0.6c0.7,0,1.5-0.2,2.1-0.6c0.1-0.1,0.3-0.1,0.4,0C14.4,15.5,14.4,15.7,14.3,15.8z
            M14.3,14.1c-0.5,0-1-0.4-1-1c0-0.5,0.4-1,1-1c0.5,0,1,0.4,1,1C15.3,13.6,14.9,14.1,14.3,14.1z"/>
        </svg>
      )
    },
    [CONTENT_TYPES.PDF]: {
      label: 'PDF Document',
      color: '#F40F02',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" 
            stroke="#F40F02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#F40F02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 13H15" stroke="#F40F02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 17H12" stroke="#F40F02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    [CONTENT_TYPES.GENERAL]: {
      label: 'Web Content',
      color: '#3B82F6', // Tailwind blue-500
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="3" y="3" width="18" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor"/>
          <circle cx="7.5" cy="4.5" r="0.75" fill="currentColor"/>
          <circle cx="10.5" cy="4.5" r="0.75" fill="currentColor"/>
          <path d="M5 10H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5 14H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5 18H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    },
    [CONTENT_TYPES.SELECTED_TEXT]: {
      label: 'Selected Text',
      color: '#3498db',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2v16l4-4 3 7 4-2-3-6h6L4 2z" 
                fill="#3498db" 
                stroke="#ffffff" 
                strokeWidth="0.75" 
                strokeLinejoin="round"/>
        </svg>
      )
    }
  };
  
  const typeConfig = contentTypeConfig[contentType] || contentTypeConfig[CONTENT_TYPES.GENERAL];
  
  return (
    <div 
      className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm"
      style={{ borderLeftColor: typeConfig.color, borderLeftWidth: '3px' }}
    >
      {typeConfig.icon}
      <span>{isTextSelected ? 'Selected Text' : typeConfig.label}</span>
    </div>
  );
}

export default ContentTypeDisplay;