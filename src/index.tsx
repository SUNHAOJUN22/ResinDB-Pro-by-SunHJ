
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// Fix: Import App from components directory where it is correctly defined with Providers and a default export
import App from '@/components/App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Suppress Framer Motion color interpolation warnings for Tailwind v4 oklch/oklab colors
// and ECharts unreadable tick warnings for dynamic auto scales
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string') {
    if (args[0].includes('is not an animatable color')) return;
    if (args[0].includes('The ticks may be not readable')) return;
    if (args[0].includes("Can't get DOM width or height")) return;
  }
  originalConsoleWarn(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
