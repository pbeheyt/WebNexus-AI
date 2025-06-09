import React, { useState, memo, forwardRef, useRef } from 'react';
import PropTypes from 'prop-types';

import {
  TextArea,
  Button,
  IconButton,
  EditIcon,
  RerunIcon,
  ContentTypeIcon,
  Tooltip,
  ArrowRightIcon,
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

      const [isContextBadgeTooltipVisible, setIsContextBadgeTooltipVisible] = useState(false);
      const contextBadgeTriggerRef = useRef(null); // Ref for the element that triggers the tooltip (the icon wrapper)

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

      const shouldDisplayBadgeElements = !isEditing && pageContextUsed && contextTypeUsed && CONTENT_TYPE_LABELS[contextTypeUsed];

      return (
    <div
      ref={ref}
      id={id}
      style={style}
      className={`message-group px-5 @md:px-6 @lg:px-7 @xl:px-8 pt-6 w-full flex flex-col items-end user-message relative ${className}`}
    >
          {/* Container for badge and bubble, aligned to the right. Changed items-start to items-center */}
          <div className={`flex flex-row items-center justify-end w-full ${isEditing ? 'max-w-full' : 'max-w-[95%]'}`}>
            {/* Badge Trigger: Appears to the left of the bubble */}
            {shouldDisplayBadgeElements && (
              <div
                ref={contextBadgeTriggerRef} // This div is the trigger and anchor for the tooltip
                className="mr-1 flex-shrink-0 cursor-help p-1 rounded-full"
                onMouseEnter={() => setIsContextBadgeTooltipVisible(true)}
                onMouseLeave={() => setIsContextBadgeTooltipVisible(false)}
                onFocus={() => setIsContextBadgeTooltipVisible(true)}
                onBlur={() => setIsContextBadgeTooltipVisible(false)}
                tabIndex={0}
                role="button"
                aria-describedby={`context-badge-tooltip-${id}`}
              >
                <ContentTypeIcon
                  contentType={contextTypeUsed}
                  className="w-5 h-5 text-theme-secondary"
                />
              </div>
            )}

            {/* Tooltip: Rendered separately but positioned relative to contextBadgeTriggerRef */}
            {shouldDisplayBadgeElements && (
                 <Tooltip
                    id={`context-badge-tooltip-${id}`}
                    show={isContextBadgeTooltipVisible}
                    message={`${CONTENT_TYPE_LABELS[contextTypeUsed]} context included`}
                    position="left"
                    targetRef={contextBadgeTriggerRef} // Points to the div wrapping the icon
                  />
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

          {/* View Context Button - Placed below the bubble */}
          {!isEditing &&
            pageContextUsed &&
            pageContextUsed.trim().length > 0 && (
              <div className='w-full flex justify-end mt-1 pr-1'>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() =>
                    switchToContextView({
                      title: `Context for: "${content.substring(0, 30)}..."`,
                      content: pageContextUsed,
                    })
                  }
                  className='text-xs'
                  title='View the page context that was included with this message'
                >
                  View Context
                  <ArrowRightIcon className='w-3 h-3 ml-1' />
                </Button>
              </div>
            )}

          {/* Action buttons below bubble (only show when not editing) */}
          {!isEditing && (
    <div
      className={`flex items-center gap-1 mt-1 transition-opacity duration-150 ${isProcessing ? 'opacity-0 pointer-events-none' : copyState === 'copied' || copyState === 'error' ? 'opacity-100' : 'opacity-0 message-group-hover:opacity-100 focus-within:opacity-100'}`}
    >
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
