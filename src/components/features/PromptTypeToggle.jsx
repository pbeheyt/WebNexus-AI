import { RadioGroup } from '../ui/RadioGroup';
import { usePrompts } from '../context/PromptContext';
import { PROMPT_TYPES } from '../../shared/constants';

export function PromptTypeToggle() {
  const { promptType, changePromptType } = usePrompts();
  
  const options = [
    { value: PROMPT_TYPES.QUICK, label: 'Quick' },
    { value: PROMPT_TYPES.DEFAULT, label: 'Template' },
    { value: PROMPT_TYPES.CUSTOM, label: 'Custom' }
  ];
  
  return (
    <RadioGroup
      name="promptType"
      options={options}
      value={promptType}
      onChange={changePromptType}
    />
  );
}