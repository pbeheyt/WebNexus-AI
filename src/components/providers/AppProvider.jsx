// src/components/providers/AppProvider.jsx
import { ThemeProvider } from '../context/ThemeContext';
import { StatusProvider } from '../context/StatusContext';
import { PlatformProvider } from '../context/PlatformContext';
import { ContentProvider } from '../context/ContentContext';
import { PromptProvider } from '../context/PromptContext';

export function AppProvider({ children }) {
  return (
    <ThemeProvider>
      <StatusProvider>
        <ContentProvider>
          <PlatformProvider>
            <PromptProvider>
              {children}
            </PromptProvider>
          </PlatformProvider>
        </ContentProvider>
      </StatusProvider>
    </ThemeProvider>
  );
}