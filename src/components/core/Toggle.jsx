import React from 'react';

/**
 * Toggle switch component with properly scaled circle that adapts to Tailwind classes.
 * 
 * @param {Object} props - Component props
 * @param {boolean} [props.checked=false] - Whether toggle is checked
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Whether toggle is disabled
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  className = 'w-10 h-5',
  ...props
}) {
  return (
    <div 
      className={`relative inline-block ${className}`}
      onClick={disabled ? undefined : () => onChange(!checked)}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={() => {}} 
        disabled={disabled}
        {...props}
      />
      <span 
        className={`absolute inset-0 rounded-full transition-all select-none ${
          checked ? 'bg-primary' : 'bg-theme-hover'
        } ${disabled ? 'opacity-50' : ''}`}
      />
      <span 
        className="absolute bg-white rounded-full transition-transform duration-200 ease-in-out"
        style={{
          top: '10%',
          left: '4%',
          width: '42%',
          height: '80%',
          aspectRatio: '1',
          transform: checked ? 'translateX(120%)' : 'translateX(0)'
        }}
      />
    </div>
  );
}

export default Toggle;