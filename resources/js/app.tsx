import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import axios from 'axios';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { useEffect } from 'react';

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

// Track the in-flight visit URL so a failed Vite chunk fetch can hard-navigate.
let pendingVisitUrl: string | null = null;
router.on('before', (event) => {
  pendingVisitUrl = event.detail.visit.url.href;
});
router.on('finish', () => {
  pendingVisitUrl = null;
});

// Extend Window interface to include _scrollPositions
declare global {
  interface Window {
    _scrollPositions: Array<[string, number]>;
  }
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const pageModules = import.meta.glob('./pages/**/*.tsx');

async function resolvePage(name: string) {
  try {
    return await resolvePageComponent(`./pages/${name}.tsx`, pageModules);
  } catch (error) {
    // When the Vite dev server drops mid-session, dynamic imports fail and
    // client-side routing looks "broken". Fall back to a full page load.
    const fallbackUrl = pendingVisitUrl ?? window.location.href;
    console.warn(`[inertia] Failed to load page "${name}", recovering via full navigation.`, error);
    window.location.assign(fallbackUrl);
    return new Promise(() => {
      // Intentionally unsettled until the browser navigates away.
    });
  }
}

// This component prevents the "Cannot read properties of null (reading 'scrollRegions')" error
const ScrollRestoration = () => {
  useEffect(() => {
    const handleBeforeRender = () => {
      const scrollRegions = document.querySelectorAll('[data-scroll-region]');
      const scrollPositions = Array.from(scrollRegions).map((region): [string, number] => [
        region.id || region.getAttribute('data-scroll-region') || '',
        region.scrollTop,
      ]);

      window._scrollPositions = scrollPositions;
    };

    document.addEventListener('inertia:before-render', handleBeforeRender);
    return () => {
      document.removeEventListener('inertia:before-render', handleBeforeRender);
    };
  }, []);

  return null;
};

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) => resolvePage(name),
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
