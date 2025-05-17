// src/components/form/TextArea.jsx
import React, { forwardRef, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Enhanced textarea component with auto-resize capability.
 * Heights are now controlled via the `style` prop passed from the parent.
 */
export const TextArea = forwardRef(
  (
    {
      value,
      onChange,
      placeholder,
      maxLength,
      className = '',
      autoResize = true,
      style = {},
      focusAtEnd = false,
      ...props
    },
    ref
  ) => {
    const textareaRef = useRef(null);
    const combinedRef = (element) => {
      textareaRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    };

    // Auto-resize functionality - respects minHeight/maxHeight from style prop
    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const currentStyle = textareaRef.current.style;
        const computedStyle = window.getComputedStyle(textareaRef.current);

        // Temporarily reset height to calculate scrollHeight accurately
        currentStyle.height = 'auto';

        // Determine min/max height from the style prop or defaults if not provided
        // Use parseFloat to handle units like 'rem', 'px' etc.
        const minHeightPx = parseFloat(computedStyle.minHeight) || 0; // Default to 0 if not set/invalid
        const maxHeightPx = parseFloat(computedStyle.maxHeight) || Infinity; // Default to Infinity

        // Calculate the new height
        const newHeight = Math.max(
          minHeightPx,
          Math.min(textareaRef.current.scrollHeight, maxHeightPx)
        );

        currentStyle.height = `${newHeight}px`;
      }
      // Rerun effect if value, autoResize, or style-based heights change
    }, [value, autoResize, style.minHeight, style.maxHeight]);

    // Focus cursor at end when focusAtEnd is true
    useEffect(() => {
      if (focusAtEnd && textareaRef.current) {
        const length = value.length;
        const element = textareaRef.current;
        element.setSelectionRange(length, length);
        element.focus();
      }
    }, [focusAtEnd, value]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full p-3 border-none outline-none text-theme-primary resize-vertical ${className}`}
        style={style}
        {...props}
      />
    );
  }
);

TextArea.displayName = 'TextArea';

TextArea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  className: PropTypes.string,
  autoResize: PropTypes.bool,
  style: PropTypes.object,
  focusAtEnd: PropTypes.bool,
};

export default TextArea;
