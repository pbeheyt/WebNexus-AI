// src/sidepanel/components/ContextView.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { IconButton, XIcon } from '../../components';

export function ContextView({ contextData, onBackToChat }) {
  if (!contextData) {
    // Fallback in case this view is rendered without data
    return (
      <div className='flex-1 flex flex-col p-4'>
        <div className='flex justify-between items-center pb-2 border-b border-theme'>
          <h2 className='text-base font-semibold text-theme-primary'>
            No Context
          </h2>
          <IconButton
            icon={XIcon}
            onClick={onBackToChat}
            ariaLabel='Back to chat'
            title='Back to chat'
            className='p-1.5 text-theme-secondary hover:text-primary'
          />
        </div>
        <div className='flex-1 flex items-center justify-center text-theme-secondary'>
          <p>No context data to display.</p>
        </div>
      </div>
    );
  }

  const { title, content } = contextData;

  return (
    <div className='flex-1 flex flex-col h-full bg-theme-surface'>
      {/* Header for the Context View */}
      <div className='flex-shrink-0 flex justify-between items-center p-3 border-b border-theme bg-theme-secondary'>
        <h2 className='text-sm font-medium text-theme-primary truncate'>
          {title || 'Included Context'}
        </h2>
        <IconButton
          icon={XIcon}
          onClick={onBackToChat}
          ariaLabel='Back to chat'
          title='Back to chat'
          className='p-1.5 text-theme-secondary hover:text-primary rounded-md'
        />
      </div>

      {/* Scrollable Content Area */}
      <div className='flex-1 p-4 overflow-y-auto'>
        <pre className='whitespace-pre-wrap break-words text-sm text-theme-primary font-sans'>
          {content}
        </pre>
      </div>
    </div>
  );
}

ContextView.propTypes = {
  contextData: PropTypes.shape({
    title: PropTypes.string,
    content: PropTypes.string.isRequired,
  }),
  onBackToChat: PropTypes.func.isRequired,
};

export default ContextView;
