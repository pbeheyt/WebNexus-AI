import React, { useState, memo, forwardRef } from 'react';
import PropTypes from 'prop-types';

import {
  TextArea,
  Button,
  IconButton,
  EditIcon,
  RerunIcon,
} from '../../../components';
import { useSidePanelChat } from '../../contexts/SidePanelChatContext';

import { useCopyToClipboard } from './hooks/useCopyToClipboard';

// Common button styling classes
const actionButtonClasses =
  'p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary';

export const UserMessageBubble = memo(
  forwardRef(
    (
      {
        id,
        content,
        pageContextUsed,
        className = '',
        style = {},
        // Other props are destructured but not used directly in this component
        // They are included to accept the full original props signature
        // isStreaming, model, platformIconUrl, platformId, metadata, etc.
      },
      ref
    ) => {
      // User message logic copied from original MessageBubble.jsx
      const [isEditing, setIsEditing] = useState(false);
      const [editedContent, setEditedContent] = useState(content);
      const { rerunMessage, editAndRerunMessage, isProcessing, isCanceling } =
        useSidePanelChat();
      const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
        useCopyToClipboard(content);

      const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault(); // Prevent newline
          if (editedContent.trim()) {
            // Check if content is not just whitespace
            editAndRerunMessage(id, editedContent);
            setIsEditing(false);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault(); // Prevent potential browser/modal escape actions
          setIsEditing(false); // Cancel editing
          setEditedContent(content); // Optionally reset changes on escape
        }
      };

      const handleSaveAndRerun = () => {
        if (editedContent.trim()) {
          editAndRerunMessage(id, editedContent);
          setIsEditing(false);
        }
      };

      const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedContent(content); // Reset content to original
      };

      return (
        <div
          ref={ref}
          id={id}
          style={style}
          className={`group px-5 @md:px-6 @lg:px-7 @xl:px-8 pt-4 w-full flex flex-col items-end message-group user-message relative ${className}`}
        >
          {/* Bubble container with conditional width */}
          <div
            className={`
                    bg-gray-200 dark:bg-gray-700
                    rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl
                    p-3 max-w-[85%]
                    transition-all duration-150 ease-in-out
                    ${isEditing ? 'w-full' : ''}
                `}
          >
            {/* Display Mode */}
            {!isEditing && (
              <>
                <div className='whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm'>
                  {content}
                </div>
                {pageContextUsed && (
                  <div className="mt-1 pt-1 border-t border-gray-300 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">(Page context was included)</span>
                  </div>
                )}
              </>
            )}

            {/* Editing Mode */}
            {isEditing && (
              <div className='flex flex-col w-full space-y-3 select-none'>
                <TextArea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className='w-full text-sm border border-primary rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary'
                  style={{ minHeight: '4rem' }}
                  focusAtEnd={isEditing}
                  aria-label='Edit message content'
                />
                <div className='flex justify-end gap-2'>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={handleCancelEdit}
                    className='px-4 select-none'
                  >
                    Cancel
                  </Button>
                  <Button
                    variant='primary'
                    size='sm'
                    onClick={handleSaveAndRerun}
                    disabled={!editedContent.trim()}
                    className='px-4 select-none'
                  >
                    Save & Rerun
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons below bubble (only show when not editing) */}
          {!isEditing && (
            <div
              className={`flex items-center gap-1 mt-1.5 transition-opacity duration-150 ${isProcessing ? 'opacity-0 pointer-events-none' : copyState === 'copied' || copyState === 'error' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
            >
              <IconButton
                icon={EditIcon}
                iconClassName='w-4 h-4 select-none'
                onClick={() => {
                  setIsEditing(true);
                  setEditedContent(content); // Ensure editor starts with current content
                }}
                aria-label='Edit message'
                title='Edit message'
                className={actionButtonClasses}
                disabled={isProcessing || isCanceling}
              />
              <IconButton
                icon={RerunIcon}
                iconClassName='w-4 h-4 select-none'
                onClick={() => rerunMessage(id)}
                aria-label='Rerun message'
                title='Rerun message'
                className={actionButtonClasses}
                disabled={isProcessing || isCanceling}
              />
              <IconButton
                onClick={handleCopy}
                className={actionButtonClasses}
                aria-label='Copy message'
                title='Copy message'
                icon={IconComponent}
                iconClassName={`w-4 h-4 select-none ${iconClassName}`}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      );
    }
  )
);

UserMessageBubble.propTypes = {
  id: PropTypes.string.isRequired,
  content: PropTypes.string,
  pageContextUsed: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  role: PropTypes.string,
};

UserMessageBubble.displayName = 'UserMessageBubble';
