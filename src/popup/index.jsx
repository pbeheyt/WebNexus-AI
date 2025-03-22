// src/popup/index.jsx - Updated
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { ThemeProvider } from '../contexts/ThemeContext';
import { StatusProvider } from './contexts/StatusContext';
import { ContentProvider } from '../components';
import { PopupPlatformProvider } from '../contexts/platform';
import { PromptProvider } from './contexts/PromptContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <ThemeProvider>
      <StatusProvider>
        <ContentProvider>
          <PopupPlatformProvider> {/* Updated provider */}
            <PromptProvider>
              <Popup />
            </PromptProvider>
          </PopupPlatformProvider>
        </ContentProvider>
      </StatusProvider>
    </ThemeProvider>
  );
});