// src/sidepanel/components/messaging/MessageBubble.jsx
import React, { memo, forwardRef } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../shared/logger';
import { MESSAGE_ROLES } from '../../../shared/constants';

// Role-specific components
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
      case MESSAGE_ROLES.USER: {
        const { contextTypeUsed, pageContextUsed, ...userProps } = props;
        return (
          <UserMessageBubble
            ref={ref}
            role={role}
            contextTypeUsed={contextTypeUsed}
            pageContextUsed={pageContextUsed}
            {...userProps}
          />
        );
      }
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
  apiCost: PropTypes.number,
  contextTypeUsed: PropTypes.string,
  pageContextUsed: PropTypes.string,
};

MessageBubbleComponent.displayName = 'MessageBubble';

// Export the memoized version
export const MessageBubble = memo(MessageBubbleComponent);
