import React, {
  forwardRef,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';

/**
 * Enhanced textarea component with auto-resize and validation capabilities.
 */
export const TextArea = forwardRef(
  (
    {
      value,
      onChange,
      placeholder,
      maxLength,
      className = '',
      wrapperClassName = '',
      autoResize = true,
      style = {},
      focusAtEnd = false,
      required = false,
      onValidation = () => {},
      id,
      ...props
    },
        ref
      ) => {
        const textareaRef = useRef(null);
    
        // Pure validation function: returns error message or null, doesn't set state.
    const validate = useCallback(
      (currentValue) => {
        let errorMessage = null;
        if (required && !currentValue.trim()) {
          errorMessage = 'This field is required.';
        } else if (maxLength && currentValue.length > maxLength) {
          errorMessage = `Cannot exceed ${maxLength} characters.`;
        }
        return errorMessage;
      },
      [required, maxLength]
    );
    const combinedRef = (element) => {
      textareaRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    };

    // Report validity to parent on every value change, without showing visual error.
        useEffect(() => {
          const errorMessage = validate(value || '');
          onValidation(!errorMessage);
        }, [value, validate, onValidation]);
    
        const handleChange = (e) => {
          if (onChange) {
            onChange(e);
          }
        };

    // Auto-resize functionality
    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const currentStyle = textareaRef.current.style;
        const computedStyle = window.getComputedStyle(textareaRef.current);
        currentStyle.height = 'auto';
        const minHeightPx = parseFloat(computedStyle.minHeight) || 0;
        const maxHeightPx = parseFloat(computedStyle.maxHeight) || Infinity;
        const newHeight = Math.max(
          minHeightPx,
          Math.min(textareaRef.current.scrollHeight, maxHeightPx)
        );
        currentStyle.height = `${newHeight}px`;
      }
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
    
        const combinedClasses =
          `w-full p-3 outline-none text-theme-primary resize-none ${className}`.trim();
    
        return (
          <div className={`w-full ${wrapperClassName}`}>
            <textarea
              ref={combinedRef}
              id={id}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className={combinedClasses}
              style={style}
              {...props}
            />
          </div>
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
  wrapperClassName: PropTypes.string,
  autoResize: PropTypes.bool,
  style: PropTypes.object,
  focusAtEnd: PropTypes.bool,
  required: PropTypes.bool,
  onValidation: PropTypes.func,
  id: PropTypes.string.isRequired,
};

export default TextArea;
