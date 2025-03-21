export function RadioGroup({
  options,
  value,
  onChange,
  name,
  className = '',
}) {
  return (
    <div className={`flex bg-background-surface rounded-md overflow-hidden border border-border ${className}`}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex-1 text-center py-1 px-2 cursor-pointer transition-colors text-sm ${
            value === option.value 
              ? 'bg-primary text-white' 
              : 'hover:bg-background-hover'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}