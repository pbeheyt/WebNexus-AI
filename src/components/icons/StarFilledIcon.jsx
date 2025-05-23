// src/components/icons/StarFilledIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function StarFilledIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.116 3.986 1.242 5.36c.386 1.664-.945 2.922-2.412 2.149L12 19.888l-4.773 2.517c-1.467.772-2.798-.485-2.412-2.149l1.242-5.36-4.116-3.986c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}

StarFilledIcon.propTypes = {
  className: PropTypes.string,
};

export default StarFilledIcon;
