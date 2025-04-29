// src/sidebar/components/messaging/utils/parseTextAndMath.js

/**
 * Parses text and math expressions from a given string.
 * It identifies LaTeX-style math expressions and separates them from regular text.
 * Uses dedicated capture groups for content extraction for clarity and robustness.
 * Applies stricter rules for inline $...$ matching to avoid currency, template literals like ${var}.
 * @param {string} text - The input string containing text and math expressions.
 * @returns {Array} - An array of objects representing the parsed content.
 * Each object has a 'type' property ('text' or 'math') and a 'value' property containing the content.
 * The 'inline' property indicates whether the math expression is inline or block.
 */
export const parseTextAndMath = (text) => {
  if (!text) {
      return [];
  }

  // Regex:
  // Group 1: Content of $$...$$
  // Group 2: Content of \[...\]
  // Group 3: Content of $...$ (Stricter: no digit before, no space/{ inside, no newline/}/space before closing $)
  // Group 4: Content of \(...\)
  const regex = /(\$\$([\s\S]*?)\$\$)|(\\\[([\s\S]*?)\\])|((?<![\d$])\$(?![\s{])((?:[^$\r\n\\}]|\\.)+?)(?<![\s}])\$(?![\w$]))|(\\\((.+?)\\\))/g;
  // Changes in $...$ part:
  // (?<![\d$]): Not preceded by digit or $ (prevents $5, $$)
  // (?![\s{]): Opening $ not followed by space or { (prevents $ {var}, $ E=mc^2 $)
  // ((?:[^$\r\n\\}]|\\.)+?): Content: No $, newline, \, or } (prevents multiline, ${var}) Allows escaped chars. Non-greedy.
  // (?<![\s}]): Closing $ not preceded by space or } (prevents ${var} $, $ E=mc^2 $)
  // (?![\w$]): Not followed by word char or $ (prevents $5$, $variable$)

  const result = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add preceding text if any
    if (match.index > lastIndex) {
      const textValue = text.slice(lastIndex, match.index);
      result.push({ type: 'text', value: textValue, inline: false });
    }

    const part = match[0]; // The full matched string
    let mathContent = '';
    let inline = true;

    // Check the full match group first (odd indices), then extract content (even indices)
    if (match[1] !== undefined) { // $$...$$ matched (full match group 1)
        mathContent = match[2]; // Content group 2
        inline = false;
    } else if (match[3] !== undefined) { // \[...\] matched (full match group 3)
        mathContent = match[4]; // Content group 4
        inline = false;
    } else if (match[5] !== undefined) { // $...$ matched (full match group 5)
        mathContent = match[6]; // Content group 6
        inline = true;
    } else if (match[7] !== undefined) { // \(...\) matched (full match group 7)
        mathContent = match[8]; // Content group 8
        inline = true;
    } else {
       // Fallback: Should not happen if regex is correct
       result.push({ type: 'text', value: part, inline: false });
       lastIndex = regex.lastIndex;
       continue;
    }

    // Add the math part if content is not empty after trimming
    const trimmedMathContent = mathContent.trim();
    if (trimmedMathContent) {
       result.push({ type: 'math', value: trimmedMathContent, inline });
    } else {
       // If math content is empty after trimming, treat the original part as text
       result.push({ type: 'text', value: part, inline: false });
    }

    lastIndex = regex.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    result.push({ type: 'text', value: remainingText, inline: false });
  }

  return result;
};