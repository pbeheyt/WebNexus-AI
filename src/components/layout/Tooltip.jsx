import React, { useEffect, useState, useRef } from 'react';

/**
 * Tooltip component for displaying messages with configurable delay.
 * @param {boolean} show - Whether to show the tooltip.
 * @param {React.ReactNode} message - Tooltip content (string or JSX).
 * @param {string} [position='top'] - Position of the tooltip.
 * @param {number} [offset=8] - Offset from the target.
 * @param {string|number} [width='auto'] - Width of the tooltip.
 * @param {number} [delay=500] - Delay in ms before showing tooltip (default: 500ms).
 * @param {object} targetRef - Reference to the target element.
 */
export function Tooltip({ 
  show, 
  message, 
  position = 'top', 
  offset = 8, 
  width = 'auto', 
  delay = 500, // Default delay of 500ms
  targetRef 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Clear previous timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (show) {
      // Set timeout for the specified delay
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      // Hide immediately when show becomes false
      setIsVisible(false);
    }

    // Cleanup on unmount or when dependencies change
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
        default:
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
      }

      // Adjust for viewport overflow
      if (top < 0) {
        top = rect.bottom + offset;
      } else if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - offset - tooltipHeight;
      }

      if (left < 0) {
        left = 0;
      } else if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth;
      }

      setTooltipStyle({ top, left });
    }
  }, [isVisible, position, offset, targetRef]);

  // Don't render anything if not visible
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