import { createRoot } from 'react-dom/client';

import { UIProvider } from '../contexts/UIContext';
import { ContentProvider } from '../contexts/ContentContext';
import { PopupPlatformProvider } from '../contexts/platform';

import { StatusProvider } from './contexts/StatusContext';
import { Popup } from './Popup';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <UIProvider>
      <StatusProvider>
        <ContentProvider>
          <PopupPlatformProvider>
            <Popup />
          </PopupPlatformProvider>
        </ContentProvider>
      </StatusProvider>
    </UIProvider>
  );
});
