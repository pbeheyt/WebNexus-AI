// src/components/core/Modal.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import { IconButton, XIcon } from '../';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  widthClass = 'max-w-md',
}) {
  const backdropRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      setTimeout(() => contentRef.current?.focus(), 50);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (event) => {
    if (backdropRef.current && event.target === backdropRef.current) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (event) => {
    if (backdropRef.current && event.target === backdropRef.current) {
      if (event.key === 'Enter' || event.key === ' ') {
        onClose();
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={backdropRef}
      className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out outline-none'
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role='dialog' // Role is appropriate
      aria-modal='true'
      aria-labelledby={title ? 'modal-title' : undefined}
      tabIndex='-1' // Make backdrop focusable, but not in natural tab order. Focus is managed programmatically.
      // Screen readers often announce the dialog role and its content.
      // Direct interaction with backdrop usually via Esc or click.
      // If we want it in tab order: tabIndex="0". For now, -1 is fine as focus goes to content.
    >
      <div
        ref={contentRef}
        className={`bg-theme-primary p-6 rounded-lg shadow-xl relative ${widthClass} w-full transform transition-all duration-300 ease-in-out outline-none`}
        tabIndex='-1'
      >
        {/* Modal Header */}
        <div className='flex justify-between items-center pb-3 mb-6 border-b border-theme'>
          {title && (
            <h2
              id='modal-title'
              className='text-lg font-semibold text-theme-primary'
            >
              {title}
            </h2>
          )}
          <IconButton
            icon={XIcon}
            onClick={onClose}
            ariaLabel='Close modal'
            className='text-theme-secondary hover:text-theme-primary p-1 -mr-2 -mt-1'
            iconClassName='w-5 h-5'
          />
        </div>

        {/* Modal Body */}
        <div>{children}</div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  widthClass: PropTypes.string,
};

export default Modal;
