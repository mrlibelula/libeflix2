# Testing Views System API

## Issue
User played an episode from beginning to end but:
- 0 views shown for that episode
- No records in `views` or `watch_progress` tables

## Diagnostic Steps

### 1. Check Browser Console
Open DevTools (F12) while playing an episode and look for:
- **Network Tab**: Check if POST requests to `/api/views/progress` are being made every 15 seconds
- **Console Tab**: Look for any JavaScript errors

### 2. Manual API Test

Open browser console and run this while on the episode player page:

```javascript
// Test if route helper works
console.log('Route:', route('api.views.progress.update'));

// Test API call manually
axios.post(route('api.views.progress.update'), {
  type: 'episode',
  id: 1, // Replace with actual episode ID
  current_time: 600,
  duration: 1320
}).then(response => {
  console.log('SUCCESS:', response.data);
}).catch(error => {
  console.error('ERROR:', error.response?.data || error.message);
});
```

### 3. Check Laravel Logs

```bash
# Clear log
echo "" > storage/logs/laravel.log

# Play episode for 15+ seconds
# Then check log:
tail -n 50 storage/logs/laravel.log
```

### 4. Test with Tinker

```bash
php artisan tinker
```

Then run:

```php
// Create test user and episode
$user = User::first();
$episode = Episode::first();

// Check if episode has Viewable trait
$episode->viewsCount();

// Manually test the service
use App\Services\ViewService;
ViewService::updateProgress($episode, $user, 1000, 1320);

// Check database
DB::table('watch_progress')->count();
DB::table('views')->count();
```

### 5. Verify Route Is Protected by Auth

The routes require authentication. Check if:
- User is logged in when playing episode
- Session is valid
- CSRF token is being sent

### 6. Check Episode ID

Verify the episode ID being sent in the request:

```javascript
// In browser console while episode is playing
console.log('Episode ID:', episode?.id);
```

## Common Issues

### Issue 1: Route Helper Not Defined
**Symptom**: Console error "route is not defined"  
**Fix**: Run `npm run build` to regenerate Ziggy routes

### Issue 2: 401 Unauthorized
**Symptom**: API returns 401  
**Fix**: User is not authenticated. Check login status.

### Issue 3: CSRF Token Mismatch
**Symptom**: 419 error  
**Fix**: Refresh page to get new CSRF token

### Issue 4: Video Never Plays
**Symptom**: No API calls at all  
**Fix**: Check if video `play` event is firing

### Issue 5: Episode ID is undefined
**Symptom**: API call fails with "id is required"  
**Fix**: Episode data not loaded properly

## Expected Behavior

When playing an episode:

1. **On Play**: Immediate API call to update progress
2. **Every 15s**: API call while video is playing
3. **On Pause**: API call to save current progress
4. **On End**: Final API call

When **70%** of episode is watched (or **10+ minutes** for short content):
- A record is created in `views` table
- `watch_progress.completed` is set to `true`
- `views_count` for that episode increments by 1

## Quick Fix Test

Run this test to verify the system works:

```bash
php artisan test tests/Feature/ViewsSystemTest.php
```

All tests should pass. If they do, the API is working and the issue is in the frontend tracking.

