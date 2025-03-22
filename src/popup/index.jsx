// src/popup/index.jsx
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { ThemeProvider } from '../contexts/ThemeContext';
import { StatusProvider } from './contexts/StatusContext';
import { PlatformProvider } from './contexts/PlatformContext';
import { ContentProvider } from '../components';
import { PromptProvider } from './contexts/PromptContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <ThemeProvider>
      <StatusProvider>
        <ContentProvider>
          <PlatformProvider>
            <PromptProvider>
              <Popup />
            </PromptProvider>
          </PlatformProvider>
        </ContentProvider>
      </StatusProvider>
    </ThemeProvider>
  );
});