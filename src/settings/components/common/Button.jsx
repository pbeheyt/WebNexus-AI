// import React from 'react';

// const Button = ({
//   children,
//   variant = 'primary',
//   size = 'md',
//   disabled = false,
//   className = '',
//   onClick,
//   ...props
// }) => {
//   // Base classes
//   const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors';
  
//   // Size classes
//   const sizeClasses = {
//     sm: 'px-2 py-1 text-xs',
//     md: 'px-4 py-2 text-sm',
//     lg: 'px-5 py-2.5 text-base'
//   };
  
//   // Variant classes
//   const variantClasses = {
//     primary: 'bg-primary text-white hover:bg-primary-hover',
//     secondary: 'bg-theme-surface text-theme-primary border border-theme hover:border-primary',
//     danger: 'bg-error text-white hover:bg-red-600',
//     success: 'bg-success text-white hover:bg-green-600',
//     inactive: 'bg-gray-400 text-gray-100 cursor-not-allowed opacity-50' // New inactive variant
//   };
  
//   // Disabled class - don't apply if using inactive variant
//   const disabledClass = disabled && variant !== 'inactive' 
//     ? 'bg-gray-500 text-gray-300 cursor-not-allowed hover:bg-gray-500' 
//     : '';
  
//   // Combined classes
//   const combinedClasses = [
//     baseClasses,
//     sizeClasses[size] || sizeClasses.md,
//     variantClasses[variant] || variantClasses.primary,
//     disabledClass,
//     className
//   ].join(' ').trim();
  
//   return (
//     <button
//       className={combinedClasses}
//       disabled={disabled}
//       onClick={disabled ? undefined : onClick}
//       {...props}
//     >
//       {children}
//     </button>
//   );
// };

// export default Button;