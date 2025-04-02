// src/components/index.js
// Core components
export { Button } from './core/Button';
export { Toggle } from './core/Toggle';

// Feedback components
export { StatusMessage } from './feedback/StatusMessage';
export { Toast } from './feedback/Toast';
export { useNotification, NotificationProvider } from './feedback/NotificationContext';

// Form components
export { TextArea } from './form/TextArea';
export { RadioGroup } from './form/RadioGroup';
export { SelectList } from './form/SelectList';

// Layout components
export { Card, CardHeader, CardTitle, CardContent } from './layout/Card';
export { Accordion } from './layout/Accordion';
export { Modal } from './layout/Modal';
export { PlatformCard} from './layout/PlatformCard';
export { AppHeader } from './layout/AppHeader';
export { Tooltip } from './layout/Tooltip';

// Messaging components
export { MessageBubble } from './messaging/MessageBubble';
export { MessageInput } from './messaging/MessageInput';

// Display components
export { ContentProvider, useContent } from './content/ContentContext';
export { ContentTypeDisplay } from './content/ContentTypeDisplay';
