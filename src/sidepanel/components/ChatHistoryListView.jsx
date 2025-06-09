// src/sidepanel/components/ChatHistoryListView.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';

import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import ChatHistoryService from '../services/ChatHistoryService';
import { PlatformIcon } from '../../components/layout/PlatformIcon';
import {
  SpinnerIcon,
  TrashIcon,
  ArrowRightIcon,
  XIcon,
  Checkbox,
  Button,
  Input,
  EditIcon,
  CheckIcon,
  useNotification,
  IconButton,
} from '../../components';
import { logger } from '../../shared/logger';
import ConfigService from '../../services/ConfigService';

export default function ChatHistoryListView() {
const {
  deleteSelectedChatSession,
  deleteMultipleChatSessions,
  currentChatSessionId,
  switchToChatView,
  selectChatSession, // Add this
} = useSidePanelChat();

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [platformConfigs, setPlatformConfigs] = useState({});

  // State for selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState(new Set());

  // State for inline editing
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { success: showSuccess, error: showError } = useNotification();

  const fetchSessionsAndConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsMetadata, allPlatformConfigs] = await Promise.all([
        ChatHistoryService.getAllChatSessionsMetadata(),
        ConfigService.getAllPlatformConfigs(),
      ]);
      setSessions(sessionsMetadata);

      const configs = allPlatformConfigs.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
      setPlatformConfigs(configs);
    } catch (err) {
      logger.sidepanel.error(
        'Error fetching chat sessions metadata or platform configs:',
        err
      );
      setError('Failed to load chat history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionsAndConfigs();
  }, [fetchSessionsAndConfigs, currentChatSessionId]);


  const handleDeleteSession = async (sessionId, sessionTitle) => {
    if (
      window.confirm(
        `Are you sure you want to delete the chat titled "${
          sessionTitle || 'Untitled Chat'
        }"? This action cannot be undone.`
      )
    ) {
      setDeletingSessionId(sessionId);
      try {
        await deleteSelectedChatSession(sessionId);
        await fetchSessionsAndConfigs();
      } catch (err) {
        logger.sidepanel.error(
          `Error during delete operation for session ${sessionId}:`,
          err
        );
        setError('Failed to delete session.');
      } finally {
        setDeletingSessionId(null);
      }
    }
  };

  // --- Selection Mode Handlers ---
  const enterSelectionMode = () => setIsSelectionMode(true);
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedSessionIds(new Set());
  };

  const handleToggleSelection = (sessionId) => {
    setSelectedSessionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedSessionIds.size === sessions.length) {
      // If all are selected, deselect all
      setSelectedSessionIds(new Set());
    } else {
      // Otherwise, select all
      const allIds = new Set(sessions.map((s) => s.id));
      setSelectedSessionIds(allIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSessionIds.size === 0) return;
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedSessionIds.size} selected chat(s)? This action cannot be undone.`
      )
    ) {
      await deleteMultipleChatSessions(Array.from(selectedSessionIds));
      exitSelectionMode(); // Exit mode after deletion
      await fetchSessionsAndConfigs(); // Refresh list
    }
  };

  const handleItemClick = (sessionId) => {
    if (isSelectionMode) {
      // In selection mode, a click toggles the checkbox
      handleToggleSelection(sessionId);
    } else {
      // Outside selection mode, a click loads the chat
      selectChatSession(sessionId);
    }
  };

  const handleStartEdit = (session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleSaveTitle = async (sessionId) => {
    const originalTitle = sessions.find(s => s.id === sessionId)?.title;
    if (editingTitle.trim() === originalTitle) {
      handleCancelEdit();
      return;
    }

    const result = await ChatHistoryService.updateSessionTitle(sessionId, editingTitle);
    if (result.success) {
      showSuccess('Chat title updated.');
      await fetchSessionsAndConfigs();
    } else {
      showError(result.message || 'Failed to update title.');
    }
    handleCancelEdit();
  };

  const areAllSelected = useMemo(
    () => sessions.length > 0 && selectedSessionIds.size === sessions.length,
    [sessions, selectedSessionIds]
  );

  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center p-4'>
        <SpinnerIcon className='w-8 h-8 text-theme-secondary' />
      </div>
    );
  }

  if (error) {
    return <div className='flex-1 p-4 text-center text-red-500'>{error}</div>;
  }

  return (
    <div className='flex-1 flex flex-col bg-theme-primary overflow-hidden'>
      {/* Action Bar */}
      <div className='flex items-center justify-between px-5 py-2 border-b border-theme flex-shrink-0'>
        {!isSelectionMode ? (
          <>
            <h2 className='text-sm font-medium text-theme-primary'>
              Chat History
            </h2>
            <Button
              variant='secondary'
              size='sm'
              onClick={enterSelectionMode}
              disabled={sessions.length === 0}
            >
              Select
            </Button>
          </>
        ) : (
          <>
            <Button variant='secondary' size='sm' onClick={exitSelectionMode}>
              <XIcon className='w-4 h-4 mr-1' />
              Cancel
            </Button>
            <div className='flex items-center gap-2'>
              <Button variant='secondary' size='sm' onClick={handleSelectAll}>
                {areAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant='danger'
                size='sm'
                onClick={handleDeleteSelected}
                disabled={selectedSessionIds.size === 0}
              >
                <TrashIcon className='w-4 h-4 mr-1' />
                Delete ({selectedSessionIds.size})
              </Button>
            </div>
          </>
        )}
      </div>

      {/* List Area */}
      <div className='flex-1 overflow-y-auto p-3'>
        {sessions.length === 0 ? (
          <div className='text-center text-theme-secondary py-10'>
            <p>No chat history yet.</p>
            <p>Start a new chat to see it here.</p>
          </div>
        ) : (
          <ul className='space-y-2'>
            {sessions.map((session) => {
              const platformConfig = platformConfigs[session.platformId];
              const isActiveSession = session.id === currentChatSessionId;
              const isSelected = selectedSessionIds.has(session.id);

              return (
                <li
                  key={session.id}
        className={`rounded-lg flex items-center justify-between transition-colors
          ${
            isSelected
              ? 'bg-primary/20 ring-2 ring-primary'
              : isActiveSession
                ? 'bg-theme-active'
                : 'bg-theme-surface hover:bg-theme-hover'
          }
        `}
                >
                  {/* CHECKBOX (for selection mode) */}
                  {isSelectionMode && (
                    <div className='pl-3 py-3 flex-shrink-0'>
                      <Checkbox
                        id={`select-${session.id}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelection(session.id)}
                        // Stop propagation to prevent the main button click
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* MAIN CLICKABLE AREA (as a button) */}
                  <button
                    onClick={() => handleItemClick(session.id)}
                    disabled={editingSessionId === session.id}
                    className={`flex items-center flex-grow min-w-0 text-left p-3 w-full h-full rounded-lg disabled:cursor-default
                      ${isSelectionMode ? 'cursor-pointer' : 'cursor-pointer'}
                    `}
                  >
                    {platformConfig?.iconUrl && (
                      <PlatformIcon
                        platformId={session.platformId}
                        iconUrl={platformConfig.iconUrl}
                        altText={`${platformConfig.name} logo`}
                        className='w-6 h-6 mr-3 flex-shrink-0'
                      />
                    )}
                    <div className='flex-grow min-w-0'>
                      {editingSessionId === session.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(session.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          className='bg-theme-surface border border-primary text-sm p-1 rounded-md'
                        />
                      ) : (
                        <>
                          <p
                            className={`text-sm font-medium truncate ${
                              isActiveSession && !isSelected
                                ? 'text-primary'
                                : 'text-theme-primary'
                            }`}
                          >
                            {session.title || 'Untitled Chat'}
                          </p>
                          <p className='text-xs text-theme-secondary'>
                            {new Date(
                              session.lastActivityAt
                            ).toLocaleDateString()}{' '}
                            -{' '}
                            {new Date(
                              session.lastActivityAt
                            ).toLocaleTimeString()}
                          </p>
                        </>
                      )}
                    </div>
                  </button>

                  {/* ACTION BUTTONS */}
                  <div className='flex-shrink-0 flex items-center pr-3'>
                    {editingSessionId === session.id ? (
                      <>
                        <IconButton
                          icon={CheckIcon}
                          iconClassName='w-5 h-5'
                          className='p-1.5 text-green-500 hover:text-green-700 rounded-md'
                          title='Confirm change'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveTitle(session.id);
                          }}
                        />
                        <IconButton
                          icon={XIcon}
                          iconClassName='w-5 h-5'
                          className='p-1.5 text-red-500 hover:text-red-700 rounded-md'
                          title='Cancel edit'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                        />
                      </>
                    ) : (
                      !isSelectionMode && (
                        <>
                          {isActiveSession && (
                            <IconButton
                              icon={ArrowRightIcon}
                              className='p-1.5 text-theme-secondary hover:text-primary rounded-md'
                              title='Go to active chat'
                              onClick={(e) => {
                                e.stopPropagation();
                                switchToChatView();
                              }}
                            />
                          )}
                          <IconButton
                            icon={EditIcon}
                            iconClassName='w-5 h-5'
                            className='p-1.5 text-theme-secondary hover:text-primary rounded-md'
                            title='Edit title'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(session);
                            }}
                          />
                          <IconButton
                            icon={TrashIcon}
                            isLoading={deletingSessionId === session.id}
                            iconClassName='w-5 h-5'
                            className='p-1.5 text-red-500 hover:text-red-700 disabled:opacity-50 rounded-md'
                            title='Delete chat session'
                            disabled={deletingSessionId === session.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(
                                session.id,
                                session.title || 'Untitled Chat'
                              );
                            }}
                          />
                        </>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
