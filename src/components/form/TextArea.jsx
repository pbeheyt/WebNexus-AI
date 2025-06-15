import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';

import ValidationError from './ValidationError';

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
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState(false);

    const validate = useCallback(
      (currentValue) => {
        let errorMessage = null;
        if (required && !currentValue.trim()) {
          errorMessage = 'This field is required.';
        } else if (maxLength && currentValue.length > maxLength) {
          errorMessage = `Cannot exceed ${maxLength} characters.`;
        }
        setError(errorMessage);
        onValidation(!errorMessage); // Pass validity state to parent
        return !errorMessage;
      },
      [required, maxLength, onValidation]
    );
    const combinedRef = (element) => {
      textareaRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    };

    // Perform validation on initial mount and when value changes from parent
    useEffect(() => {
      validate(value || '');
    }, [value, validate]);

const handleChange = (e) => {
  if (!touched) setTouched(true);
  validate(e.target.value);
  if (onChange) {
    onChange(e);
  }
};

const handleBlur = (e) => {
  if (!touched) setTouched(true);
  validate(e.target.value);
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

    const showVisualError = error && touched;
    const errorClasses = showVisualError ? 'border-error ring-1 ring-error' : '';
    const combinedClasses =
      `w-full p-3 outline-none text-theme-primary resize-none ${errorClasses} ${className}`.trim();

return (
  <div className={`w-full ${wrapperClassName}`}>
    <textarea
      ref={combinedRef}
      id={id}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={maxLength}
      className={combinedClasses}
      style={style}
      aria-invalid={!!showVisualError}
      aria-describedby={showVisualError ? `${id}-error` : undefined}
      {...props}
    />
    <div id={`${id}-error`}>
      <ValidationError message={showVisualError ? error : null} />
    </div>
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
