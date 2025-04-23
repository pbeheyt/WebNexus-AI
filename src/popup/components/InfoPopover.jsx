import React, { useState, useEffect, useRef } from 'react';

const InfoPopover = ({
  show,
  targetRef,
  contentTypeLabel,
  position = 'bottom',
  offset = 8,
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const popoverRef = useRef(null);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  useEffect(() => {
    if (isVisible && targetRef.current && popoverRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top, left;

      switch (position) {
        case 'top':
          top = targetRect.top - popoverRect.height - offset;
          left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + offset;
          left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
          break;
        case 'left':
          top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
          left = targetRect.left - popoverRect.width - offset;
          break;
        case 'right':
          top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
          left = targetRect.right + offset;
          break;
        default: // Default to bottom
          top = targetRect.bottom + offset;
          left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
      }

      // Viewport boundary checks
      if (left < 0) left = 0;
      if (left + popoverRect.width > viewportWidth) left = viewportWidth - popoverRect.width;
      if (top < 0) top = 0;
      if (top + popoverRect.height > viewportHeight) top = viewportHeight - popoverRect.height;

      // Adjust position if it overlaps the target after boundary checks
      if (position === 'bottom' && top < targetRect.bottom) {
          top = targetRect.top - popoverRect.height - offset; // Try top
          if (top < 0) top = 0; // Check top boundary again
      } else if (position === 'top' && top + popoverRect.height > targetRect.top) {
          top = targetRect.bottom + offset; // Try bottom
          if (top + popoverRect.height > viewportHeight) top = viewportHeight - popoverRect.height; // Check bottom boundary again
      }
      // Similar checks can be added for left/right if needed

      setTooltipStyle({ top, left });
    } else {
      setTooltipStyle({}); // Reset style if not visible or refs not ready
    }
  }, [isVisible, position, offset, targetRef]); // Rerun if visibility, position, offset, or target changes

  if (!isVisible) {
    return null;
  }

  // Hardcoded sidebar icon SVG
  const sidebarIconSvg = `<svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
          <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/>
        </svg>`;

  return (
    <div
      ref={popoverRef}
      style={{
        ...tooltipStyle,
        position: 'fixed',
        visibility: Object.keys(tooltipStyle).length ? 'visible' : 'hidden',
      }}
      className="bg-theme-surface border border-theme rounded-lg shadow-theme-medium p-3 text-xs text-theme-primary z-50 max-w-xs transition-opacity duration-200 opacity-100"
      role="tooltip"
    >
      <p className="mb-1.5">
        Extract this{' '}
        <span className="font-medium text-theme-primary">{contentTypeLabel || 'content'}</span>{' '}
        from the current page and send it to your selected AI platform.
      </p>
      <p>
        Open the{' '}
        <span className="font-medium text-theme-primary">Side Panel</span>
        <span dangerouslySetInnerHTML={{ __html: sidebarIconSvg }} />
        to have your AI conversation directly alongside the page.
      </p>
    </div>
  );
};

export default InfoPopover;
