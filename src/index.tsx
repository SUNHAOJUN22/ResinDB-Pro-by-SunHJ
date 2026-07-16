import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from '@/components/App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to start ResinDB Pro: the #root mount element is missing.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
