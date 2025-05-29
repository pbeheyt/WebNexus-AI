import React, { lazy, Suspense } from 'react';

const LazyMathFormulaBlock = lazy(() => import('../MathFormulaBlock'));
import { logger } from '../../../../shared/logger';

// Placeholder Regex - matches @@MATH_(BLOCK|INLINE)_(\d+)@@
export const MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_(\d+)@@/g;
// Regex for checking if *any* placeholder exists (used for optimization)
export const HAS_MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_\d+@@/;

/**
 * Utility function to check if processed children contain a block-level element (div).
 * @param {React.ReactNode|React.ReactNodeArray} processedChildren - Children processed by renderWithPlaceholdersRecursive.
 * @returns {boolean} - True if a direct child is a div element.
 */
export const containsBlockElementCheck = (processedChildren) => {
  return React.Children.toArray(processedChildren).some(
    (child) => React.isValidElement(child) && child.type === 'div'
  );
};

/**
 * RECURSIVE function to process children, find placeholders, and replace them with MathFormulaBlock
 */
export const renderWithPlaceholdersRecursive = (children, mathMap) => {
  // Check if math placeholders are even present in the parent string/element for optimization
  const hasMathPlaceholders =
    typeof children === 'string'
      ? HAS_MATH_PLACEHOLDER_REGEX.test(children)
      : React.Children.toArray(children).some(
          (c) => typeof c === 'string' && HAS_MATH_PLACEHOLDER_REGEX.test(c)
        );

  // If no placeholders in this branch, return children as is
  if (!hasMathPlaceholders) return children;

  return React.Children.toArray(children).flatMap((child, index) => {
    // 1. Process String Children
    if (typeof child === 'string') {
      if (!HAS_MATH_PLACEHOLDER_REGEX.test(child)) return [child]; // Optimization: Skip regex if no placeholders

      const parts = [];
      let lastIndex = 0;
      let match;
      MATH_PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state

      while ((match = MATH_PLACEHOLDER_REGEX.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const placeholder = match[0];
        const mathType = match[1];
        const mathData = mathMap.get(placeholder);
        if (mathData) {
          parts.push(
            <Suspense
              key={`${placeholder}-${index}-${lastIndex}-suspense`}
              fallback={
                <span className='text-xs italic text-theme-secondary'>
                  Loading math...
                </span>
              }
            >
              <LazyMathFormulaBlock
                content={mathData.content}
                inline={mathData.inline}
              />
            </Suspense>
          );
        } else {
          // Use logger imported at the top
          logger.sidepanel.warn(
            `Math placeholder ${placeholder} not found in map. Rendering fallback marker.`
          );
          const fallbackText =
            mathType === 'INLINE' ? '[ math ]' : '[ block math ]';
          parts.push(fallbackText);
        }
        lastIndex = MATH_PLACEHOLDER_REGEX.lastIndex;
      }
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      // Ensure we return something, even if parts is empty (e.g., child was only placeholders)
      return parts.length > 0 ? parts : [child];
    }

    // 2. Process React Element Children (Recursively)
    if (React.isValidElement(child) && child.props.children) {
      // Process grandchildren only if the element itself might contain placeholders (recursively)
      const processedGrandchildren = renderWithPlaceholdersRecursive(
        child.props.children,
        mathMap
      );
      const key = child.key ?? `child-${index}`; // Use existing key or generate one
      // Clone element with potentially processed children
      return React.cloneElement(
        child,
        { ...child.props, key: key },
        processedGrandchildren
      );
    }

    // 3. Return other children (like numbers, null, etc.) as is
    return child;
  });
};
