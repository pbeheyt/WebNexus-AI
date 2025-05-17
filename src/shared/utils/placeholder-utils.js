/**
 * Generates a dynamic placeholder for the popup input based on context
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {string|null} params.contentTypeLabel - Label for the content type
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @returns {string} The generated placeholder text
 */
export function getPopupPlaceholder({ platformName, contentTypeLabel, isContentLoading }) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName && contentTypeLabel) {
    return `Ask ${platformName} about this ${contentTypeLabel}...`;
  }

  if (platformName) {
    return `Ask ${platformName} about this content...`;
  }

  return 'Enter your prompt...';
}

/**
 * Generates the initial placeholder for the sidepanel input
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {string|null} params.contentTypeLabel - Label for the content type
 * @param {boolean} params.isPageInjectable - Whether the page supports injection
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @returns {string} The generated placeholder text
 */
export function getSidepanelInitialPlaceholder({
  platformName,
  contentTypeLabel,
  isPageInjectable,
  isContentLoading
}) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName && contentTypeLabel && isPageInjectable) {
    return `Ask ${platformName} about this ${contentTypeLabel}...`;
  }

  if (platformName && isPageInjectable) {
    return `Ask ${platformName} about this page...`;
  }

  if (platformName) {
    return `Chat with ${platformName}...`;
  }

  return 'Enter your prompt...';
}

/**
 * Generates a follow-up placeholder for the sidepanel input
 * @param {Object} params
 * @param {string|null} params.platformName - Name of the selected platform
 * @param {boolean} params.isContentLoading - Whether content is still loading
 * @returns {string} The generated placeholder text
 */
export function getSidepanelFollowUpPlaceholder({ platformName, isContentLoading }) {
  if (isContentLoading) {
    return 'Loading content...';
  }

  if (platformName) {
    return `Reply to ${platformName}...`;
  }

  return 'Continue the conversation...';
}
