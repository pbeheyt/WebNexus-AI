// src/shared/utils/shortcut-utils.js
export function formatShortcutToStringDisplay(shortcutObj) {
  if (!shortcutObj || !shortcutObj.key) return '';
  const parts = [];
  if (shortcutObj.metaKey) parts.push('Cmd');
  if (shortcutObj.ctrlKey) parts.push('Ctrl');
  if (shortcutObj.altKey) parts.push('Alt');
  if (shortcutObj.shiftKey) parts.push('Shift');

  let displayKey = shortcutObj.key.toLowerCase();
  if (displayKey === ' ') displayKey = 'Space';
  else if (displayKey.startsWith('arrow'))
    displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
  else displayKey = displayKey.toUpperCase();

  parts.push(displayKey);
  return parts.join(' + ');
}
