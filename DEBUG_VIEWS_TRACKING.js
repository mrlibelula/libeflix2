/**
 * Debug Views Tracking System
 * 
 * Copy this into browser console while watching an episode
 * to diagnose why views aren't being tracked.
 */

console.log('=== VIEWS SYSTEM DEBUG ===\n');

// 1. Check if user is authenticated
console.log('1. Authentication Check:');
console.log('   Is Authenticated:', !!window.Laravel?.user);
console.log('   User:', window.Laravel?.user);

// 2. Check if route helper exists
console.log('\n2. Route Helper Check:');
try {
  const routeUrl = route('api.views.progress.update');
  console.log('   ✓ Route helper works');
  console.log('   URL:', routeUrl);
} catch (e) {
  console.error('   ✗ Route helper failed:', e.message);
  console.log('   Fix: Run "npm run build" to regenerate routes');
}

// 3. Check video element
console.log('\n3. Video Element Check:');
const video = document.querySelector('video');
if (video) {
  console.log('   ✓ Video element found');
  console.log('   Current Time:', Math.floor(video.currentTime), 'seconds');
  console.log('   Duration:', Math.floor(video.duration), 'seconds');
  console.log('   Is Playing:', !video.paused);
  console.log('   Is Ended:', video.ended);
} else {
  console.error('   ✗ No video element found on page');
}

// 4. Check episode data (from React component props)
console.log('\n4. Episode Data Check:');
// This requires accessing React internals - may not work
const reactRoot = document.querySelector('[data-page]');
if (reactRoot) {
  try {
    const pageData = JSON.parse(reactRoot.getAttribute('data-page'));
    console.log('   Page component:', pageData.component);
    console.log('   Props keys:', Object.keys(pageData.props));
  } catch (e) {
    console.log('   Could not parse page data');
  }
}

// 5. Test API call manually
console.log('\n5. Manual API Test:');
console.log('   Run this command to test the API:');
console.log(`
axios.post(route('api.views.progress.update'), {
  type: 'episode',
  id: 1, // REPLACE WITH ACTUAL EPISODE ID
  current_time: 600,
  duration: 1320
}).then(response => {
  console.log('✓ API SUCCESS:', response.data);
}).catch(error => {
  console.error('✗ API ERROR:', error.response?.data || error.message);
  if (error.response?.status === 401) {
    console.log('→ You are not logged in!');
  } else if (error.response?.status === 419) {
    console.log('→ CSRF token expired. Refresh the page.');
  }
});
`);

// 6. Monitor network requests
console.log('\n6. Network Monitoring:');
console.log('   Open DevTools → Network tab');
console.log('   Filter by: "api/views"');
console.log('   Expected: POST request every 15 seconds while playing');

// 7. Check axios interceptors/config
console.log('\n7. Axios Configuration:');
if (window.axios) {
  console.log('   ✓ Axios is available');
  console.log('   Base URL:', window.axios.defaults.baseURL || 'default');
  console.log('   CSRF Token:', window.axios.defaults.headers.common['X-CSRF-TOKEN'] ? 'Set' : 'Missing');
} else {
  console.error('   ✗ Axios not found');
}

// 8. Listen for errors
console.log('\n8. Error Listener Active:');
console.log('   Listening for API errors...');

// Intercept axios errors
if (window.axios) {
  const originalPost = window.axios.post;
  window.axios.post = function(...args) {
    if (args[0]?.includes?.('api/views')) {
      console.log('→ Views API Call:', {
        url: args[0],
        data: args[1]
      });
    }
    return originalPost.apply(this, args)
      .then(response => {
        if (args[0]?.includes?.('api/views')) {
          console.log('← Views API Response:', response.data);
        }
        return response;
      })
      .catch(error => {
        if (args[0]?.includes?.('api/views')) {
          console.error('← Views API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
        }
        throw error;
      });
  };
  console.log('   ✓ Interceptor attached - will log all API calls');
}

console.log('\n=== DEBUG COMPLETE ===');
console.log('Play an episode and watch for API calls in console\n');

