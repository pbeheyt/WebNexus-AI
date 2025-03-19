import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import ContentTypeAccordion from '../ui/ContentTypeAccordion';
import SettingsForm from '../ui/SettingsForm';

const ContentConfiguration = () => {
  const { error } = useNotification();
  const [redditSettings, setRedditSettings] = useState({ maxComments: 100 });
  const [youtubeSettings, setYoutubeSettings] = useState({ maxComments: 20 });
  const [expandedSections, setExpandedSections] = useState({
    reddit: true,
    youtube: true
  });
  
  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get('custom_prompts_by_type');
        const customPromptsByType = result.custom_prompts_by_type || {};
        
        // Extract settings
        if (customPromptsByType.reddit?.settings) {
          setRedditSettings(customPromptsByType.reddit.settings);
        }
        
        if (customPromptsByType.youtube?.settings) {
          setYoutubeSettings(customPromptsByType.youtube.settings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        error('Failed to load settings');
      }
    };
    
    loadSettings();
  }, [error]);
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const updateRedditSettings = async (newSettings) => {
    try {
      const result = await chrome.storage.sync.get('custom_prompts_by_type');
      const customPromptsByType = result.custom_prompts_by_type || {};
      
      // Update reddit settings
      customPromptsByType.reddit = {
        ...(customPromptsByType.reddit || {}),
        settings: {
          ...(customPromptsByType.reddit?.settings || {}),
          ...newSettings
        }
      };
      
      await chrome.storage.sync.set({ custom_prompts_by_type: customPromptsByType });
      setRedditSettings(customPromptsByType.reddit.settings);
      return true;
    } catch (err) {
      console.error('Error updating Reddit settings:', err);
      error('Failed to update Reddit settings');
      return false;
    }
  };
  
  const updateYoutubeSettings = async (newSettings) => {
    try {
      const result = await chrome.storage.sync.get('custom_prompts_by_type');
      const customPromptsByType = result.custom_prompts_by_type || {};
      
      // Update youtube settings
      customPromptsByType.youtube = {
        ...(customPromptsByType.youtube || {}),
        settings: {
          ...(customPromptsByType.youtube?.settings || {}),
          ...newSettings
        }
      };
      
      await chrome.storage.sync.set({ custom_prompts_by_type: customPromptsByType });
      setYoutubeSettings(customPromptsByType.youtube.settings);
      return true;
    } catch (err) {
      console.error('Error updating YouTube settings:', err);
      error('Failed to update YouTube settings');
      return false;
    }
  };
  
  return (
    <div>
      <h2 className="type-heading mb-4 pb-3 border-b border-theme text-lg font-medium">Content Extraction Settings</h2>
      
      <ContentTypeAccordion
        title="Reddit Posts"
        expanded={expandedSections.reddit}
        onToggle={() => toggleSection('reddit')}
      >
        <SettingsForm
          settings={redditSettings}
          updateSettings={updateRedditSettings}
          fields={[
            {
              key: 'maxComments',
              label: 'Maximum Comments:',
              type: 'number',
              min: 1,
              max: 1000,
              helpText: 'Number of comments to extract from Reddit posts'
            }
          ]}
        />
      </ContentTypeAccordion>
      
      <ContentTypeAccordion
        title="YouTube Videos"
        expanded={expandedSections.youtube}
        onToggle={() => toggleSection('youtube')}
      >
        <SettingsForm
          settings={youtubeSettings}
          updateSettings={updateYoutubeSettings}
          fields={[
            {
              key: 'maxComments',
              label: 'Maximum Comments:',
              type: 'number',
              min: 1,
              max: 1000,
              helpText: 'Number of comments to extract from YouTube videos'
            }
          ]}
        />
      </ContentTypeAccordion>
    </div>
  );
};

export default ContentConfiguration;