/**
 * Generates a dynamic placeholder for the popup input based on context
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {string|null} params.contentTypeLabel - Label for the content type
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @param {boolean} params.includeContext - Whether context should be included
 * @returns {string} The generated placeholder text
 */
export function getPopupPlaceholder({
  platformName,
  contentTypeLabel,
  isContentLoading,
  includeContext,
}) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName) {
    if (includeContext) {
      if (contentTypeLabel) {
        return `Ask ${platformName} about this ${contentTypeLabel}...`;
      }
      return `Ask ${platformName} about this content...`;
    }
    return `Ask ${platformName} anything...`;
  }

  return 'Ask anything...'; // Fallback if no platformName
}

/**
 * Generates the initial placeholder for the sidepanel input
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {string|null} params.contentTypeLabel - Label for the content type
 * @param {boolean} params.isPageInjectable - Whether the page supports injection
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @param {boolean} params.includeContext - Whether context should be included
 * @returns {string} The generated placeholder text
 */
export function getSidepanelInitialPlaceholder({
  platformName,
  contentTypeLabel,
  isPageInjectable,
  isContentLoading,
  includeContext,
}) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName) {
    if (includeContext && isPageInjectable) {
      if (contentTypeLabel) {
        return `Ask ${platformName} about this ${contentTypeLabel}...`;
      }
      return `Ask ${platformName} about this page...`;
    }
    return `Ask ${platformName} anything...`;
  }

  return 'Ask anything...'; // Fallback if no platformName
}

/**
 * Generates a follow-up placeholder for the sidepanel input
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @returns {string} The generated placeholder text
 */
export function getSidepanelFollowUpPlaceholder({
  platformName,
  isContentLoading,
}) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName) {
    return `Reply to ${platformName}...`;
  }

  return 'Continue the conversation...';
}
