// src/components/context/PromptContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { PROMPT_TYPES, STORAGE_KEYS } from '../../shared/constants';
import { useContent } from '../../components';
import { useStatus } from './StatusContext';

const PromptContext = createContext(null);

export function PromptProvider({ children }) {
  const { contentType } = useContent();
  const { updateStatus } = useStatus();
  const [promptType, setPromptType] = useState(PROMPT_TYPES.DEFAULT);
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [quickPromptText, setQuickPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Load prompt preferences when content type changes
  useEffect(() => {
    if (!contentType) return;
    
    const loadPromptPreferences = async () => {
      setIsLoading(true);
      try {
        // Load prompt type preference
        const { [STORAGE_KEYS.PROMPT_TYPE_PREFERENCE]: typePreferences } = 
          await chrome.storage.sync.get(STORAGE_KEYS.PROMPT_TYPE_PREFERENCE);
        
        const typePreference = typePreferences?.[contentType] || PROMPT_TYPES.DEFAULT;
        setPromptType(typePreference);
        
        // Load selected prompt ID
        const { [STORAGE_KEYS.SELECTED_PROMPT_IDS]: selectedPrompts } = 
          await chrome.storage.sync.get(STORAGE_KEYS.SELECTED_PROMPT_IDS);
        
        const key = `${contentType}-${typePreference}`;
        let promptId = selectedPrompts?.[key];
        
        // Fallbacks for different prompt types
        if (!promptId) {
          if (typePreference === PROMPT_TYPES.DEFAULT) {
            promptId = contentType;
          } else if (typePreference === PROMPT_TYPES.QUICK) {
            promptId = 'quick';
          }
        }
        
        setSelectedPromptId(promptId);
        
        // Load quick prompt text if using quick prompt
        if (typePreference === PROMPT_TYPES.QUICK) {
          const { [STORAGE_KEYS.QUICK_PROMPTS]: quickPrompts } = 
            await chrome.storage.sync.get(STORAGE_KEYS.QUICK_PROMPTS);
          
          setQuickPromptText(quickPrompts?.[contentType] || '');
        }
        
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
  
  const changePromptType = async (newType) => {
    if (newType === promptType || !contentType) return false;
    
    try {
      // Save prompt type preference
      const { [STORAGE_KEYS.PROMPT_TYPE_PREFERENCE]: typePreferences = {} } = 
        await chrome.storage.sync.get(STORAGE_KEYS.PROMPT_TYPE_PREFERENCE);
      
      typePreferences[contentType] = newType;
      await chrome.storage.sync.set({ 
        [STORAGE_KEYS.PROMPT_TYPE_PREFERENCE]: typePreferences 
      });
      
      // Update state
      setPromptType(newType);
      
      // Set default prompt ID based on type
      if (newType === PROMPT_TYPES.DEFAULT) {
        setSelectedPromptId(contentType);
      } else if (newType === PROMPT_TYPES.QUICK) {
        setSelectedPromptId('quick');
      }
      
      return true;
    } catch (error) {
      console.error('Error changing prompt type:', error);
      return false;
    }
  };
  
  const selectPrompt = async (promptId) => {
    if (!contentType || !promptType || promptId === selectedPromptId) return false;
    
    try {
      // Save selected prompt ID
      const { [STORAGE_KEYS.SELECTED_PROMPT_IDS]: selectedPrompts = {} } = 
        await chrome.storage.sync.get(STORAGE_KEYS.SELECTED_PROMPT_IDS);
      
      const key = `${contentType}-${promptType}`;
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
        promptType,
        selectedPromptId,
        quickPromptText,
        isLoading,
        changePromptType,
        selectPrompt,
        updateQuickPrompt
      }}
    >
      {children}
    </PromptContext.Provider>
  );
}

export const usePrompts = () => useContext(PromptContext);