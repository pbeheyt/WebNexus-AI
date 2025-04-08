import React, { useState, useEffect } from 'react';
import PromptList from '../ui/prompts/PromptList';
import PromptDetail from '../ui/prompts/PromptDetail';
import PromptForm from '../ui/prompts/PromptForm';
import { CONTENT_TYPE_LABELS } from '../../../shared/constants';

const PromptManagement = () => {
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filterValue, setFilterValue] = useState('all');
  
  useEffect(() => {
    // Initialize content types using keys from the imported labels object
    setContentTypes(Object.keys(CONTENT_TYPE_LABELS));
  }, []);
  
  const handleNewPrompt = () => {
    setSelectedPrompt(null);
    setIsEditing(false);
    setIsCreating(true);
  };
  
  const handleEditPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setIsCreating(false);
    setIsEditing(true);
  };
  
  const handleViewPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setIsEditing(false);
    setIsCreating(false);
  };
  
  const handleCancelForm = () => {
    setIsEditing(false);
    setIsCreating(false);
  };
  
  const handlePromptDeleted = () => {
    setSelectedPrompt(null);
    setIsEditing(false);
    setIsCreating(false);
  };
  
  const handleFilterChange = (e) => {
    setFilterValue(e.target.value);
  };
  
  // Determine what to show in the detail panel
  let detailContent;
  
  if (isCreating) {
    detailContent = (
      <PromptForm 
        onCancel={handleCancelForm}
        onSuccess={handlePromptDeleted}
      />
    );
  } else if (isEditing && selectedPrompt) {
    detailContent = (
      <PromptForm 
        prompt={selectedPrompt}
        onCancel={handleCancelForm}
        onSuccess={handlePromptDeleted}
      />
    );
  } else if (selectedPrompt) {
    detailContent = (
      <PromptDetail 
        prompt={selectedPrompt}
        onEdit={() => handleEditPrompt(selectedPrompt)}
        onDelete={handlePromptDeleted}
      />
    );
  } else {
    detailContent = (
      <div className="empty-state bg-theme-surface p-8 text-center text-theme-secondary rounded-lg">
        <p>Select a prompt from the list or create a new one</p>
      </div>
    );
  }
  
  return (
    <div className="master-detail flex gap-6">
      <div className="master-panel w-64 flex-shrink-0 border-r border-theme pr-5">
        <div className="master-header flex justify-between items-center mb-4">
          <h2 className="type-heading text-lg font-medium">Prompts</h2>
          <button 
            className="new-prompt-btn bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1 text-sm font-medium"
            onClick={handleNewPrompt}
          >
            + New
          </button>
        </div>
        <p className="section-description text-theme-secondary mb-6">
          Manage your custom prompts for different content types. Create, edit, or delete prompts that can be used for content processing.
        </p>
        
        <div className="form-group mb-4">
          <select
            id="content-type-filter"
            className="content-type-filter w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md pr-8"
            value={filterValue}
            onChange={handleFilterChange}
          >
            <option value="all">All Content Types</option>
            {contentTypes.map(type => (
              <option key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]} 
              </option>
            ))}
          </select>
        </div>
        
        <PromptList
          filterValue={filterValue}
          contentTypeLabels={CONTENT_TYPE_LABELS}
          onSelectPrompt={handleViewPrompt}
          selectedPromptId={selectedPrompt?.id}
        />
      </div>
      
      {/* Detail Panel */}
      <div className="detail-panel flex-grow">
        {detailContent}
      </div>
    </div>
  );
};

export default PromptManagement;
