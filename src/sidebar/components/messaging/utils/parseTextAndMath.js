// src/sidebar/components/messaging/utils/parseTextAndMath.js

/**
 * Parses text and math expressions from a given string.
 * It identifies LaTeX-style math expressions and separates them from regular text.
 * Uses a stricter regex for inline math ($...$) to avoid misinterpreting currency or other text.
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
  // 1. \$\$[\s\S]*?\$\$  : Matches block math delimited by double dollar signs.
  // 2. \\\[[\s\S]*?\\]  : Matches block math delimited by \[ ... \].
  // 3. (?<![\w$])\$(?!\s)((?:[^$\\]|\\.)+?)(?<!\s)\$(?![\w$]) : Matches inline math $...$ with stricter rules:
  //    - (?<![\w$]) : Negative lookbehind - Not preceded by a word character or $.
  //    - \$(?!\s)   : Opening $ not followed by space.
  //    - ((?:[^$\\]|\\.)+?) : Captures content - any char except $ or \, or escaped chars. Non-greedy.
  //    - (?<!\s)\$ : Closing $ not preceded by space.
  //    - (?![\w$])  : Negative lookahead - Not followed by a word character or $.
  // 4. \\\(.+?\)     : Matches inline math delimited by \( ... \). (Kept as is, generally less ambiguous).
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\]|(?<![\w$])\$(?!\s)((?:[^$\\]|\\.)+?)(?<!\s)\$(?![\w$])|\\\(.+?\\\))/g;

  const result = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add preceding text if any
    if (match.index > lastIndex) {
      const textValue = text.slice(lastIndex, match.index);
      result.push({ type: 'text', value: textValue, inline: false });
    }

    const part = match[0];
    let mathContent = '';
    let inline = true;

    // Determine type and extract content based on delimiters
    if (part.startsWith('$$') && part.endsWith('$$')) {
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('\\[')) { // Block math \[ ... \]
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('$') && part.endsWith('$')) { // Inline math $ ... $
      // Use the captured group from the stricter regex (match[1])
      mathContent = match[1]; // Content is in the first capture group
      inline = true;
    } else if (part.startsWith('\\(')) { // Inline math \( ... \)
      mathContent = part.slice(2, -2);
      inline = true;
    } else {
       // This case should ideally not be reached with the global regex, but as a fallback:
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