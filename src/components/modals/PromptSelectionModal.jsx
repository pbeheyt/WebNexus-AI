// src/components/modals/PromptSelectionModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../layout/Modal';
import { loadRelevantPrompts } from '../../utils/promptUtils';

/**
 * Modal for selecting a custom prompt based on content type.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} props.onSelectPrompt - Function called when a prompt is selected (receives prompt object)
 * @param {string} props.contentType - The current content type to filter prompts
 */
function PromptSelectionModal({ isOpen, onClose, onSelectPrompt, contentType }) {
  const [prompts, setPrompts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && contentType) {
      setIsLoading(true);
      setError(null);
      loadRelevantPrompts(contentType)
        .then(loadedPrompts => {
          setPrompts(loadedPrompts);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load prompts for modal:", err);
          setError("Failed to load prompts.");
          setPrompts([]);
          setIsLoading(false);
        });
    } else if (!isOpen) {
      // Reset state when modal closes
      setSearchTerm('');
      setPrompts([]);
      setError(null);
    }
  }, [isOpen, contentType]);

  const filteredPrompts = useMemo(() => {
    if (!searchTerm) {
      return prompts;
    }
    return prompts.filter(prompt => 
      prompt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [prompts, searchTerm]);

  const handleSelect = (prompt) => {
    onSelectPrompt(prompt);
    onClose(); // Close modal after selection
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select a Prompt"
      size="lg" // Adjust size as needed
    >
      <div className="flex flex-col gap-4 max-h-[60vh]">
        {/* Search Input */}
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />

        {/* Prompt List */}
        <div className="overflow-y-auto flex-grow">
          {isLoading && <p className="text-center text-theme-secondary">Loading prompts...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
          {!isLoading && !error && filteredPrompts.length === 0 && (
            <p className="text-center text-theme-secondary">
              {prompts.length > 0 ? 'No matching prompts found.' : 'No prompts available for this content type.'}
            </p>
          )}
          {!isLoading && !error && filteredPrompts.length > 0 && (
            <ul className="space-y-2">
              {filteredPrompts.map((prompt) => (
                <li key={prompt.id}>
                  <button
                    onClick={() => handleSelect(prompt)}
                    className="w-full text-left p-3 rounded-md bg-theme-surface hover:bg-theme-hover transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <span className="font-medium text-theme-primary">{prompt.name}</span>
                    <p className="text-xs text-theme-secondary mt-1 truncate">
                      {prompt.content}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default PromptSelectionModal;
