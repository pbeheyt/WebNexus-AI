// src/hooks/useMinimumLoadingTime.js
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to ensure a loading state is shown for a minimum duration.
 * @param {boolean} isActuallyLoading - The actual loading state from the operation.
 * @param {number} minimumDuration - The minimum time (in ms) the loading state should be visible.
 * @returns {boolean} - Whether the loading UI should be shown.
 */
export function useMinimumLoadingTime(isActuallyLoading, minimumDuration = 500) {
  const [shouldShowLoading, setShouldShowLoading] = useState(false);
  const loadingStartTimeRef = useRef(null);

  useEffect(() => {
    if (isActuallyLoading) {
      setShouldShowLoading(true);
      loadingStartTimeRef.current = Date.now();
    } else {
      // If it was loading and now it's not
      if (loadingStartTimeRef.current !== null) {
        const timeElapsed = Date.now() - loadingStartTimeRef.current;
        if (timeElapsed < minimumDuration) {
          // Not enough time has passed, wait for the remainder
          const timeLeft = minimumDuration - timeElapsed;
          const timerId = setTimeout(() => {
            setShouldShowLoading(false);
            loadingStartTimeRef.current = null;
          }, timeLeft);
          return () => clearTimeout(timerId); // Cleanup timer
        }
      }
      // If enough time has passed or it was never loading
      setShouldShowLoading(false);
      loadingStartTimeRef.current = null;
    }
  }, [isActuallyLoading, minimumDuration]);

  return shouldShowLoading;
}

export default useMinimumLoadingTime;
