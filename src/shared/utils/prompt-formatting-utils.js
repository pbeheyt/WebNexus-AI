// src/shared/utils/prompt-formatting-utils.js

/**
 * Creates a structured prompt string by combining a main prompt with formatted page content.
 * If formattedContent is provided and non-empty, it's appended under an "# EXTRACTED CONTENT" heading.
 * Otherwise, only the main prompt is returned.
 *
 * @param {string} prompt - The main user prompt or instruction.
 * @param {string | null | undefined} formattedContent - The extracted page content, if any.
 * @returns {string} The structured prompt string.
 */
export function createStructuredPromptString(prompt, formattedContent) {
  if (
    typeof formattedContent === 'string' &&
    formattedContent.trim().length > 0
  ) {
    return `# INSTRUCTION\n${prompt}\n# EXTRACTED CONTENT\n${formattedContent}`;
  } else {
    return prompt;
  }
}
