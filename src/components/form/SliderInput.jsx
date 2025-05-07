import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

const ANIMATION_DURATION_MS = 150; // Duration for the value animation

/**
 * A reusable component combining a range slider and a number input
 * with improved UX. The slider track and thumb dynamically animate
 * to new values when props change.
 */
export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  className = '',
  disabled = false,
}) {
  const sliderRef = useRef(null);
  const numberInputRef = useRef(null);
  const animationFrameId = useRef(null);
  const isUserInteracting = useRef(false); // Flag to track direct user interaction

  // State for the value that is actually displayed and animated
  const [animatedDisplayValue, setAnimatedDisplayValue] = useState(() => {
    const initialValue = value ?? min ?? 0;
    return Math.max(min, Math.min(max, initialValue));
  });

  // Clamp a value between min and max
  const clampValue = useCallback((val, currentMin, currentMax) => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal)) return currentMin; // Default to min if not a number
    return Math.max(currentMin, Math.min(currentMax, numericVal));
  }, []);

  // Effect to animate the slider when external props (value, min, max) change
  useEffect(() => {
    if (isUserInteracting.current) {
      // If user is interacting, don't let prop changes override immediately
      // User interaction will update animatedDisplayValue directly via handlers
      return;
    }

    const targetValue = clampValue(value, min, max);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    // Use functional update to get latest animatedDisplayValue without adding it to deps
    setAnimatedDisplayValue(currentAnimatedValue => {
      const startValue = currentAnimatedValue;
      const valueChange = targetValue - startValue;

      if (Math.abs(valueChange) < 0.001) { // No significant change, snap to target
          return targetValue;
      }

      let startTime = null;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / ANIMATION_DURATION_MS, 1);
        const currentAnimatedVal = startValue + valueChange * progress;
        
        setAnimatedDisplayValue(clampValue(currentAnimatedVal, min, max));

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setAnimatedDisplayValue(targetValue); // Ensure it ends exactly at target
          animationFrameId.current = null;
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);
      return currentAnimatedValue; // Return current value until animation updates it
    });

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [value, min, max, clampValue]);

  // Effect to update the CSS variable for track fill based on animatedDisplayValue
  useEffect(() => {
    if (sliderRef.current) {
      const currentMin = min;
      const currentMax = max;
      const range = currentMax - currentMin;
      const safeAnimatedValue = clampValue(animatedDisplayValue, currentMin, currentMax);
      const percentage = range === 0 ? 0 : ((safeAnimatedValue - currentMin) / range) * 100;
      sliderRef.current.style.setProperty('--slider-fill-percentage', `${percentage}%`);
    }
  }, [animatedDisplayValue, min, max, clampValue]);


  const handleUserInteractionStart = () => {
    isUserInteracting.current = true;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };
  
  const handleUserInteractionEnd = () => {
    // Short timeout to allow onChange to propagate and potentially update `value` prop
    // before re-enabling prop-driven animations.
    setTimeout(() => {
      isUserInteracting.current = false;
      // Trigger a re-evaluation of the main effect by slightly changing a dependency,
      // or by re-evaluating against the current prop `value`.
      // For now, we rely on the next prop change to re-initiate animation if needed.
      // A more robust solution might involve forcing a re-sync if `value` prop differs from `animatedDisplayValue`.
    }, 50);
  };


  const handleRangeChange = (event) => {
    handleUserInteractionStart();
    const newValue = parseFloat(event.target.value);
    if (!isNaN(newValue)) {
      const clampedNewValue = clampValue(newValue, min, max);
      setAnimatedDisplayValue(clampedNewValue); // Update display immediately
      onChange(clampedNewValue); // Notify parent
    }
    // handleUserInteractionEnd will be called on mouseup/touchend
  };

  const handleInputChange = (event) => {
    handleUserInteractionStart();
    const rawValue = event.target.value;
    let newValueToNotify = min; // Default to min if input is invalid/empty

    if (rawValue === '') {
      // If user clears input, decide what to set. Often, this means min or 0 if in range.
      // Let's use min as a safe default.
      setAnimatedDisplayValue(min);
      onChange(min);
    } else {
      const numericValue = parseFloat(rawValue);
      if (!isNaN(numericValue)) {
        const clampedNumericValue = clampValue(numericValue, min, max);
        setAnimatedDisplayValue(clampedNumericValue);
        newValueToNotify = clampedNumericValue;
        onChange(newValueToNotify); // Notify parent
      }
      // If not a number, animatedDisplayValue remains, parent not notified of invalid char
    }
    handleUserInteractionEnd(); // For number input, interaction ends on change
  };
  
  // Use animatedDisplayValue for rendering
  const displayForInputs = animatedDisplayValue;

  return (
    <div className={`${className}`}>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 select-none'>
        {label}
      </label>
      <div className='flex items-center space-x-3 mt-1'>
        <input
          ref={sliderRef}
          type='range'
          min={min}
          max={max}
          step={step}
          value={displayForInputs} // Use animated value
          onChange={handleRangeChange}
          onMouseDown={handleUserInteractionStart} // Or onTouchStart
          onMouseUp={handleUserInteractionEnd}     // Or onTouchEnd
          disabled={disabled}
          className='custom-slider flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none'
        />
        <input
          ref={numberInputRef}
          type='number'
          min={min}
          max={max}
          step={step}
          value={displayForInputs} // Use animated value
          onChange={handleInputChange}
          onFocus={handleUserInteractionStart} // Consider interaction start on focus
          onBlur={handleUserInteractionEnd}   // And end on blur
          disabled={disabled}
          className='w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-70'
          onWheel={(e) => e.target.blur()} // Keep this for UX
        />
      </div>
    </div>
  );
}

SliderInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default React.memo(SliderInput);
