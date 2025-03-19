export function StatusMessage({ message, type = 'info', className = '' }) {
  const typeClasses = {
    info: 'text-text-secondary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };
  
  return (
    <div className={`text-sm py-2 px-3 rounded bg-opacity-5 min-h-[1rem] transition-all ${typeClasses[type]} ${className}`}>
      {message}
    </div>
  );
}