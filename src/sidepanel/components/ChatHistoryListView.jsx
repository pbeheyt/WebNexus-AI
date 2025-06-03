// src/sidepanel/components/ChatHistoryListView.jsx
import React, { useEffect, useState, useCallback } from 'react';

import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import ChatHistoryService from '../services/ChatHistoryService';
import { PlatformIcon } from '../../components/layout/PlatformIcon'; // Adjusted path
import { SpinnerIcon } from '../../components'; // Assuming SpinnerIcon is in components/index.js
import { logger } from '../../shared/logger';
import ConfigService from '../../services/ConfigService';


// Placeholder Icons (replace with actual icons later)
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.56 0c1.153 0 2.24.03 3.322.086M7.688 7.864a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" /></svg>;
const ArrowRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>;


export default function ChatHistoryListView() {
  const { createNewChat, selectChatSession, deleteSelectedChatSession, currentChatSessionId, switchToChatView } = useSidePanelChat();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [platformConfigs, setPlatformConfigs] = useState({});

  const fetchSessionsAndConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsMetadata, allPlatformConfigs] = await Promise.all([
        ChatHistoryService.getAllChatSessionsMetadata(),
        ConfigService.getAllPlatformConfigs()
      ]);
      setSessions(sessionsMetadata);

      const configs = allPlatformConfigs.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
      setPlatformConfigs(configs);

    } catch (err) {
      logger.sidepanel.error('Error fetching chat sessions metadata or platform configs:', err);
      setError('Failed to load chat history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionsAndConfigs();
  }, [fetchSessionsAndConfigs, currentChatSessionId]); // Re-fetch if currentChatSessionId changes (e.g., after delete/create)

  const handleSelectSession = (sessionId) => {
    selectChatSession(sessionId);
    // The context will switch the view
  };

  const handleNewChat = () => {
    createNewChat();
    // The context will switch the view
  };

  const handleDeleteSession = async (sessionId, sessionTitle) => {
    if (window.confirm(`Are you sure you want to delete the chat titled "${sessionTitle}"? This action cannot be undone.`)) {
      setDeletingSessionId(sessionId);
      try {
        await deleteSelectedChatSession(sessionId);
        // fetchSessionsAndConfigs will be called by useEffect due to currentChatSessionId change if active session was deleted,
        // or we might need a more direct way to signal list refresh for non-active deletions.
        // For now, let's rely on the useEffect dependency or explicitly call it.
        await fetchSessionsAndConfigs(); // Explicitly re-fetch after any deletion
      } catch (err) {
        logger.sidepanel.error(`Error during delete operation for session ${sessionId}:`, err);
        setError('Failed to delete session.'); // Show error to user
      } finally {
        setDeletingSessionId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <SpinnerIcon className="w-8 h-8 text-theme-secondary" />
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 p-4 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="flex-1 flex flex-col p-3 bg-theme-primary overflow-y-auto">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-theme">
        <h2 className="text-lg font-semibold text-theme-primary">Chat History</h2>
        <button
          onClick={handleNewChat}
          className="flex items-center px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary-hover transition-colors"
        >
          <PlusIcon />
          <span className="ml-1.5">New Chat</span>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center text-theme-secondary py-10">
          <p>No chat history yet.</p>
          <p>Start a new chat to see it here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const platformConfig = platformConfigs[session.platformId];
            const isActiveSession = session.id === currentChatSessionId;
            return (
              <li
                key={session.id}
                className={`p-3 rounded-lg flex items-center justify-between transition-colors ${isActiveSession ? 'bg-theme-active ring-1 ring-primary' : 'bg-theme-surface hover:bg-theme-hover'}`}
              >
                <button
                  onClick={() => handleSelectSession(session.id)}
                  className="flex items-center flex-grow min-w-0 text-left mr-2 focus:outline-none"
                  title={`Open chat: ${session.title}`}
                >
                  {platformConfig?.iconUrl && (
                    <PlatformIcon
                      platformId={session.platformId}
                      iconUrl={platformConfig.iconUrl}
                      altText={`${platformConfig.name} logo`}
                      className="w-6 h-6 mr-3 flex-shrink-0"
                    />
                  )}
                  <div className="flex-grow min-w-0">
                    <p className={`text-sm font-medium truncate ${isActiveSession ? 'text-primary' : 'text-theme-primary'}`}>
                      {session.title || 'Untitled Chat'}
                    </p>
                    <p className="text-xs text-theme-secondary">
                      {new Date(session.lastActivityAt).toLocaleDateString()} - {new Date(session.lastActivityAt).toLocaleTimeString()}
                    </p>
                    {session.modelId && <p className="text-xxs text-theme-secondary truncate">Model: {session.modelId}</p>}
                  </div>
                </button>
                <div className="flex-shrink-0 flex items-center">
                  {isActiveSession && (
                     <button
                        onClick={switchToChatView}
                        className="p-1.5 text-theme-secondary hover:text-primary rounded-md mr-1"
                        title="Go to active chat"
                      >
                       <ArrowRightIcon />
                     </button>
                  )}
                  <button
                    onClick={() => handleDeleteSession(session.id, session.title || 'Untitled Chat')}
                    disabled={deletingSessionId === session.id}
                    className="p-1.5 text-red-500 hover:text-red-700 disabled:opacity-50 rounded-md"
                    title="Delete chat session"
                  >
                    {deletingSessionId === session.id ? (
                      <SpinnerIcon className="w-5 h-5" />
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
