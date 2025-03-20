import { useState, useEffect } from 'react';
import ChatHistoryService from '../services/ChatHistoryService';

export function useChatHistory(pageUrl) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load chat history for a URL
  useEffect(() => {
    const loadHistory = async () => {
      if (!pageUrl) return;
      
      setIsLoading(true);
      try {
        const chatHistory = await ChatHistoryService.getHistory(pageUrl);
        setHistory(chatHistory);
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHistory();
  }, [pageUrl]);
  
  // Save a message to history
  const saveMessage = async (message) => {
    if (!pageUrl) return;
    
    try {
      const updatedHistory = [...history, message];
      setHistory(updatedHistory);
      await ChatHistoryService.saveHistory(pageUrl, updatedHistory);
    } catch (error) {
      console.error('Error saving message to history:', error);
    }
  };
  
  // Save multiple messages to history
  const saveMessages = async (messages) => {
    if (!pageUrl) return;
    
    try {
      const updatedHistory = [...history, ...messages];
      setHistory(updatedHistory);
      await ChatHistoryService.saveHistory(pageUrl, updatedHistory);
    } catch (error) {
      console.error('Error saving messages to history:', error);
    }
  };
  
  // Clear history for this URL
  const clearHistory = async () => {
    if (!pageUrl) return;
    
    try {
      setHistory([]);
      await ChatHistoryService.clearHistory(pageUrl);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };
  
  return {
    history,
    isLoading,
    saveMessage,
    saveMessages,
    clearHistory
  };
}