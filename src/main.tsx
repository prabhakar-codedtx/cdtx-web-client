import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { store } from '@/app/store';
import { startServiceWorker } from '@/lib/pwa';

// Dev only: lets the state be read from the browser's console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;

// A new deploy reaches the viewer on the visit it is found on (the page reloads once).
startServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
