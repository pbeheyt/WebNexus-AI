// src/background/core/core-handlers.js - Generic message handlers

import { logger } from '../../shared/logger.js';

export function handleCheckStatus(_message, _sender, sendResponse) {
  sendResponse({ status: 'ok' });
  return false;
}

export function handleNotifyError(message, _sender, _sendResponse) {
  logger.background.error('Error from content script:', message.error);
  return false;
}

export function handleGetCurrentTabId(_message, sender, sendResponse) {
  if (sender.tab) {
    sendResponse({ tabId: sender.tab.id });
  } else {
    sendResponse({ tabId: null, error: 'Not in a tab context' });
  }
  return false;
}
