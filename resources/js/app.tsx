import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Set up CSRF token for all requests
window.axios = axios;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Get CSRF token from meta tag and set it up for axios
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (csrfToken) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
} else {
    console.error('CSRF token not found: https://laravel.com/docs/csrf#csrf-x-csrf-token');
}

// Configure Inertia.js to include CSRF token in form requests
import { router } from '@inertiajs/react';

// Set up Inertia to automatically include CSRF token
router.on('before', (event) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (token && event.detail.visit.method !== 'get') {
    // Ensure CSRF token is included in form data
    if (event.detail.visit.data instanceof FormData) {
      event.detail.visit.data.append('_token', token);
    } else if (typeof event.detail.visit.data === 'object' && event.detail.visit.data !== null) {
      event.detail.visit.data._token = token;
    }
  }
});


// Extend Window interface to include _scrollPositions and axios
declare global {
  interface Window {
    _scrollPositions: Array<[string, number]>;
    axios: typeof axios;
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

// Clear browser storage function
const clearBrowserStorage = () => {
  try {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear any episode or content caches
    const cacheKeys = Object.keys(localStorage);
    cacheKeys.forEach(key => {
      if (key.includes('episode') || key.includes('content') || key.includes('cache')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('Browser storage cleared successfully');
  } catch (error) {
    console.warn('Could not clear browser storage:', error);
  }
};

// Storage clear hook
const useClearStorageOnLogout = () => {
  const [previousUserId, setPreviousUserId] = useState<number | null>(null);
  
  useEffect(() => {
    // Get current user from window object if available
    const getCurrentUserId = () => {
      try {
        const pageProps = (window as any)?.InertiaApp?.props?.auth?.user?.id;
        return pageProps || null;
      } catch {
        return null;
      }
    };
    
    const currentUserId = getCurrentUserId();
    
    // If user changed (logged out or different user logged in)
    if (previousUserId !== null && currentUserId !== previousUserId) {
      clearBrowserStorage();
    }
    
    setPreviousUserId(currentUserId);
  }, [previousUserId]);
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
