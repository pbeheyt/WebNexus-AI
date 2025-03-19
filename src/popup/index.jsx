import { createRoot } from 'react-dom/client';
import { AppProvider } from '../components/providers/AppProvider';
import { Popup } from './Popup';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  
  root.render(
    <AppProvider>
      <Popup />
    </AppProvider>
  );
});