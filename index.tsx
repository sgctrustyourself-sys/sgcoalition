import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Fade out the inline loader (defined in index.html) before mounting React,
// so the loader doesn't get instantly replaced and cause a visual flash.
const loader = document.getElementById('initial-loader');
if (loader) {
  // Guard so the transitionend listener and the safety-net timeout
  // can't both call renderApp().
  let mounted = false;
  const mount = () => {
    if (mounted) return;
    mounted = true;
    renderApp();
  };

  // Attach the listener BEFORE toggling opacity so we can't miss
  // the event if the browser ever starts transitions synchronously.
  loader.addEventListener('transitionend', mount, { once: true });

  // Kick off the CSS opacity transition defined on #initial-loader.
  loader.style.opacity = '0';

  // Safety net: if `transitionend` never fires (e.g. reduced-motion
  // preference, hot reload, or element already at opacity 0), still
  // mount. The 600ms must stay > the 0.5s CSS transition in index.html.
  setTimeout(mount, 600);
} else {
  renderApp();
}