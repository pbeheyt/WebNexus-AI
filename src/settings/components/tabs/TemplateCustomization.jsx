import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import Button from '../common/Button';
import TemplateSection from '../ui/template/TemplateSection';
import AddParameterModal from '../ui/template/AddParameterModal';

const TemplateCustomization = () => {
  const { success, error } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [contentTypes, setContentTypes] = useState([
    { id: 'shared', label: 'Shared Parameters' },
    { id: 'general', label: 'Web Content Parameters' },
    { id: 'reddit', label: 'Reddit Parameters' },
    { id: 'youtube', label: 'YouTube Parameters' },
    { id: 'pdf', label: 'PDF Document Parameters' },
    { id: 'selected_text', label: 'Selected Text Parameters' }
  ]);
  const [parameters, setParameters] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSectionId, setAddingSectionId] = useState(null);
  
  // Initialize template service and load parameters
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoading(true);
      
      try {
        // Load parameters for each content type
        const loadedParameters = {};
        
        for (const type of contentTypes) {
          loadedParameters[type.id] = await loadParametersForType(type.id);
          
          // Initialize expanded state (default to expanded)
          setExpandedSections(prev => ({
            ...prev,
            [type.id]: true
          }));
        }
        
        setParameters(loadedParameters);
      } catch (err) {
        console.error('Error loading templates:', err);
        error('Failed to load template parameters');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplates();
  }, [contentTypes, error]);
  
  // Load parameters for a specific content type
  const loadParametersForType = async (contentType) => {
    try {
      // Get parameters from storage
      const storageKey = `template_parameters_${contentType}`;
      const result = await chrome.storage.sync.get(storageKey);
      
      return result[storageKey] || [];
    } catch (err) {
      console.error(`Error loading parameters for ${contentType}:`, err);
      return [];
    }
  };
  
  // Save parameters for a specific content type
  const saveParametersForType = async (contentType, params) => {
    try {
      const storageKey = `template_parameters_${contentType}`;
      await chrome.storage.sync.set({ [storageKey]: params });
      
      // Update local state
      setParameters(prev => ({
        ...prev,
        [contentType]: params
      }));
      
      return true;
    } catch (err) {
      console.error(`Error saving parameters for ${contentType}:`, err);
      error(`Failed to save parameters: ${err.message}`);
      return false;
    }
  };
  
  const handleToggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  const handleAddParameter = (sectionId) => {
    setAddingSectionId(sectionId);
    setShowAddModal(true);
  };
  
  const handleAddParameterSubmit = async (paramData) => {
    try {
      if (!addingSectionId) return;
      
      // Get current parameters for this type
      const currentParams = [...(parameters[addingSectionId] || [])];
      
      // Generate ID for new parameter
      const parameterId = `param_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Create new parameter object
      const newParam = {
        id: parameterId,
        param_name: paramData.name,
        type: paramData.type,
        order: currentParams.length,
        ...paramData.typeSpecificData
      };
      
      // Add to parameters array
      currentParams.push(newParam);
      
      // Save parameters
      const success = await saveParametersForType(addingSectionId, currentParams);
      
      if (success) {
        // Close modal
        setShowAddModal(false);
        setAddingSectionId(null);
      }
    } catch (err) {
      console.error('Error adding parameter:', err);
      error(`Failed to add parameter: ${err.message}`);
    }
  };
  
  const handleReorderParameter = async (sectionId, parameterId, newOrder) => {
    try {
      // Get current parameters for this section
      const currentParams = [...(parameters[sectionId] || [])];
      
      // Find parameter index
      const paramIndex = currentParams.findIndex(p => p.id === parameterId);
      if (paramIndex === -1) return;
      
      // Ensure new order is valid
      if (newOrder < 0) newOrder = 0;
      if (newOrder >= currentParams.length) newOrder = currentParams.length - 1;
      
      // Remove parameter from array
      const [param] = currentParams.splice(paramIndex, 1);
      
      // Insert at new position
      currentParams.splice(newOrder, 0, param);
      
      // Update orders
      currentParams.forEach((p, index) => {
        p.order = index;
      });
      
      // Save parameters
      await saveParametersForType(sectionId, currentParams);
    } catch (err) {
      console.error('Error reordering parameter:', err);
      error(`Failed to reorder parameter: ${err.message}`);
    }
  };
  
  const handleDeleteParameter = async (sectionId, parameterId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this parameter?')) {
        return;
      }
      
      // Get current parameters for this section
      const currentParams = [...(parameters[sectionId] || [])];
      
      // Remove parameter
      const updatedParams = currentParams.filter(p => p.id !== parameterId);
      
      // Update orders
      updatedParams.forEach((p, index) => {
        p.order = index;
      });
      
      // Save parameters
      await saveParametersForType(sectionId, updatedParams);
    } catch (err) {
      console.error('Error deleting parameter:', err);
      error(`Failed to delete parameter: ${err.message}`);
    }
  };
  
  const handleUpdateParameter = async (sectionId, parameterId, updates) => {
    try {
      // Get current parameters for this section
      const currentParams = [...(parameters[sectionId] || [])];
      
      // Find parameter
      const paramIndex = currentParams.findIndex(p => p.id === parameterId);
      if (paramIndex === -1) return;
      
      // Update parameter
      currentParams[paramIndex] = {
        ...currentParams[paramIndex],
        ...updates
      };
      
      // Save parameters
      await saveParametersForType(sectionId, currentParams);
      
      return true;
    } catch (err) {
      console.error('Error updating parameter:', err);
      error(`Failed to update parameter: ${err.message}`);
      return false;
    }
  };
  
  const handleResetTemplates = async () => {
    if (!window.confirm('Are you sure you want to reset all template customizations? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Clear all template parameters
      for (const type of contentTypes) {
        const storageKey = `template_parameters_${type.id}`;
        await chrome.storage.sync.remove(storageKey);
      }
      
      // Reset parameters in state
      const emptyParams = {};
      contentTypes.forEach(type => {
        emptyParams[type.id] = [];
      });
      
      setParameters(emptyParams);
      success('Templates reset to default');
    } catch (err) {
      console.error('Error resetting templates:', err);
      error(`Failed to reset templates: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="mt-4">Loading template parameters...</p>
      </div>
    );
  }
  
  return (
    <div className="template-customization-container">
      <div className="customize-header">
        <h2 className="type-heading mb-4 pb-3 border-b border-theme text-lg font-medium">Customize Prompt Templates</h2>
        <p className="section-description text-theme-secondary mb-4">
          Customize the default prompt templates used by the extension. These templates are used when creating summaries.
        </p>
        <div className="template-actions flex justify-end">
          <Button
            variant="danger"
            onClick={handleResetTemplates}
          >
            Reset to Default
          </Button>
        </div>
      </div>
      
      {/* Template sections */}
      {contentTypes.map((type) => (
        <TemplateSection
          key={type.id}
          title={type.label}
          expanded={expandedSections[type.id]}
          onToggle={() => handleToggleSection(type.id)}
          onAddParameter={() => handleAddParameter(type.id)}
          parameters={parameters[type.id] || []}
          onReorderParameter={(parameterId, newOrder) => 
            handleReorderParameter(type.id, parameterId, newOrder)
          }
          onDeleteParameter={(parameterId) => 
            handleDeleteParameter(type.id, parameterId)
          }
          onUpdateParameter={(parameterId, updates) => 
            handleUpdateParameter(type.id, parameterId, updates)
          }
        />
      ))}
      
      {/* Add parameter modal */}
      {showAddModal && (
        <AddParameterModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddParameterSubmit}
        />
      )}
    </div>
  );
};

export default TemplateCustomization;