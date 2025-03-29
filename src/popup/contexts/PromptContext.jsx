// src/components/context/PromptContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';
import { useContent } from '../../components';
import { useStatus } from './StatusContext';

const PromptContext = createContext(null);

export function PromptProvider({ children }) {
  const { contentType } = useContent();
  const { updateStatus } = useStatus();
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [quickPromptText, setQuickPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Load prompt preferences when content type changes
  useEffect(() => {
    if (!contentType) return;
    
    const loadPromptPreferences = async () => {
      setIsLoading(true);
      try {
        // Load selected prompt ID for custom prompts
        const { [STORAGE_KEYS.SELECTED_PROMPT_IDS]: selectedPrompts } = 
          await chrome.storage.sync.get(STORAGE_KEYS.SELECTED_PROMPT_IDS);
        
        const key = `${contentType}-custom`;
        let promptId = selectedPrompts?.[key];
        
        setSelectedPromptId(promptId);
        
        // Load quick prompt text
        const { [STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts } = 
          await chrome.storage.sync.get(STORAGE_KEYS.QUICK_PROMPTS);
        
        setQuickPromptText(quickPrompts?.[contentType] || '');
        
        updateStatus('Prompt settings loaded');
      } catch (error) {
        console.error('Error loading prompt preferences:', error);
        updateStatus('Error loading prompt settings', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPromptPreferences();
  }, [contentType, updateStatus]);
  
  const selectPrompt = async (promptId) => {
    if (!contentType || promptId === selectedPromptId) return false;
    
    try {
      // Save selected prompt ID
      const { [STORAGE_KEYS.SELECTED_PROMPT_IDS]: selectedPrompts = {} } = 
        await chrome.storage.sync.get(STORAGE_KEYS.SELECTED_PROMPT_IDS);
      
      const key = `${contentType}-custom`;
      selectedPrompts[key] = promptId;
      
      await chrome.storage.sync.set({ [STORAGE_KEYS.SELECTED_PROMPT_IDS]: selectedPrompts });
      setSelectedPromptId(promptId);
      return true;
    } catch (error) {
      console.error('Error selecting prompt:', error);
      return false;
    }
  };
  
  const updateQuickPrompt = async (text) => {
    if (!contentType) return false;
    
    try {
      // Save quick prompt text
      const { [STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts = {} } = 
        await chrome.storage.sync.get(STORAGE_KEYS.QUICK_PROMPTS);
      
      quickPrompts[contentType] = text;
      await chrome.storage.sync.set({ [STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts });
      setQuickPromptText(text);
      return true;
    } catch (error) {
      console.error('Error updating quick prompt:', error);
      return false;
    }
  };
  
  return (
    <PromptContext.Provider
      value={{
        selectedPromptId,
        quickPromptText,
        isLoading,
        selectPrompt,
        updateQuickPrompt
      }}
    >
      {children}
    </PromptContext.Provider>
  );
}

export const usePrompts = () => useContext(PromptContext);