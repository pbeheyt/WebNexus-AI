import React, { useEffect, useState, useRef } from 'react';

/**
 * Tooltip component for displaying messages.
 * @param {boolean} show - Whether to show the tooltip.
 * @param {React.ReactNode} message - Tooltip content (string or JSX).
 * @param {string} [position='top'] - Position of the tooltip.
 * @param {number} [offset=8] - Offset from the target.
 * @param {string|number} [width='auto'] - Width of the tooltip.
 * @param {number} [delay=0] - Delay before showing.
 * @param {object} targetRef - Reference to the target element.
 */
export function Tooltip({ show, message, position = 'top', offset = 8, width = 'auto', delay = 0, targetRef }) {
const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  useEffect(() => {
    let timeout;
    if (show) {
      timeout = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(false);
    }
    return () => clearTimeout(timeout);
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
          left = rect.left - offset;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + offset - tooltipWidth;
          break;
        default:
          // Default to bottom positioning
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
      }

      // Adjust for viewport overflow
      if (top < 0) {
        // Overflow at the top
        top = rect.bottom + offset;
      } else if (top + tooltipHeight > window.innerHeight) {
        // Overflow at the bottom
        top = rect.top - offset - tooltipHeight;
      }

      if (left < 0) {
        // Overflow to the left
        left = 0;
      } else if (left + tooltipWidth > window.innerWidth) {
        // Overflow to the right
        left = window.innerWidth - tooltipWidth;
      }

      setTooltipStyle({ top, left });
    }
  }, [isVisible, position, offset, targetRef]);

  // First rendering with opacity 0 to get dimensions
  if (!isVisible) {
    return null;
  }

  // Handle width styling
  const widthClass = width === 'auto' ? '' : `w-${width}`;
  
  return (
    <div
      ref={tooltipRef}
      style={{
        ...tooltipStyle,
        position: 'fixed',
        visibility: Object.keys(tooltipStyle).length ? 'visible' : 'hidden'
      }}
      className={`fixed bg-theme-surface text-theme-primary border border-theme text-xs rounded py-1 px-2 ${widthClass} text-center shadow-theme-medium z-50 transition-opacity duration-200 opacity-100 select-none`}
    >
      {message}
    </div>
  );
}
