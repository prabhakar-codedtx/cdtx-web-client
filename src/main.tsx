import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { store } from '@/app/store';

// Dev only: lets the state be read from the browser's console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
