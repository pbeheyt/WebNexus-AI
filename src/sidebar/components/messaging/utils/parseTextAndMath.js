/**
 * Parses text and math expressions from a given string.
 * It identifies LaTeX-style math expressions and separates them from regular text.
 * @param {string} text - The input string containing text and math expressions.
 * @returns {Array} - An array of objects representing the parsed content.
 * Each object has a 'type' property ('text' or 'math') and a 'value' property containing the content.
 * The 'inline' property indicates whether the math expression is inline or block.
 */
export const parseTextAndMath = (text) => {
  if (!text) {
      return [];
  }
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\]|\$.+?\$|\\\(.+?\\\))/g;
  const result = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textValue = text.slice(lastIndex, match.index);
      result.push({ type: 'text', value: textValue, inline: false });
    }
    const part = match[0];
    let mathContent = '';
    let inline = true;
    if (part.startsWith('$$') && part.endsWith('$$')) {
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('\\[')) {
      mathContent = part.slice(2, -2);
      inline = false;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      mathContent = part.slice(1, -1);
      inline = true;
    } else if (part.startsWith('\\(')) {
      mathContent = part.slice(2, -2);
      inline = true;
    } else {
       result.push({ type: 'text', value: part, inline: false });
       lastIndex = regex.lastIndex;
       continue;
    }
    const trimmedMathContent = mathContent.trim();
    if (trimmedMathContent) {
       result.push({ type: 'math', value: trimmedMathContent, inline });
    } else {
       result.push({ type: 'text', value: part, inline: false });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    result.push({ type: 'text', value: remainingText, inline: false });
  }
  return result;
};