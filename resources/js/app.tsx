import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';


// Extend Window interface to include _scrollPositions
declare global {
  interface Window {
    _scrollPositions: Array<[string, number]>;
  }
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// This component prevents the "Cannot read properties of null (reading 'scrollRegions')" error
const ScrollRestoration = () => {
  document.addEventListener('inertia:before-render', () => {
    const scrollRegions = document.querySelectorAll('[data-scroll-region]');
    const scrollPositions = Array.from(scrollRegions).map((region): [string, number] => [
      region.id || region.getAttribute('data-scroll-region') || '',
      region.scrollTop,
    ]);

    window._scrollPositions = scrollPositions;
  });

  return null;
};

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
  setup({ el, App, props }) {
    const root = createRoot(el);

    root.render(
      <>
        <ScrollRestoration />
        <App {...props} />
      </>
    );
  },
  progress: {
    color: '#ff2056',
    showSpinner: true,
    delay: 0,
    includeCSS: true,
  },
});

// This will set light / dark mode on load...
initializeTheme();

// When the page is loaded, hide the global loader
window.addEventListener('load', () => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }
});
