// src/sidebar/components/Header.jsx
import { h } from 'preact';

const Header = ({ platformName, modelId }) => (
  <header class="sidebar-header">
    <div class="platform-info">
      <h3>{platformName}</h3>
      <span class="model-info">{modelId}</span>
    </div>
    <div class="header-controls">
      <button 
        type="button" 
        class="minimize-btn" 
        title="Minimize"
        onClick={() => window.dispatchEvent(new CustomEvent('sidebar:toggle'))}
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M5 11h14v2H5z"/>
        </svg>
      </button>
    </div>
  </header>
);

export default Header;