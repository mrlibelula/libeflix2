import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Extend Window interface to include _scrollPositions and axios
declare global {
  interface Window {
    _scrollPositions: Array<[string, number]>;
    axios: typeof axios;
  }
}

// Set up CSRF token for all requests
window.axios = axios;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.withCredentials = true;

// Enhanced CSRF token handling for Brave browser compatibility
function getCSRFToken(): string | null {
  // Try multiple methods to get CSRF token
  let token = null;
  
  // Method 1: Meta tag (most reliable)
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    token = metaTag.getAttribute('content');
  }
  
  // Method 2: Try from cookies (fallback)
  if (!token) {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }
  
  // Method 3: Try from Laravel's default method
  if (!token && (window as any).Laravel && (window as any).Laravel.csrfToken) {
    token = (window as any).Laravel.csrfToken;
  }
  
  if (!token) {
    console.warn('CSRF token not found - this may cause 419 errors');
  }
  
  return token;
}

// Set up initial CSRF token
const csrfToken = getCSRFToken();
if (csrfToken) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
    axios.defaults.headers.common['X-XSRF-TOKEN'] = csrfToken;
}

// Add axios interceptor for automatic CSRF token refresh
axios.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 419 CSRF token mismatch errors
    if (error.response?.status === 419 && !originalRequest._retry) {
      console.warn('CSRF token expired, attempting to refresh...');
      originalRequest._retry = true;
      
      try {
        // Fetch new CSRF token
        const response = await axios.get('/csrf-token', {
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        const newToken = response.data.csrf_token;
        if (newToken) {
          // Update axios defaults
          axios.defaults.headers.common['X-CSRF-TOKEN'] = newToken;
          axios.defaults.headers.common['X-XSRF-TOKEN'] = newToken;
          
          // Update meta tag
          const metaTag = document.querySelector('meta[name="csrf-token"]');
          if (metaTag) {
            metaTag.setAttribute('content', newToken);
          }
          
          // Update original request headers
          originalRequest.headers['X-CSRF-TOKEN'] = newToken;
          originalRequest.headers['X-XSRF-TOKEN'] = newToken;
          
          console.log('CSRF token refreshed successfully');
          
          // Retry the original request
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh CSRF token:', refreshError);
        // If token refresh fails, redirect to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Configure Inertia.js to include CSRF token in form requests
import { router } from '@inertiajs/react';

// Enhanced Inertia CSRF token handling
router.on('before', (event) => {
  const token = getCSRFToken();
  
  if (token && event.detail.visit.method !== 'get') {
    // Add token to request headers
    if (!event.detail.visit.headers) {
      event.detail.visit.headers = {};
    }
    event.detail.visit.headers['X-CSRF-TOKEN'] = token;
    event.detail.visit.headers['X-XSRF-TOKEN'] = token;
    
    // Ensure CSRF token is included in form data
    if (event.detail.visit.data instanceof FormData) {
      event.detail.visit.data.append('_token', token);
    } else if (typeof event.detail.visit.data === 'object' && event.detail.visit.data !== null) {
      event.detail.visit.data._token = token;
    } else {
      // Create new object with token if data is null/undefined
      event.detail.visit.data = { _token: token };
    }
  }
});

// Handle CSRF token errors in Inertia responses
router.on('error', (event) => {
  if (event.detail.errors && typeof event.detail.errors === 'object') {
    // Check for 419 status or CSRF-related errors
    const is419Error = Object.values(event.detail.errors).some(error => 
      typeof error === 'string' && (
        error.includes('419') || 
        error.includes('CSRF') || 
        error.includes('token') ||
        error.includes('expired')
      )
    );
    
    if (is419Error) {
      console.warn('CSRF error detected in Inertia response, refreshing page...');
      // Force page reload to get fresh CSRF token
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
});

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
