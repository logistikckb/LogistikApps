import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { PwaProvider } from './context/PwaContext.tsx';
import { BroadcastProvider } from './context/BroadcastContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { registerServiceWorker } from './pwa.ts';
import './index.css';

// Register PWA Service Worker
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <PwaProvider>
            <BroadcastProvider>
              <App />
            </BroadcastProvider>
          </PwaProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
