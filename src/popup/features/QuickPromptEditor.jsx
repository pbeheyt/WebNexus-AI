// src/components/features/QuickPromptEditor.jsx
import { useState, useEffect, useCallback } from 'react';
import { TextArea, useContent } from '../../components';
import { usePrompts } from '../contexts/PromptContext';
import { useStatus } from '../contexts/StatusContext';

export function QuickPromptEditor() {
  const { quickPromptText, updateQuickPrompt } = usePrompts();
  const { contentType } = useContent();
  const { notifyQuickPromptUpdated } = useStatus();
  const [text, setText] = useState(quickPromptText);
  const [isFocused, setIsFocused] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  
  // Update text when quickPromptText or contentType changes
  useEffect(() => {
    setText(quickPromptText);
  }, [quickPromptText, contentType]);
  
  // Debounced update function
  const debouncedUpdatePrompt = useCallback(
    async (newText) => {
      const now = Date.now();
      if (now - lastUpdateTime > 500) {  // 500ms debounce
        const success = await updateQuickPrompt(newText);
        if (success) {
          notifyQuickPromptUpdated();
        }
        setLastUpdateTime(now);
      }
    },
    [updateQuickPrompt, notifyQuickPromptUpdated, lastUpdateTime]
  );
  
  const handleChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    debouncedUpdatePrompt(newText);
  };
  
  const getPlaceholderText = () => {
    switch (contentType) {
      case 'youtube':
        return 'Enter your prompt for analyzing this YouTube video...';
      case 'reddit':
        return 'Enter your prompt for analyzing this Reddit post...';
      case 'pdf':
        return 'Enter your prompt for analyzing this PDF document...';
      default:
        return 'Enter your custom prompt for analyzing this page...';
    }
  };
  
  return (
    <div className={`bg-background-surface p-2 rounded-md border ${isFocused ? 'border-primary' : 'border-border'}`}>
      <TextArea
        value={text}
        onChange={handleChange}
        placeholder={getPlaceholderText()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full min-h-[100px]"
      />
      <div className={`text-right text-xs flex items-center justify-end gap-1 ${text.length > 2000 ? 'text-warning' : 'text-text-secondary'}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${text.length > 2000 ? 'bg-warning' : 'bg-success'}`}></span>
        {text.length} characters
      </div>
    </div>
  );
}
