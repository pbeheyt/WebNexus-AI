// src/shared/utils/number-format-utils.js

/**
 * Formats a number into a human-readable string with metric suffixes (K, M, B).
 * Handles null, undefined, and NaN by returning '0'.
 * Numbers less than 1000 are returned with toLocaleString().
 *
 * @param {number | null | undefined} number - The number to format.
 * @param {object} [options={ precision: 1 }] - Formatting options.
 * @param {number} [options.precision=1] - Number of decimal places for K, M, B suffixes.
 * @returns {string} The formatted string representation of the number.
 */
export function formatTokenCount(number, options = { precision: 1 }) {
  if (number === null || number === undefined || isNaN(Number(number))) {
    return '0';
  }

  const num = Number(number);
  const precision = Math.max(0, Math.floor(options.precision)); // Ensure precision is a non-negative integer

  if (Math.abs(num) < 1000) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  const suffixes = ['', 'K', 'M', 'B', 'T']; // Add 'T' for Trillions if needed
  const i = Math.floor(Math.log(Math.abs(num)) / Math.log(1000));

  if (i >= suffixes.length) {
    // Handle numbers larger than supported suffixes (e.g., Quadrillions)
    // Fallback to scientific notation or just a large number string
    return num.toExponential(precision);
  }

  const formattedNum = (num / Math.pow(1000, i)).toFixed(precision);

  // Remove trailing '.0' if precision is 1 and it results in .0
  if (precision === 1 && formattedNum.endsWith('.0')) {
    return `${Math.floor(num / Math.pow(1000, i))}${suffixes[i]}`;
  }

  return `${formattedNum}${suffixes[i]}`;
}
