// src/components/features/PromptTypeToggle.jsx
import { RadioGroup } from '../ui/RadioGroup';
import { usePrompts } from '../context/PromptContext';
import { useStatus } from '../context/StatusContext';
import { PROMPT_TYPES } from '../../shared/constants';

export function PromptTypeToggle() {
  const { promptType, changePromptType } = usePrompts();
  const { notifyPromptTypeToggled } = useStatus();
  
  const options = [
    { value: PROMPT_TYPES.QUICK, label: 'Quick' },
    { value: PROMPT_TYPES.DEFAULT, label: 'Template' },
    { value: PROMPT_TYPES.CUSTOM, label: 'Custom' }
  ];
  
  const handleTypeChange = async (type) => {
    const success = await changePromptType(type);
    if (success) {
      notifyPromptTypeToggled(type);
    }
  };
  
  return (
    <RadioGroup
      name="promptType"
      options={options}
      value={promptType}
      onChange={handleTypeChange}
    />
  );
}