// src/sidebar/components/messaging/MessageBubble.jsx
import React, { memo, forwardRef } from 'react';
import logger from '../../../shared/logger';
import { MESSAGE_ROLES } from '../../../shared/constants';

// Import role-specific components
import { SystemMessageBubble } from './SystemMessageBubble';
import { UserMessageBubble } from './UserMessageBubble';
import { AssistantMessageBubble } from './AssistantMessageBubble';

/**
 * Message bubble component wrapped with forwardRef
 * This component now acts as a delegator based on the message role.
 */
export const MessageBubble = memo(forwardRef(({
    role = 'assistant', // Default role kept for safety, though should always be provided
    ...props // Collect all other props (id, content, isStreaming, model, etc.)
}, ref) => {

    // Delegate rendering to the appropriate component based on the role
    switch (role) {
        case MESSAGE_ROLES.SYSTEM:
            // Pass the ref and all props down
            return <SystemMessageBubble ref={ref} role={role} {...props} />;
        case MESSAGE_ROLES.USER:
            // Pass the ref and all props down
            return <UserMessageBubble ref={ref} role={role} {...props} />;
        case MESSAGE_ROLES.ASSISTANT:
            // Pass the ref and all props down
            return <AssistantMessageBubble ref={ref} role={role} {...props} />;
        default:
        // Log an error for unknown roles, consistent with original request
        logger.sidebar.error(`Unknown message role: ${role}`);
        return null; // Return null for unknown roles
    }
})); // Close forwardRef
