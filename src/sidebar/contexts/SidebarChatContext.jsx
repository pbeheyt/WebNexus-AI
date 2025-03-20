import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSidebarPlatform } from './SidebarPlatformContext';
import ChatHistoryService from '../services/ChatHistoryService';
import { useApiProcess } from '../hooks/useApiProcess';
import { useExtraction } from '../hooks/useExtraction';
import { MESSAGE_ROLES } from '../constants';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const { selectedPlatformId, selectedModel } = useSidebarPlatform();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [extractedContent, setExtractedContent] = useState(null);
  
  const { extractContent, extractionStatus } = useExtraction();
  const { processContent } = useApiProcess();
  
  // Get current page URL and initialize chat history
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get current tab URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (currentTab && currentTab.url) {
          setCurrentPageUrl(currentTab.url);
          
          // Load chat history for this URL
          const history = await ChatHistoryService.getHistory(currentTab.url);
          setMessages(history);
        }
      } catch (error) {
        console.error('Error initializing chat context:', error);
      }
    };
    
    initialize();
  }, []);
  
  // Send a message and get a response
  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || isProcessing) return;
    
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Update UI with user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsProcessing(true);
    
    try {
      // Extract content if not already done
      if (!extractedContent) {
        const content = await extractContent();
        setExtractedContent(content);
      }
      
      // Process with API
      const response = await processContent(text.trim(), extractedContent);
      
      if (!response) {
        throw new Error('Failed to get response from API');
      }
      
      // Create assistant message
      const assistantMessage = {
        id: `msg_${Date.now()}`,
        role: MESSAGE_ROLES.ASSISTANT,
        content: response.content,
        model: response.model,
        timestamp: new Date().toISOString()
      };
      
      // Update messages
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Save to history
      await ChatHistoryService.saveHistory(currentPageUrl, finalMessages);
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message
      const errorMessage = {
        id: `msg_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
        content: `Error: ${error.message || 'Failed to process request'}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear chat history
  const clearChat = async () => {
    setMessages([]);
    await ChatHistoryService.clearHistory(currentPageUrl);
  };
  
  return (
    <SidebarChatContext.Provider value={{
      messages,
      inputValue,
      setInputValue,
      sendMessage,
      clearChat,
      isProcessing,
      extractionStatus
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);