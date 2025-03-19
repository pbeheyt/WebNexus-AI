import { useState, useEffect } from 'react';
import { TextArea } from '../ui/TextArea';
import { usePrompts } from '../context/PromptContext';
import { useContent } from '../context/ContentContext';

export function QuickPromptEditor() {
  const { quickPromptText, updateQuickPrompt } = usePrompts();
  const { contentType } = useContent();
  const [text, setText] = useState(quickPromptText);
  const [isFocused, setIsFocused] = useState(false);
  
  // Update text when quickPromptText or contentType changes
  useEffect(() => {
    setText(quickPromptText);
  }, [quickPromptText, contentType]);
  
  const handleChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    updateQuickPrompt(newText);
  };
  
  const getPlaceholderText = () => {
    switch (contentType) {
      case 'youtube':
        return 'Enter your prompt for analyzing this YouTube video...';
      case 'reddit':
        return 'Enter your prompt for analyzing this Reddit post...';
      case 'pdf':
        return 'Enter your prompt for analyzing this PDF document...';
      case 'selected_text':
        return 'Enter your prompt for analyzing this selected text...';
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