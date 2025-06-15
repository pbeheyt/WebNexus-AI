// src/sidepanel/components/ContextView.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { IconButton, XIcon } from '../../components';

export function ContextView({ contextData, onBackToChat }) {
  if (!contextData) {
    // Fallback in case this view is rendered without data
    return (
      <div className='relative flex-1 flex flex-col p-4 bg-theme-surface'>
        <IconButton
          icon={XIcon}
          onClick={onBackToChat}
          ariaLabel='Back to chat'
          title='Back to chat'
          className='absolute top-2 right-4 z-10 p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
        />
        <div className='flex-1 flex items-center justify-center text-theme-secondary'>
          <p>No context data to display.</p>
        </div>
      </div>
    );
  }

  const { content } = contextData;

  return (
    <div className='relative flex-1 flex flex-col h-full bg-theme-surface'>
      <IconButton
        icon={XIcon}
        onClick={onBackToChat}
        ariaLabel='Back to chat'
        title='Back to chat'
        className='absolute top-2 right-4 z-10 p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
      />

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
