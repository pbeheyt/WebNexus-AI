// src/platforms/implementations/grok-platform.js
import BasePlatform from '../platform-base.js';

/**
 * Grok AI platform implementation
 */
class GrokPlatform extends BasePlatform {
  constructor() {
    super('grok');
  }

  isCurrentPlatform() {
    return window.location.hostname === 'grok.com';
  }

  /**
   * Helper method to determine if an element is visible and interactive
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} True if the element is visible and interactive
   */
  isVisibleElement(element) {
    if (!element) return false;

    // Check for explicit hidden attributes or styles
    if (
      element.getAttribute('aria-hidden') === 'true' ||
      element.style.visibility === 'hidden' ||
      element.style.display === 'none'
    ) {
      this.logger.warn(
        `[${this.platformId}] Element hidden by attribute/style:`,
        element
      );
      return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
    ) {
      this.logger.warn(
        `[${this.platformId}] Element hidden by computed style: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}, pointerEvents=${style.pointerEvents}`,
        element
      );
      return false;
    }

    // Check if element has zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Allow zero height for textareas which might start small
      if (element.tagName !== 'TEXTAREA') {
        this.logger.warn(
          `[${this.platformId}] Element has zero dimensions: width=${rect.width}, height=${rect.height}`,
          element
        );
        return false;
      } else {
        this.logger.info(
          `[${this.platformId}] Textarea has zero height, allowing as potentially visible.`
        );
      }
    }

    // Check if element is practically off-screen (adjust threshold as needed)
    const threshold = 5; // Small pixel threshold
    if (
      rect.right < threshold ||
      rect.bottom < threshold ||
      rect.left > window.innerWidth - threshold ||
      rect.top > window.innerHeight - threshold
    ) {
      this.logger.warn(
        `[${this.platformId}] Element is positioned off-screen:`,
        rect,
        element
      );
      return false;
    }

    // Check if the element or its parent is hidden via overflow
    let parent = element.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (
        parentStyle.overflow === 'hidden' ||
        parentStyle.overflowX === 'hidden' ||
        parentStyle.overflowY === 'hidden'
      ) {
        const parentRect = parent.getBoundingClientRect();
        // Check if the element is outside the parent's visible bounds
        if (
          rect.top < parentRect.top ||
          rect.bottom > parentRect.bottom ||
          rect.left < parentRect.left ||
          rect.right > parentRect.right
        ) {
          this.logger.warn(
            `[${this.platformId}] Element hidden by parent overflow:`,
            element,
            parent
          );
          // return false; // Be cautious with this check, might be too strict
        }
      }
      if (parent === document.body) break;
      parent = parent.parentElement;
    }

    return true;
  }

  /**
   * Find the active Grok editor element using more robust strategies.
   * @returns {HTMLElement|null} The editor element or null if not found
   */
  findEditorElement() {
    this.logger.info(
      `[${this.platformId}] Attempting to find editor element...`
    );

    // --- Strategy 1: Query Bar Parent + Attributes ---
    try {
      const queryBar = document.querySelector('div.query-bar'); // Find the main input container
      if (queryBar) {
        // More specific check first
        const editor = queryBar.querySelector(
          'textarea[dir="auto"][style*="resize: none"]'
        );
        if (editor && this.isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 1a (Query Bar + Attributes)`
          );
          return editor;
        }
        // Simpler version within query bar if the style one fails
        const simplerEditor = queryBar.querySelector('textarea[dir="auto"]');
        if (simplerEditor && this.isVisibleElement(simplerEditor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 1b (Query Bar + dir=auto)`
          );
          return simplerEditor;
        }
      } else {
        this.logger.warn(
          `[${this.platformId}] Strategy 1: Query Bar container not found.`
        );
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 1 editor search:`,
        e
      );
    }

    // --- Strategy 2: Attributes Only ---
    try {
      const textareas = document.querySelectorAll(
        'textarea[dir="auto"][style*="resize: none"]'
      );
      for (const editor of textareas) {
        if (this.isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 2 (Attributes Only)`
          );
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 2 editor search:`,
        e
      );
    }

    // --- Strategy 3: Broader dir=auto ---
    try {
      const textareasDirAuto = document.querySelectorAll(
        'textarea[dir="auto"]'
      );
      for (const editor of textareasDirAuto) {
        if (this.isVisibleElement(editor)) {
          this.logger.info(
            `[${this.platformId}] Found editor using Strategy 3 (Broader dir=auto)`
          );
          return editor;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 3 editor search:`,
        e
      );
    }

    this.logger.error(
      `[${this.platformId}] Editor element not found using any strategy.`
    );
    return null;
  }

  /**
   * Find the Grok submit button using more robust strategies.
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton() {
    this.logger.info(
      `[${this.platformId}] Attempting to find submit button...`
    );

    // --- Strategy 1: Specific SVG Path ---
    try {
      // Look for the button containing the specific SVG path for the send arrow
      const svgPathSelector = 'button[type="submit"] svg path[d^="M5 11L12 4"]';
      const pathElement = document.querySelector(svgPathSelector);
      if (pathElement) {
        const button = pathElement.closest('button[type="submit"]');
        // Check visibility *and* ensure it's not disabled
        if (
          button &&
          this.isVisibleElement(button) &&
          !button.disabled &&
          button.getAttribute('aria-disabled') !== 'true'
        ) {
          this.logger.info(
            `[${this.platformId}] Found submit button using Strategy 1 (SVG Path)`
          );
          return button;
        } else if (button) {
          this.logger.warn(
            `[${this.platformId}] Strategy 1: Found button via SVG, but it's hidden or disabled.`,
            button
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 1 submit button search:`,
        e
      );
    }

    // --- Strategy 2: Structural Position ---
    // Look for the button within the absolute positioned bottom bar, in the ml-auto container
    try {
      const bottomBarSelector =
        'form div[class*="absolute inset-x-0 bottom-0"]'; // Anchor within the form
      const bottomBar = document.querySelector(bottomBarSelector);
      if (bottomBar) {
        // Look for the button within the right-aligned container
        const submitButton = bottomBar.querySelector(
          'div[class*="ml-auto"] button[type="submit"]'
        );
        // Check visibility *and* ensure it's not disabled
        if (
          submitButton &&
          this.isVisibleElement(submitButton) &&
          !submitButton.disabled &&
          submitButton.getAttribute('aria-disabled') !== 'true'
        ) {
          this.logger.info(
            `[${this.platformId}] Found submit button using Strategy 2 (Structural Position)`
          );
          return submitButton;
        } else if (submitButton) {
          this.logger.warn(
            `[${this.platformId}] Strategy 2: Found button via structure, but it's hidden or disabled.`,
            submitButton
          );
        }
      } else {
        this.logger.warn(
          `[${this.platformId}] Strategy 2: Bottom action bar not found.`
        );
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 2 submit button search:`,
        e
      );
    }

    // --- Strategy 3: Aria Label (Fallback) ---
    try {
      const ariaSelectors = [
        'button[type="submit"][aria-label*="Submit"]', // English
        'button[type="submit"][aria-label*="Soumettre"]', // French
        // Add other languages if necessary
      ];
      for (const selector of ariaSelectors) {
        const button = document.querySelector(selector);
        // Check visibility *and* ensure it's not disabled
        if (
          button &&
          this.isVisibleElement(button) &&
          !button.disabled &&
          button.getAttribute('aria-disabled') !== 'true'
        ) {
          this.logger.info(
            `[${this.platformId}] Found submit button using Strategy 3 (Aria Label: ${selector})`
          );
          return button;
        } else if (button) {
          this.logger.warn(
            `[${this.platformId}] Strategy 3: Found button via aria-label (${selector}), but it's hidden or disabled.`,
            button
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `[${this.platformId}] Error during Strategy 3 submit button search:`,
        e
      );
    }

    this.logger.error(
      `[${this.platformId}] Submit button not found using any strategy.`
    );
    return null;
  }

  /**
   * Checks if the Grok editor element is empty.
   * @param {HTMLElement} editorElement - The editor element to check.
   * @returns {boolean} True if the editor is empty, false otherwise.
   * @protected
   */
  _isEditorEmpty(editorElement) {
    return (editorElement.value || '').trim() === '';
  }

}

export default GrokPlatform;
