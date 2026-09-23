import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { LanguageProvider } from './i18n/LanguageContext.js';
import { registerServiceWorker } from './services/serviceWorkerRegistration.js';

// Initialize MySpace Service Worker for offline app-shell caching
registerServiceWorker();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

