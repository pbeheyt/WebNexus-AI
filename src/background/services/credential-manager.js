// src/background/services/credential-manager.js - Credential management

import CredentialManagerService from '../../services/CredentialManager.js';
import { logger } from '../../shared/logger.js';

/**
 * Handle credential operation request
 * @param {Object} message - Message with operation details
 * @param {Function} sendResponse - Response function
 */
export async function handleCredentialOperation(message, _sender, sendResponse) {
  try {
    const { operation, platformId, credentials } = message;

    switch (operation) {
      case 'get': {
        const storedCredentials =
          await CredentialManagerService.getCredentials(platformId);
        sendResponse({
          success: true,
          credentials: storedCredentials,
        });
        break;
      }
      case 'store': {
        const storeResult = await CredentialManagerService.storeCredentials(
          platformId,
          credentials
        );
        sendResponse({
          success: storeResult,
        });
        break;
      }
      case 'remove': {
        const removeResult =
          await CredentialManagerService.removeCredentials(platformId);
        sendResponse({
          success: removeResult,
        });
        break;
      }
      case 'validate': {
        const validationResult =
          await CredentialManagerService.validateCredentials(
            platformId,
            credentials
          );
        sendResponse({
          success: true,
          validationResult,
        });
        break;
      }
      case 'checkMultiple': {
        const { platformIds } = message;
        if (!Array.isArray(platformIds)) {
          throw new Error('platformIds must be an array');
        }
        const results =
          await CredentialManagerService.checkCredentialsExist(platformIds);
        sendResponse({
          success: true,
          results,
        });
        break;
      }
      default:
        throw new Error(`Unknown credential operation: ${operation}`);
    }
  } catch (error) {
    logger.background.error('Error in credential operation:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}
