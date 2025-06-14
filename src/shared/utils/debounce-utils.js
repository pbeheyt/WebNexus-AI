// src/shared/utils/debounce.js

export function debounce(func, wait) {
  let timeout;

  const debouncedFunction = function executedFunction(...args) {
    const later = () => {
      timeout = null; // Clear timeout ID *before* calling func
      func(...args); // Call original function using spread syntax
    };
    clearTimeout(timeout); // Clear the previous timeout
    timeout = setTimeout(later, wait); // Set a new timeout
  };

  // Cancel method
  debouncedFunction.cancel = () => {
    clearTimeout(timeout);
    timeout = null; // Ensure timeout ID is cleared
  };

  return debouncedFunction;
}
