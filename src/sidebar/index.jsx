import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarApp from './SidebarApp';
// Import Tailwind CSS
import 'tailwindcss/tailwind.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);
  
  root.render(<SidebarApp />);
});