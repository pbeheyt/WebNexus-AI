import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import Button from '../common/Button';
import TemplateSection from '../ui/template/TemplateSection';
import AddParameterModal from '../ui/template/AddParameterModal';
import templateService from '../../../services/TemplateService';

const TemplateCustomization = () => {
  const { success, error } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [contentTypes, setContentTypes] = useState([
    { id: 'shared', label: 'Shared Instructions' },
    { id: 'general', label: 'Web Content Instructions' },
    { id: 'reddit', label: 'Reddit Instructions' },
    { id: 'youtube', label: 'YouTube Instructions' },
    { id: 'pdf', label: 'PDF Document Instructions' },
    { id: 'selected_text', label: 'Selected Text Instructions' }
  ]);
  const [parameters, setParameters] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSectionId, setAddingSectionId] = useState(null);
  
  // Initialize and load parameters
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
        error('Failed to load template instructions');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplates();
  }, [contentTypes, error]);
  
  // Load parameters for a specific content type
  const loadParametersForType = async (contentType) => {
    try {
      // Call the templateService to get parameters
      const params = await templateService.getParameters(contentType);
      return params || [];
    } catch (err) {
      console.error(`Error loading instructions for ${contentType}:`, err);
      error(`Failed to load instructions for ${contentType}: ${err.message}`);
      return [];
    }
  };
  
  // Save parameters for a specific content type
  const saveParametersForType = async (contentType, params) => {
    try {
      // Update local state
      setParameters(prev => ({
        ...prev,
        [contentType]: params
      }));
      
      return true;
    } catch (err) {
      console.error(`Error saving instructions for ${contentType}:`, err);
      error(`Failed to save instructions: ${err.message}`);
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
      
      // Save to templateService
      await templateService.addParameter(
        addingSectionId === 'shared' ? 'shared' : addingSectionId,
        newParam
      );
      
      // Save parameters
      const saveSuccess = await saveParametersForType(addingSectionId, currentParams);
      
      if (saveSuccess) {
        // Close modal
        setShowAddModal(false);
        setAddingSectionId(null);
        
        // Reload parameters to ensure state is consistent
        const refreshedParams = await loadParametersForType(addingSectionId);
        setParameters(prev => ({
          ...prev,
          [addingSectionId]: refreshedParams
        }));
      }
    } catch (err) {
      console.error('Error adding instruction:', err);
      error(`Failed to add instruction: ${err.message}`);
    }
  };
  
  const handleReorderParameter = async (sectionId, parameterId, newOrder) => {
    try {
      // Call templateService to reorder
      await templateService.reorderParameter(
        sectionId === 'shared' ? 'shared' : sectionId,
        parameterId,
        newOrder
      );
      
      // Update parameters by refreshing from templateService
      const refreshedParams = await loadParametersForType(sectionId);
      setParameters(prev => ({
        ...prev,
        [sectionId]: refreshedParams
      }));
    } catch (err) {
      console.error('Error reordering instruction:', err);
      error(`Failed to reorder instruction: ${err.message}`);
    }
  };
  
  const handleDeleteParameter = async (sectionId, parameterId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this instruction?')) {
        return;
      }
      
      // Call templateService to delete
      await templateService.deleteParameter(
        sectionId === 'shared' ? 'shared' : sectionId,
        parameterId
      );
      
      // Update parameters by refreshing from templateService
      const refreshedParams = await loadParametersForType(sectionId);
      setParameters(prev => ({
        ...prev,
        [sectionId]: refreshedParams
      }));
    } catch (err) {
      console.error('Error deleting instruction:', err);
      error(`Failed to delete instruction: ${err.message}`);
    }
  };
  
  const handleUpdateParameter = async (sectionId, parameterId, updates) => {
    try {
      // Call appropriate templateService method based on the updates
      if (updates.param_name) {
        await templateService.updateParameterName(
          sectionId === 'shared' ? 'shared' : sectionId,
          parameterId,
          updates.param_name
        );
      }
      
      if (updates.value !== undefined) {
        await templateService.updateSingleValue(
          sectionId === 'shared' ? 'shared' : sectionId,
          parameterId,
          updates.value
        );
      }
      
      if (updates.values) {
        // Get current parameter data to check existing values
        const currentParams = await loadParametersForType(sectionId);
        const parameter = currentParams.find(p => p.id === parameterId);
        
        // For checkbox or list parameters with values object
        for (const [key, value] of Object.entries(updates.values)) {
          // Check if this is an existing value or a new one
          const isExistingValue = parameter?.values && parameter.values[key] !== undefined;
          
          if (isExistingValue) {
            // Update existing value
            await templateService.updateParameterValue(
              sectionId === 'shared' ? 'shared' : sectionId,
              parameterId,
              key,
              value
            );
          } else {
            // Add new value
            await templateService.addParameterValue(
              sectionId === 'shared' ? 'shared' : sectionId,
              parameterId,
              key,
              value
            );
          }
        }
      }
      
      // Update parameters by refreshing from templateService
      const refreshedParams = await loadParametersForType(sectionId);
      setParameters(prev => ({
        ...prev,
        [sectionId]: refreshedParams
      }));
      
      return true;
    } catch (err) {
      console.error('Error updating instruction:', err);
      error(`Failed to update instruction: ${err.message}`);
      return false;
    }
  };
  
  const handleResetTemplates = async () => {
    if (!window.confirm('Are you sure you want to reset all template customizations? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Reset all templates to default
      await templateService.resetTemplates();
      
      success('Templates reset to default');
      
      // Reload all parameters after reset
      const loadedParameters = {};
      for (const type of contentTypes) {
        loadedParameters[type.id] = await loadParametersForType(type.id);
      }
      setParameters(loadedParameters);
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
        <p className="mt-4">Loading template instructions...</p>
      </div>
    );
  }
  
  return (
    <div className="template-customization-container">
      <div className="customize-header mb-6">
        <h2 className="type-heading mb-4 pb-3 border-b border-theme text-lg font-medium">
          Customize Prompt Templates
        </h2>
        
        <div className="flex justify-between items-center mb-4">
          <p className="section-description text-theme-secondary max-w-3xl">
            Customize the default prompt templates used by the extension. These templates 
            are used when creating summaries.
          </p>
          
          <Button
            variant="danger"
            onClick={handleResetTemplates}
            className="flex-shrink-0 ml-4"
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