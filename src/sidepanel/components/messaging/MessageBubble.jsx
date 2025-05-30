// src/sidepanel/components/messaging/MessageBubble.jsx
import React, { memo, forwardRef } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../shared/logger';
import { MESSAGE_ROLES } from '../../../shared/constants';

// Import role-specific components
import { SystemMessageBubble } from './SystemMessageBubble';
import { UserMessageBubble } from './UserMessageBubble';
import { AssistantMessageBubble } from './AssistantMessageBubble';

// Define the core functional component using forwardRef
const MessageBubbleComponent = forwardRef(
  (
    {
      role = 'assistant', // Default role kept for safety
      ...props // Collect all other props
    },
    ref
  ) => {
    // Delegate rendering based on role
    switch (role) {
      case MESSAGE_ROLES.SYSTEM:
        return <SystemMessageBubble ref={ref} role={role} {...props} />;
      case MESSAGE_ROLES.USER:
        return <UserMessageBubble ref={ref} role={role} {...props} />;
      case MESSAGE_ROLES.ASSISTANT:
        return <AssistantMessageBubble ref={ref} role={role} {...props} />;
      default:
        logger.sidepanel.error(`Unknown message role: ${role}`);
        return null;
    }
  }
);

MessageBubbleComponent.propTypes = {
  role: PropTypes.oneOf(Object.values(MESSAGE_ROLES)).isRequired,
  id: PropTypes.string,
  modelDisplayName: PropTypes.string,
  apiCost: PropTypes.number, // Add this line
};

MessageBubbleComponent.displayName = 'MessageBubble';

// Export the memoized version
export const MessageBubble = memo(MessageBubbleComponent);
