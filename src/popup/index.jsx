import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { ThemeProvider } from '../contexts/ThemeContext';
import { StatusProvider } from './contexts/StatusContext';
import { ContentProvider } from '../components';
import { PopupPlatformProvider } from '../contexts/platform';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <ThemeProvider>
      <StatusProvider>
        <ContentProvider>
          <PopupPlatformProvider>
            <Popup />
          </PopupPlatformProvider>
        </ContentProvider>
      </StatusProvider>
    </ThemeProvider>
  );
});
