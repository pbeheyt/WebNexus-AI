import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';

function UserInput() {
  const { inputValue, setInputValue, sendMessage, isProcessing } = useSidebarChat();
  
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };
  
  const handleKeyDown = (e) => {
    // Send on Enter (without shift for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  const handleSend = () => {
    sendMessage();
  };
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          className="w-full py-2 px-4 pl-3 pr-10 border border-gray-200 dark:border-gray-700 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none transition-colors duration-200 focus:border-blue-500"
          placeholder="Type a message..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
        />
        
        <button
          className={`absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-none outline-none ${
            !inputValue.trim() || isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          onClick={handleSend}
          disabled={!inputValue.trim() || isProcessing}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default UserInput;