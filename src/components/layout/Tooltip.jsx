// src/components/layout/Tooltip.jsx
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Tooltip component for displaying messages with configurable delay.
 * Uses useLayoutEffect for robust positioning to prevent rendering glitches.
 * @param {string} [id] - Optional ID for the tooltip, useful for aria-describedby.
 * @param {boolean} show - Whether to show the tooltip.
 * @param {React.ReactNode} message - Tooltip content (string or JSX).
 * @param {string} [position='top'] - Position of the tooltip.
 * @param {number} [offset=8] - Offset from the target.
 * @param {string|number} [width='auto'] - Width of the tooltip.
 * @param {number} [delay=500] - Delay in ms before showing tooltip (default: 500ms).
 * @param {object} targetRef - Reference to the target element.
 */
export function Tooltip({
  id,
  show,
  message,
  position = 'top',
  offset = 8,
  width = 'auto',
  delay = 500,
  targetRef,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({ opacity: 0 });
  const timeoutRef = useRef(null);

  // Effect to manage visibility with a delay
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (show) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [show, delay]);

  // useLayoutEffect for synchronous DOM measurement and positioning
  useLayoutEffect(() => {
    if (isVisible && targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;

      let top, left;

      switch (position) {
        case 'top':
          top = targetRect.top - offset - tooltipHeight;
          left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + offset;
          left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
          left = targetRect.left - offset - tooltipWidth;
          break;
        case 'right':
          top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
          left = targetRect.right + offset;
          break;
        default: // Default to top
          top = targetRect.top - offset - tooltipHeight;
          left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
          break;
      }

      // Adjust for viewport overflow
      if (top < 0 && position === 'top') {
        top = targetRect.bottom + offset; // Switch to bottom
      } else if (
        top + tooltipHeight > window.innerHeight &&
        position === 'bottom'
      ) {
        top = targetRect.top - offset - tooltipHeight; // Switch to top
      }
      if (top < 0) top = offset; // Final check to prevent top overflow

      if (left < 0) {
        left = offset;
      } else if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - offset;
      }

      setTooltipStyle({
        top,
        left,
        position: 'fixed',
        opacity: 1,
      });
    } else {
      // Hide if not visible
      setTooltipStyle({ opacity: 0 });
    }
  }, [isVisible, position, offset, targetRef, message]);

  if (!isVisible) {
    return null;
  }

  const widthClass = width === 'auto' ? '' : `w-${width}`;

  return (
    <div
      id={id}
      ref={tooltipRef}
      style={tooltipStyle}
      className={`fixed bg-theme-surface text-theme-primary border border-theme text-xs rounded py-1 px-2 ${widthClass} text-center shadow-theme-medium z-50 transition-opacity duration-200 select-none pointer-events-none`}
      role='tooltip'
    >
      {message}
    </div>
  );
}

Tooltip.propTypes = {
  id: PropTypes.string,
  show: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  offset: PropTypes.number,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  delay: PropTypes.number,
  targetRef: PropTypes.object,
};
