// src/settings/components/tabs/PromptManagement.jsx
import React, { useState, useCallback } from 'react';

import PromptList from '../ui/prompts/PromptList';
import PromptDetail from '../ui/prompts/PromptDetail';
import PromptForm from '../ui/prompts/PromptForm';
import { CONTENT_TYPE_LABELS, CONTENT_TYPES } from '../../../shared/constants';

const PromptManagement = () => {
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filterValue, setFilterValue] = useState(CONTENT_TYPES.GENERAL);
  const [initialContentTypeForNew, setInitialContentTypeForNew] = useState(
    CONTENT_TYPES.GENERAL
  );

  const handleNewPrompt = useCallback(() => {
    // Use the current filter value if it's a specific type, otherwise default to general
    const isValidContentType =
      Object.values(CONTENT_TYPES).includes(filterValue);
    const initialType = isValidContentType
      ? filterValue
      : CONTENT_TYPES.GENERAL;
    setInitialContentTypeForNew(initialType);
    setSelectedPrompt(null);
    setIsEditing(false);
    setIsCreating(true);
  }, [filterValue, setInitialContentTypeForNew, setSelectedPrompt, setIsEditing, setIsCreating]);

  const handleEditPrompt = useCallback((prompt) => {
    setSelectedPrompt(prompt);
    setIsCreating(false);
    setIsEditing(true);
  }, [setSelectedPrompt, setIsCreating, setIsEditing]);

  const handleViewPrompt = useCallback((prompt) => {
    setSelectedPrompt(prompt);
    setIsEditing(false);
    setIsCreating(false);
  }, [setSelectedPrompt, setIsEditing, setIsCreating]);

  const handleCancelForm = useCallback(() => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedPrompt(null);
  }, [setIsEditing, setIsCreating, setSelectedPrompt]);

  const handlePromptSavedOrDeleted = useCallback(() => {
    setSelectedPrompt(null);
    setIsEditing(false);
    setIsCreating(false);
    // Keep the current filter value, don't reset it
  }, [setSelectedPrompt, setIsEditing, setIsCreating]);

  const handleFilterChange = useCallback((selectedId) => {
    setFilterValue(selectedId);
    // When filter changes, clear the detail view unless creating/editing
    if (!isCreating && !isEditing) {
      setSelectedPrompt(null);
    }
  }, [setFilterValue, isCreating, isEditing, setSelectedPrompt]);


  // Determine what to show in the detail panel
  let detailContent;
  if (isCreating) {
    detailContent = (
      <PromptForm
        onCancel={handleCancelForm}
        onSuccess={handlePromptSavedOrDeleted}
        initialContentType={initialContentTypeForNew}
      />
    );
  } else if (isEditing && selectedPrompt) {
    detailContent = (
      <PromptForm
        prompt={selectedPrompt}
        onCancel={handleCancelForm}
        onSuccess={handlePromptSavedOrDeleted}
        // No initialContentType needed when editing
      />
    );
  } else if (selectedPrompt) {
    // Pass handleEditPrompt directly
    detailContent = (
      <PromptDetail
        prompt={selectedPrompt}
        onEdit={() => handleEditPrompt(selectedPrompt)}
        onDelete={handlePromptSavedOrDeleted}
      />
    );
  } else {
    detailContent = (
      <div className='empty-state bg-theme-surface p-8 text-center text-sm text-theme-secondary rounded-lg border border-theme'>
        <p className='select-none'>
          Select a prompt from the list or create a new one.
        </p>
      </div>
    );
  }

  return (
    <div className='master-detail flex flex-col md:flex-row gap-6'>
      {/* Master Panel */}
      <div className='master-panel w-full md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-theme pb-3 md:pb-0 md:pr-5'>
        <div className='master-header flex justify-between items-center'>
          <h2 className='text-lg font-medium select-none'>Prompts</h2>
          <button
            className='new-prompt-btn bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1 text-sm font-medium select-none'
            onClick={handleNewPrompt}
          >
            + New
          </button>
        </div>
        <div className='border-b border-theme w-full my-4'></div>
        <p className='section-description text-theme-secondary text-sm mb-6 select-none'>
          Manage your custom prompts for different content types.
        </p>

        {/* Pass state and handlers down to PromptList */}
        <PromptList
          filterValue={filterValue}
          contentTypeLabels={CONTENT_TYPE_LABELS}
          onSelectPrompt={handleViewPrompt}
          selectedPromptId={selectedPrompt?.id}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Detail Panel */}
      <div className='detail-panel flex-grow'>{detailContent}</div>
    </div>
  );
};

export default PromptManagement;