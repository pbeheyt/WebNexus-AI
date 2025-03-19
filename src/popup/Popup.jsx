// src/popup/Popup.jsx
import { useEffect } from 'react';
import { useContent } from '../components/context/ContentContext';
import { usePrompts } from '../components/context/PromptContext';
import { useTheme } from '../components/context/ThemeContext';
import { useStatus } from '../components/context/StatusContext';
import { Button } from '../components/ui/Button';
import { StatusMessage } from '../components/ui/StatusMessage';
import { Toast } from '../components/ui/Toast';
import { ContentTypeDisplay } from '../components/features/ContentTypeDisplay';
import { PlatformSelector } from '../components/features/PlatformSelector';
import { PromptTypeToggle } from '../components/features/PromptTypeToggle';
import { QuickPromptEditor } from '../components/features/QuickPromptEditor';
import { DefaultPromptConfig } from '../components/features/DefaultPromptConfig';
import { CustomPromptSelector } from '../components/features/CustomPromptSelector';
import { PROMPT_TYPES } from '../shared/constants';
import { useState } from 'react';

export function Popup() {
  const { theme, toggleTheme } = useTheme();
  const { contentType, currentTab, isSupported } = useContent();
  const { promptType, quickPromptText } = usePrompts();
  const { 
    statusMessage, 
    updateStatus, 
    toastState,
    showToastMessage
  } = useStatus();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Listen for messages from background script
  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === 'youtubeTranscriptError') {
        showToastMessage(message.message || 'Failed to retrieve YouTube transcript.', 'error');
      } else if (message.action === 'youtubeCommentsNotLoaded') {
        showToastMessage('Comments exist but are not loaded. Scroll down to load them.', 'warning');
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [showToastMessage]);
  
  // Reset status when content type changes
  useEffect(() => {
    updateStatus('Ready to summarize.');
  }, [contentType, updateStatus]);
  
  const openSettings = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  };
  
  const handleSummarize = async () => {
    if (isProcessing || !isSupported) return;
    
    // Check if quick prompt is empty when using quick prompt type
    if (promptType === PROMPT_TYPES.QUICK && !quickPromptText.trim()) {
      updateStatus('Please enter a prompt in the Quick Prompt editor');
      showToastMessage('Quick Prompt cannot be empty', 'error');
      return;
    }
    
    setIsProcessing(true);
    updateStatus('Processing content...');
    
    try {
      // Implementation for summarization using chrome.runtime.sendMessage 
      // would go here, similar to the original SummarizeController
      
      // For this example, we'll just simulate a successful process
      setTimeout(() => {
        updateStatus('Opening AI platform...');
        setTimeout(() => window.close(), 1000);
      }, 1000);
    } catch (error) {
      console.error('Summarize error:', error);
      setIsProcessing(false);
      updateStatus(`Error: ${error.message}`);
      showToastMessage(`Error: ${error.message}`, 'error');
    }
  };
  
  return (
    <div className="min-w-[320px] p-2 bg-background-primary text-text-primary">
      <header className="flex items-center justify-between pb-1 mb-1 border-b border-border">
        <h1 className="text-base font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          AI Content Summarizer
        </h1>
        
        <div className="flex items-center">
          <button 
            onClick={toggleTheme}
            className="p-1 text-text-secondary hover:text-primary hover:bg-background-active rounded transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
              </svg>
            )}
          </button>
          
          <button
            onClick={openSettings}
            className="p-1 ml-1 text-text-secondary hover:text-primary hover:bg-background-active rounded transition-colors"
            title="Manage Custom Prompts"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>
      
      <Button
        onClick={handleSummarize}
        disabled={isProcessing || !isSupported}
        className="w-full mb-2"
      >
        {isProcessing ? 'Processing...' : 'Summarize Content'}
      </Button>
      
      <ContentTypeDisplay />
      
      <div className="mt-2">
        <PlatformSelector />
      </div>
      
      <div className="mt-2">
        <PromptTypeToggle />
      </div>
      
      <div className="mt-2">
        {promptType === PROMPT_TYPES.DEFAULT && <DefaultPromptConfig />}
        {promptType === PROMPT_TYPES.CUSTOM && <CustomPromptSelector />}
        {promptType === PROMPT_TYPES.QUICK && <QuickPromptEditor />}
      </div>
      
      <StatusMessage message={statusMessage} className="mt-2" />
      
      <Toast 
        message={toastState.message} 
        type={toastState.type} 
        visible={toastState.visible} 
        onClose={() => toastState.setVisible(false)} 
        duration={5000}
      />
    </div>
  );
}