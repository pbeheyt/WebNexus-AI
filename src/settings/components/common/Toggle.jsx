// import React from 'react';

// const Toggle = ({
//   checked = false,
//   onChange,
//   disabled = false,
//   className = '',
//   ...props
// }) => {
//   return (
//     <label className={`relative inline-block w-10 h-5 ${className}`}>
//       <input
//         type="checkbox"
//         className="opacity-0 w-0 h-0"
//         checked={checked}
//         onChange={onChange}
//         disabled={disabled}
//         {...props}
//       />
//       <span className={`absolute cursor-pointer inset-0 rounded-full transition-all ${
//           checked ? 'bg-primary' : 'bg-theme-hover'
//         } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
//         <span className={`absolute h-4 w-4 bg-white rounded-full transition-transform duration-200 ease-in-out transform ${
//             checked ? 'translate-x-5' : 'translate-x-0.5'
//           } top-0.5 left-0`}
//         />
//       </span>
//     </label>
//   );
// };

// export default Toggle;