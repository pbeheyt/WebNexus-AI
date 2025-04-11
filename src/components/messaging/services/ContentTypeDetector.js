// src/components/messaging/services/ContentTypeDetector.js
import { 
  isMathFormula, 
  isMathVariable, 
  isMathematicalFunction,
  hasLatexEnvironments, 
  hasLatexCommands, 
  hasLatexDelimiters,
  isBinomialCoefficient
} from '../utils/mathDetection';
import { looksLikeCode } from '../utils/codeDetection';
import { contentContext } from './ContentContextManager';

/**
 * Content type classification taxonomy for rendering decisions
 */
export const ContentType = {
  MATH_INLINE: 'MATH_INLINE',
  MATH_BLOCK: 'MATH_BLOCK',
  CODE_BLOCK: 'CODE_BLOCK',
  CODE_INLINE: 'CODE_INLINE',
  TEXT: 'TEXT'
};

/**
 * Determines the appropriate content classification using a multi-stage
 * decision pipeline with contextual state transitions.
 *
 * @param {string} content - Raw content to classify
 * @param {boolean} isInline - Whether content is inline or block
 * @param {string|null} explicitLanguage - Explicit language identifier if provided
 * @returns {string} - ContentType classification decision
 */
export function detectContentType(content, isInline, explicitLanguage = null) {
  // Normalize content
  content = content.trim();
  
  // Check for context break events that reset state
  contentContext.detectContextBreak(content, explicitLanguage);
  
  // Detect strong mathematical indicators that override context
  const hasStrongMathIndicators = contentContext.hasStrongMathematicalIndicators(content);
  
  // Track explicit code block encounters for transition threshold adjustment
  if (!isInline && explicitLanguage && 
      explicitLanguage !== 'text' && explicitLanguage !== 'math') {
    contentContext.recordCodeBlockEncounter(explicitLanguage);
  }
  
  // STAGE 1: HIGH-CONFIDENCE CLASSIFIERS
  // -----------------------------------
  
  // High-confidence mathematical functions and notations
  if (isMathematicalFunction(content) || isBinomialCoefficient(content)) {
    const resultType = isInline || content.length < 30 ? 
                      ContentType.MATH_INLINE : ContentType.MATH_BLOCK;
    contentContext.recordClassification(resultType, content);
    return resultType;
  }
  
  // Explicit language code blocks
  if (!isInline && explicitLanguage) {
    const codingLanguages = [
      'python', 'javascript', 'java', 'cpp', 'c', 'csharp', 'ruby', 'go', 
      'rust', 'swift', 'kotlin', 'typescript', 'php', 'scala', 'html', 
      'css', 'sql', 'bash', 'shell', 'json', 'yaml', 'xml'
    ];
    
    if (codingLanguages.includes(explicitLanguage.toLowerCase())) {
      const resultType = ContentType.CODE_BLOCK;
      contentContext.recordClassification(resultType, content);
      return resultType;
    }
    
    // Special case: text language but contains math
    if (explicitLanguage.toLowerCase() === 'text' && 
        (isMathFormula(content) || hasLatexCommands(content) || 
         hasLatexDelimiters(content))) {
      const resultType = ContentType.MATH_BLOCK;
      contentContext.recordClassification(resultType, content);
      return resultType;
    }
  }
  
  // STAGE 2: STRUCTURAL MATH MARKERS
  // -------------------------------
  if (hasLatexEnvironments(content) || hasLatexCommands(content) || 
      hasLatexDelimiters(content)) {
    const resultType = isInline || content.length < 30 ? 
                      ContentType.MATH_INLINE : ContentType.MATH_BLOCK;
    contentContext.recordClassification(resultType, content);
    return resultType;
  }
  
  // STAGE 3: MATH VARIABLES AND FORMULAS
  // -----------------------------------
  if ((isInline && isMathVariable(content)) || isMathFormula(content)) {
    const resultType = isInline || content.length < 30 ? 
                      ContentType.MATH_INLINE : ContentType.MATH_BLOCK;
    contentContext.recordClassification(resultType, content);
    return resultType;
  }
  
  // STAGE 4: AMBIGUOUS CASES
  // -----------------------
  // Check for function-like patterns that could be either math or code
  if (!isInline && /^[a-zA-Z]+\s*\([a-zA-Z0-9\s,]+\)/.test(content)) {
    // Use enhanced asymmetric transition logic
    if (contentContext.shouldClassifyAsMath(content, hasStrongMathIndicators)) {
      const resultType = ContentType.MATH_BLOCK;
      contentContext.recordClassification(resultType, content);
      return resultType;
    }
  }
  
  // STAGE 5: CODE DETECTION
  // ---------------------
  if (!isInline && looksLikeCode(content)) {
    const resultType = ContentType.CODE_BLOCK;
    contentContext.recordClassification(resultType, content);
    return resultType;
  }
  
  // STAGE 6: SPECIAL CASES
  // ---------------------
  // File/module references
  const isFilenameOrModule = !isInline && content.indexOf('\n') === -1 &&
                           content.indexOf(' ') === -1 &&
                           (/\.\w{1,4}$/.test(content) ||
                            /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(content));
  
  if (isFilenameOrModule) {
    const resultType = ContentType.CODE_INLINE;
    contentContext.recordClassification(resultType, content);
    return resultType;
  }
  
  // STAGE 7: DEFAULT CLASSIFICATION
  // -----------------------------
  const defaultType = isInline ? ContentType.CODE_INLINE : ContentType.TEXT;
  contentContext.recordClassification(defaultType, content);
  return defaultType;
}