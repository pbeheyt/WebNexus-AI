// --- START FULL FILE: src/components/layout/Tooltip.jsx ---
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Tooltip component for displaying messages with configurable delay.
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
  const [tooltipStyle, setTooltipStyle] = useState({});
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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

  useEffect(() => {
    if (isVisible && targetRef.current && tooltipRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;

      let top, left;

      switch (position) {
        case 'top':
          top = rect.top - offset - tooltipHeight;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - offset - tooltipWidth;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + offset;
          break;
        default: // Default to top if position is invalid
          top = rect.top - offset - tooltipHeight;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
      }

      // Adjust for viewport overflow
      if (top < 0 && position === 'top') { // If top overflow, try to switch to bottom
        top = rect.bottom + offset;
      } else if (top + tooltipHeight > window.innerHeight && position === 'bottom') { // If bottom overflow, try to switch to top
        top = rect.top - offset - tooltipHeight;
      }
      // Ensure top is not negative after potential switch
      if (top < 0) top = offset;


      if (left < 0) {
        left = offset;
      } else if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - offset;
      }

      setTooltipStyle({ top, left });
    }
  }, [isVisible, position, offset, targetRef, message]);

  if (!isVisible) {
    return null;
  }

  const widthClass = width === 'auto' ? '' : `w-${width}`;

  return (
    <div
      id={id} // Apply the id
      ref={tooltipRef}
      style={{
        ...tooltipStyle,
        position: 'fixed',
        visibility: Object.keys(tooltipStyle).length ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
      className={`fixed bg-theme-surface text-theme-primary border border-theme text-xs rounded py-1 px-2 ${widthClass} text-center shadow-theme-medium z-50 transition-opacity duration-200 opacity-100 select-none`}
      role="tooltip" // ARIA role
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