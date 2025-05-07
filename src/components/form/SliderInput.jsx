import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

const ANIMATION_DURATION_MS = 150; // Duration for the value animation

/**
 * A reusable component combining a range slider and a number input
 * with improved UX. The slider thumb animates based on percentage changes,
 * and the number input snaps to the final value after prop-driven animations.
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
  const isUserInteracting = useRef(false);

  const clampValue = useCallback((val, currentMin, currentMax) => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal)) return currentMin;
    return Math.max(currentMin, Math.min(currentMax, numericVal));
  }, []);

  const calculatePercentage = useCallback((val, currentMin, currentMax) => {
    const range = currentMax - currentMin;
    if (range === 0) return 0; // Avoid division by zero
    const clampedVal = clampValue(val, currentMin, currentMax);
    return (clampedVal - currentMin) / range;
  }, [clampValue]);

  const calculateValueFromPercentage = useCallback((percentage, currentMin, currentMax) => {
    const range = currentMax - currentMin;
    // Apply step precision to the calculated value
    const rawValue = currentMin + percentage * range;
    const numSteps = Math.round((rawValue - currentMin) / step);
    return clampValue(currentMin + numSteps * step, currentMin, currentMax);
  }, [clampValue, step]);


  const [animatedPercentage, setAnimatedPercentage] = useState(() =>
    calculatePercentage(value ?? min ?? 0, min, max)
  );
  const [displayedNumericValue, setDisplayedNumericValue] = useState(() =>
    clampValue(value ?? min ?? 0, min, max)
  );

  // Effect to animate the slider when external props (value, min, max) change
  useEffect(() => {
    if (isUserInteracting.current) {
      return;
    }

    const targetValue = clampValue(value, min, max);
    const targetPercentage = calculatePercentage(targetValue, min, max);

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    // Use functional update for setAnimatedPercentage to get its latest value
    setAnimatedPercentage(currentAnimatedPct => {
      if (Math.abs(targetPercentage - currentAnimatedPct) < 0.001) { // No significant percentage change
        setAnimatedPercentage(targetPercentage); // Ensure it's exact
        setDisplayedNumericValue(targetValue); // Snap numeric input
        return targetPercentage; // Return the already correct percentage
      }

      // If there's a significant percentage change, animate
      let startTime = null;
      const startPercentage = currentAnimatedPct;
      const percentageChange = targetPercentage - startPercentage;

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / ANIMATION_DURATION_MS, 1);
        const currentAnimatedPercentageForFrame = startPercentage + percentageChange * progress;
        
        setAnimatedPercentage(clampValue(currentAnimatedPercentageForFrame, 0, 1));

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setAnimatedPercentage(targetPercentage); // Ensure it ends exactly at target percentage
          setDisplayedNumericValue(targetValue);   // Snap numeric input to final target value
          animationFrameId.current = null;
        }
      };
      animationFrameId.current = requestAnimationFrame(animate);
      return currentAnimatedPct; // Return current value; animation will update it
    });


    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [value, min, max, clampValue, calculatePercentage]);


  // Effect to update the CSS variable for track fill based on animatedPercentage
  useEffect(() => {
    if (sliderRef.current) {
      // Use animatedPercentage directly as it's already 0-1
      const fillPercentage = animatedPercentage * 100;
      sliderRef.current.style.setProperty('--slider-fill-percentage', `${fillPercentage}%`);
    }
  }, [animatedPercentage]);


  const handleUserInteractionStart = () => {
    isUserInteracting.current = true;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };
  
  const handleUserInteractionEnd = () => {
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 50);
  };

  const handleRangeChange = (event) => {
    handleUserInteractionStart();
    const newValue = parseFloat(event.target.value); // Range input's value is already stepped
    if (!isNaN(newValue)) {
      const clampedNewValue = clampValue(newValue, min, max);
      const newPercentage = calculatePercentage(clampedNewValue, min, max);
      setAnimatedPercentage(newPercentage);
      setDisplayedNumericValue(clampedNewValue);
      onChange(clampedNewValue);
    }
    // handleUserInteractionEnd will be called on mouseup/touchend
  };

  const handleInputChange = (event) => {
    handleUserInteractionStart();
    const rawValue = event.target.value;
    let clampedNewValue = min; // Default if input is invalid/empty

    if (rawValue === '') {
      clampedNewValue = min;
    } else {
      const numericValue = parseFloat(rawValue);
      if (!isNaN(numericValue)) {
        clampedNewValue = clampValue(numericValue, min, max);
      } else {
        // If not a number, revert to current displayedNumericValue or min
        // For now, let's stick to min if invalid. Or keep previous valid.
        clampedNewValue = displayedNumericValue; // Or min
      }
    }
    
    const newPercentage = calculatePercentage(clampedNewValue, min, max);
    setAnimatedPercentage(newPercentage);
    setDisplayedNumericValue(clampedNewValue);
    onChange(clampedNewValue); // Notify parent
    handleUserInteractionEnd();
  };
  
  // The value for the range slider input is derived from the animatedPercentage
  const sliderInputValue = calculateValueFromPercentage(animatedPercentage, min, max);

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
          value={sliderInputValue} // Use value derived from animatedPercentage
          onChange={handleRangeChange}
          onMouseDown={handleUserInteractionStart}
          onMouseUp={handleUserInteractionEnd}
          onTouchStart={handleUserInteractionStart}
          onTouchEnd={handleUserInteractionEnd}
          disabled={disabled}
          className='custom-slider flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none'
        />
        <input
          ref={numberInputRef}
          type='number'
          min={min}
          max={max}
          step={step}
          value={displayedNumericValue} // Use the snapped numeric value
          onChange={handleInputChange}
          onFocus={handleUserInteractionStart}
          onBlur={handleUserInteractionEnd}
          disabled={disabled}
          className='w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-70'
          onWheel={(e) => e.target.blur()}
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