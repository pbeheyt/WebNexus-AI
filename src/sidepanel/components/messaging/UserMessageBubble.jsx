import React, { useState, memo, forwardRef } from 'react';
import PropTypes from 'prop-types';

import {
  TextArea,
  Button,
  IconButton,
  EditIcon,
  RerunIcon,
  ContentTypeIcon,
} from '../../../components';
import { useSidePanelChat } from '../../contexts/SidePanelChatContext';
import { CONTENT_TYPE_LABELS } from '../../../shared/constants';

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
        contextTypeUsed,
        className = '',
        style = {},
      },
      ref
    ) => {
      const [isEditing, setIsEditing] = useState(false);
      const [editedContent, setEditedContent] = useState(content);
      const {
        rerunMessage,
        editAndRerunMessage,
        isProcessing,
        isCanceling,
        switchToContextView,
      } = useSidePanelChat();
      const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
        useCopyToClipboard(content);

      const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (editedContent.trim()) {
            editAndRerunMessage(id, editedContent);
            setIsEditing(false);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setIsEditing(false);
          setEditedContent(content);
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
        setEditedContent(content);
      };

      const shouldDisplayBadgeElements =
        !isEditing &&
        pageContextUsed &&
        contextTypeUsed &&
        CONTENT_TYPE_LABELS[contextTypeUsed];

      return (
        <div
          ref={ref}
          id={id}
          style={style}
          className={`message-group px-5 @md:px-6 @lg:px-7 @xl:px-8 pt-6 w-full flex flex-col items-end user-message relative ${className}`}
        >
          {/* Container for badge and bubble, aligned to the right. Changed items-start to items-center */}
          <div
            className={`flex flex-row items-center justify-end w-full ${
              isEditing ? 'max-w-full' : 'max-w-[95%]'
            }`}
          >
            {/* Combined View Context Button: Appears to the left of the bubble */}
            {shouldDisplayBadgeElements && (
              <Button
                variant='secondary'
                size='sm'
                onClick={() =>
                  switchToContextView({
                    title: `Context for: "${content.substring(0, 30)}..."`,
                    content: pageContextUsed,
                  })
                }
                className='mr-3 flex-shrink-0 !px-2 !py-1' // Override padding for a tighter fit
                title={`View the ${CONTENT_TYPE_LABELS[contextTypeUsed]} context included with this message`}
              >
                <ContentTypeIcon
                  contentType={contextTypeUsed}
                  className='w-4 h-4 mr-1.5'
                />
                <span className='text-xs'>Context</span>
              </Button>
            )}

            {/* Bubble container with conditional width */}
            <div
              className={`
                      bg-gray-200 dark:bg-gray-700
                      rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl
                      p-3
                      ${isEditing ? 'w-full' : 'max-w-[85%]'}
                      transition-all duration-150 ease-in-out
                  `}
            >
              {/* Display Mode */}
              {!isEditing && (
                <>
                  <div className='whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm'>
                    {content}
                  </div>
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
                    id={`edit-message-${id}`}
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
          </div>

          {/* Action buttons container (only show when not editing) */}
          {!isEditing && (
            <div
              className={`w-full flex justify-end items-center gap-2 mt-1 pr-1 transition-opacity duration-150 ${
                isProcessing
                  ? 'opacity-0 pointer-events-none'
                  : copyState === 'copied' || copyState === 'error'
                  ? 'opacity-100'
                  : 'opacity-0 message-group-hover:opacity-100 focus-within:opacity-100'
              }`}
            >
              {/* Standard Action Icons */}
              <div className='flex items-center gap-1'>
                <IconButton
                  icon={EditIcon}
                  iconClassName='w-4 h-4 select-none'
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(content);
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
  contextTypeUsed: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  role: PropTypes.string,
};

UserMessageBubble.displayName = 'UserMessageBubble';