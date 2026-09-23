import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './presentation/styles/globals.css';
import { App } from './App';
import { registerServiceWorker } from './infrastructure/pwa/register';
import { watchSystemTheme } from './infrastructure/system/theme';

const container = document.getElementById('root');
if (!container) throw new Error('Element #root introuvable');

registerServiceWorker();
watchSystemTheme();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
