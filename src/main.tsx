import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Buffer } from 'buffer';

// Polyfill for @react-pdf/renderer compatibility with Vite/Browser
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}
import { ensureAuth } from './firebase';

// Bootstrap the application with necessary asynchronous initialization (e.g. Auth)
const init = async () => {
  await ensureAuth();
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

init();
