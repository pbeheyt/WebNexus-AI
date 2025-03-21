// src/components/features/DefaultPromptConfig.jsx
import { useEffect, useState } from 'react';
import { Toggle } from '../../components/Toggle';
import { useContent } from '../contexts/ContentContext';
import { useStatus } from '../contexts/StatusContext';
import configManager from '../../services/ConfigManager';

export function DefaultPromptConfig() {
  const { contentType } = useContent();
  const { notifyParameterChanged } = useStatus();
  const [parameters, setParameters] = useState({});
  const [paramOptions, setParamOptions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!contentType) return;
    
    const loadParameters = async () => {
      setIsLoading(true);
      try {
        // Load prompt builder from config manager
        await configManager.initialize();
        
        // Get parameter options for content type
        const promptBuilder = await import('../../services/PromptBuilder').then(m => m.default);
        const options = await promptBuilder.getParameterOptions(contentType);
        
        // Get default preferences
        const defaultPrefs = await promptBuilder.getDefaultPreferences(contentType);
        
        // Get user preferences
        const storageResult = await chrome.storage.sync.get('default_prompt_preferences');
        const userPrefs = storageResult.default_prompt_preferences?.[contentType] || {};
        
        // Combine defaults with user preferences
        const combinedPrefs = { ...defaultPrefs, ...userPrefs };
        
        setParamOptions(options);
        setParameters(combinedPrefs);
      } catch (error) {
        console.error('Error loading parameters:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadParameters();
  }, [contentType]);
  
  const handleParameterChange = async (paramKey, value) => {
    try {
      // Update local state
      setParameters(prev => ({
        ...prev,
        [paramKey]: value
      }));
      
      // Get existing preferences
      const result = await chrome.storage.sync.get('default_prompt_preferences');
      const preferences = result.default_prompt_preferences || {};
      
      // Update preferences for content type
      preferences[contentType] = {
        ...(preferences[contentType] || {}),
        [paramKey]: value
      };
      
      // Save to storage
      await chrome.storage.sync.set({ default_prompt_preferences: preferences });
      
      // Format value for readability
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = value ? 'enabled' : 'disabled';
      } else if (typeof value === 'string') {
        // Format camelCase strings for display
        displayValue = value.replace(/([A-Z])/g, ' $1')
          .toLowerCase().replace(/^./, str => str.toUpperCase());
      }
      
      // Show notification
      notifyParameterChanged(paramKey, displayValue);
    } catch (error) {
      console.error('Error updating parameter:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-3 bg-background-surface rounded-md border border-border">
        <div className="animate-pulse h-4 bg-gray-300 rounded w-1/2 mb-3"></div>
        <div className="animate-pulse h-8 bg-gray-300 rounded w-full mb-2"></div>
        <div className="animate-pulse h-8 bg-gray-300 rounded w-full"></div>
      </div>
    );
  }
  
  if (Object.keys(paramOptions).length === 0) {
    return (
      <div className="p-3 bg-background-surface rounded-md border border-border">
        <p className="text-text-secondary text-sm">No configurable parameters available.</p>
      </div>
    );
  }
  
  return (
    <div className="p-3 bg-background-surface rounded-md border border-border">
      <div className="space-y-2">
        {Object.entries(paramOptions).map(([key, param]) => {
          // Skip commentAnalysis for non-YouTube content types
          if (key === 'commentAnalysis' && contentType !== 'youtube') {
            return null;
          }
          
          // Skip non-configurable parameters
          if (key === 'typeSpecificInstructions') {
            return null;
          }
          
          const paramType = param.type || 'list';
          const currentValue = parameters[key];
          
          // Parameter is a checkbox (boolean)
          if (paramType === 'checkbox') {
            const isChecked = currentValue === true || currentValue === 'true';
            
            return (
              <div key={key} className="flex justify-between items-center">
                <label className="text-text-secondary text-xs">{param.param_name || key}</label>
                <Toggle
                  checked={isChecked}
                  onChange={(e) => handleParameterChange(key, e.target.checked)}
                />
              </div>
            );
          }
          
          // Parameter is a dropdown (list)
          if (paramType === 'list' && param.values) {
            return (
              <div key={key} className="flex justify-between items-center">
                <label className="text-text-secondary text-xs">{param.param_name || key}</label>
                <select
                  value={currentValue || ''}
                  onChange={(e) => handleParameterChange(key, e.target.value)}
                  className="bg-background-surface text-text-primary border border-border rounded text-xs p-1 w-28"
                >
                  {Object.entries(param.values).map(([valueKey, _]) => (
                    <option key={valueKey} value={valueKey}>
                      {valueKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          
          return null;
        })}
      </div>
    </div>
  );
}