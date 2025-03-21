// src/components/Toggle.jsx
import React from 'react';

export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <label className={`toggle-switch ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <span className="slider"></span>
    </label>
  );
}