// src/shared/utils/debounce.js

export function debounce(func, wait) {
  let timeout;

  const debouncedFunction = function executedFunction(...args) {
    const context = this; // Capture context
    const later = () => {
      timeout = null; // Clear timeout ID *before* calling func
      func.apply(context, args); // Call original function
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
