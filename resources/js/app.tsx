import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import axios from 'axios';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { useState, useEffect } from 'react';

function syncCsrfToken(token?: string) {
  if (token) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
    const meta = document.head.querySelector('meta[name="csrf-token"]');
    if (meta) {
      meta.setAttribute('content', token);
    }
  }
}

// Set initial token from meta tag
const initialToken = document.head
  .querySelector('meta[name="csrf-token"]')
  ?.getAttribute('content');
syncCsrfToken(initialToken ?? undefined);

// Keep token in sync after every Inertia navigation (handles session
// regeneration on login/logout)
router.on('navigate', (event) => {
  const pageToken = (event.detail.page.props as Record<string, unknown>).csrf_token;
  if (typeof pageToken === 'string') {
    syncCsrfToken(pageToken);
  }
});

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
