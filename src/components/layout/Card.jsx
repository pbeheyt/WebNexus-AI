// src/components/layout/Card.jsx
import React from 'react';

/**
 * Card container component with header and content sections.
 */
export function Card({ 
  children, 
  className = '',
  ...props 
}) {
  return (
    <div 
      className={`bg-theme-surface rounded-lg border border-theme shadow-theme-light ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card header component.
 */
export function CardHeader({ 
  children, 
  className = '',
  ...props 
}) {
  return (
    <div 
      className={`px-4 py-3 border-b border-theme ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card title component.
 */
export function CardTitle({ 
  children, 
  className = '',
  ...props 
}) {
  return (
    <h3 
      className={`text-lg font-medium ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * Card content component.
 */
export function CardContent({ 
  children, 
  className = '',
  ...props 
}) {
  return (
    <div 
      className={`p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}