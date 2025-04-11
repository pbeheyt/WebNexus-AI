// src/components/messaging/services/ContentTypeDetector.js

import {
  isMathematicalFunction,
  hasLatexEnvironments,
  hasLatexCommands,
  hasLatexDelimiters,
  isBinomialCoefficient,
  hasHighConfidenceMathIndicators
} from '../utils/mathDetection';
import {
  hasHighConfidenceCodeIndicators,
  looksLikeSimpleCodeBlock
} from '../utils/codeDetection';
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
  
  // STAGE 3: CONTEXT-DRIVEN CLASSIFICATION (NEW)
  // ------------------------------------------
  const classifyAsMath = contentContext.shouldClassifyAsMath(content, hasStrongMathIndicators);
  let resultType;

  if (classifyAsMath) {
    // Context suggests Math. Check for strong Code overrides.
    if (hasHighConfidenceCodeIndicators(content)) {
      resultType = isInline ? ContentType.CODE_INLINE : ContentType.CODE_BLOCK;
    } else {
      // Default to Math based on context
      resultType = (isInline || content.length < 40) ? // Adjusted length threshold slightly
                     ContentType.MATH_INLINE : ContentType.MATH_BLOCK;
    }
  } else {
    // Context suggests Code/Text. Check for strong Math overrides.
    if (hasHighConfidenceMathIndicators(content)) {
      resultType = (isInline || content.length < 40) ?
                     ContentType.MATH_INLINE : ContentType.MATH_BLOCK;
    } else {
      // Default to Code/Text based on context
      if (isInline) {
        resultType = ContentType.CODE_INLINE;
      } else {
        // For blocks, check basic code structure
        if (looksLikeSimpleCodeBlock(content)) {
          resultType = ContentType.CODE_BLOCK;
        } else {
          resultType = ContentType.TEXT; // Fallback for non-structured blocks
        }
      }
    }
  }
  
  // Record and return the classification from this stage
  contentContext.recordClassification(resultType, content);
  return resultType;
}
