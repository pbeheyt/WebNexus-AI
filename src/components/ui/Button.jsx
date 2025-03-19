export function Button({
  children,
  variant = 'primary',
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  // Base classes
  const baseClasses = 'btn';
  
  // Variant classes
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'bg-error text-white hover:bg-red-600',
  };
  
  // Disabled classes
  const disabledClasses = disabled 
    ? 'bg-gray-500 text-gray-300 cursor-not-allowed hover:bg-gray-500' 
    : '';
  
  // Combined classes
  const combinedClasses = [
    baseClasses,
    variantClasses[variant] || variantClasses.primary,
    disabledClasses,
    className
  ].join(' ').trim();
  
  return (
    <button
      className={combinedClasses}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {children}
    </button>
  );
}