// src/extractor/utils/text-utils.js

/**
 * Normalizes text by replacing sequences of two or more newline characters
 * with a single newline character and trims leading/trailing whitespace.
 * Handles null or undefined inputs gracefully by returning them as is.
 * If a non-string, non-null/undefined value is passed, it's converted to a string.
 * @param {string | null | undefined | any} text - The text to normalize.
 * @returns {string | null | undefined} The normalized text, original input if null/undefined, or normalized string version of input.
 */
export function normalizeText(text) {
  if (text === null || typeof text === 'undefined') {
    return text;
  }
  const stringifiedText = typeof text !== 'string' ? String(text) : text;

  // Replace sequences of (optional whitespace + newline + optional whitespace)
  // one or more times with a single newline. Then trim.
  return stringifiedText.replace(/(\s*\n\s*)+/g, '\n').trim();
}