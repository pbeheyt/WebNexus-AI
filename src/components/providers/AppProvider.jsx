import { ThemeProvider } from '../context/ThemeContext';
import { PlatformProvider } from '../context/PlatformContext';
import { ContentProvider } from '../context/ContentContext';
import { PromptProvider } from '../context/PromptContext';

export function AppProvider({ children }) {
  return (
    <ThemeProvider>
      <ContentProvider>
        <PlatformProvider>
          <PromptProvider>
            {children}
          </PromptProvider>
        </PlatformProvider>
      </ContentProvider>
    </ThemeProvider>
  );
}