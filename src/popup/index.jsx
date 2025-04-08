import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { UIProvider } from '../contexts/UIContext';
import { StatusProvider } from './contexts/StatusContext';
import { ContentProvider } from '../contexts/ContentContext'; // Corrected path
import { PopupPlatformProvider } from '../contexts/platform';
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
