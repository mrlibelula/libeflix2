# Analytics & Reporting System Documentation

## Overview

The Analytics & Reporting System provides comprehensive insights into user viewing behavior and content performance on the Libeflix2 platform. This admin-only feature offers real-time analytics with beautiful, interactive charts and detailed reports.

## Access Control

- **Admin Only**: The analytics system is exclusively available to users with the `admin` role
- **Location**: Accessible via Settings → Analytics (navigation item appears only for admin users)
- **Route Protection**: All analytics routes are protected by `role:admin` middleware

## Features

### 1. Overview Statistics

The dashboard displays key metrics at a glance:

- **Total Views**: All-time view count with unique viewers
- **Movie Views**: Total views for movies with percentage of total
- **Episode Views**: Total views for episodes with percentage of total
- **Average Completion Rate**: Average watch progress percentage across all content
- **Today's Views**: View count for the current day
- **This Week's Views**: View count for the current week
- **This Month's Views**: View count for the current month
- **Engagement Rate**: Percentage of registered users who have watched content

### 2. Trends Analysis

#### Views Over Time
- **Chart Type**: Area chart with gradient fill
- **Time Ranges**: 7 days, 30 days (default), 90 days
- **Data**: Daily view counts with smooth curve interpolation
- **Features**: Zoom, pan, and interactive tooltips

#### Hourly Distribution
- **Chart Type**: Line chart
- **Data**: Views by hour of day (last 30 days)
- **Purpose**: Identify peak viewing hours
- **Use Case**: Optimize content release timing and server resources

#### Weekly Distribution
- **Chart Type**: Bar chart
- **Data**: Views by day of week (last 30 days)
- **Purpose**: Identify peak viewing days
- **Use Case**: Schedule maintenance and optimize content releases

### 3. Content Analytics

#### Views by Content Type
- **Chart Type**: Donut chart
- **Data**: Distribution between movie and episode views
- **Features**: Interactive segments, percentage display

#### Completion Rate Distribution
- **Chart Type**: Bar chart
- **Data**: Watch progress grouped into ranges (0-25%, 26-50%, 51-75%, 76-99%, 100%)
- **Purpose**: Understand user engagement levels
- **Use Case**: Identify content that users complete vs abandon

#### Most Viewed Movies
- **Display**: Top 10 ranked list
- **Data**: Movie title, view count
- **Time Filter**: Respects selected time range (7/30/90 days)
- **Purpose**: Identify popular content

#### Most Viewed Episodes
- **Display**: Top 10 ranked list
- **Data**: TV show name, season/episode number, episode title, view count
- **Time Filter**: Respects selected time range
- **Purpose**: Identify popular episodes and shows

### 4. User Engagement

#### User Statistics
- **Total Users**: All registered users
- **Active Users**: Users who have watched at least one piece of content
- **Users with Progress**: Users currently watching content
- **Average Views per User**: Among active users only

#### Most Active Users
- **Display**: Top 5 ranked list
- **Data**: User name, email, total view count
- **Purpose**: Identify power users and engagement patterns

### 5. Recent Activity

#### Recent Views
- **Display**: Last 20 views in chronological order
- **Data**: 
  - Content title
  - Content type (Movie/Episode)
  - User name
  - Time (human-readable relative time)
- **Purpose**: Real-time monitoring of platform activity

## Backend API Endpoints

All endpoints require authentication and admin role (`middleware: ['auth', 'role:admin']`)

### Base Route: `/api/analytics`

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/overview` | GET | Get overview statistics | None |
| `/views-over-time` | GET | Get daily views | `days` (default: 30) |
| `/views-by-content-type` | GET | Get views by type | None |
| `/most-viewed-movies` | GET | Get top movies | `limit` (default: 10), `days` (optional) |
| `/most-viewed-episodes` | GET | Get top episodes | `limit` (default: 10), `days` (optional) |
| `/user-engagement` | GET | Get user metrics | None |
| `/recent-views` | GET | Get recent views | `limit` (default: 20) |
| `/completion-rate-distribution` | GET | Get completion ranges | None |
| `/hourly-distribution` | GET | Get hourly views | None (last 30 days) |
| `/weekly-distribution` | GET | Get weekly views | None (last 30 days) |

### Response Formats

#### Overview Response
```json
{
  "total_views": 1234,
  "total_unique_viewers": 456,
  "total_movie_views": 789,
  "total_episode_views": 445,
  "total_watch_progress": 234,
  "avg_completion_rate": 67.45,
  "views_today": 23,
  "views_this_week": 156,
  "views_this_month": 678
}
```

#### Views Over Time Response
```json
[
  {
    "date": "2025-11-01",
    "count": 45
  },
  {
    "date": "2025-11-02",
    "count": 52
  }
]
```

#### Most Viewed Movies Response
```json
[
  {
    "id": 123,
    "title": "Movie Title",
    "poster_path": "/path/to/poster.jpg",
    "views_count": 234
  }
]
```

## Frontend Components

### Main Component
- **File**: `resources/js/pages/settings/analytics.tsx`
- **Layout**: `SettingsFullWidthLayout` (for maximum chart visibility)
- **State Management**: React hooks with axios for data fetching
- **Charts**: ApexCharts via `react-apexcharts`

### Layout Components
- **File**: `resources/js/layouts/settings/full-width-layout.tsx`
- **Purpose**: Provides full-width content area for charts and tables
- **Navigation**: Includes analytics tab for admin users only

### UI Components Used
- **Card**: Container for chart sections
- **Tabs**: Organize content into categories (Trends, Content, Engagement, Recent Activity)
- **Badge**: Display metrics and counts
- **Skeleton**: Loading states
- **Icons**: Lucide React icons for visual indicators

## Chart Library

### ApexCharts
- **Installation**: `npm install apexcharts react-apexcharts`
- **Version**: Latest stable
- **Features**:
  - Interactive and responsive
  - Multiple chart types (area, line, bar, donut)
  - Gradient fills and animations
  - Zoom and pan capabilities
  - Mobile-friendly
  - Dark mode support

### Chart Types Used
1. **Area Chart**: Views over time with gradient fill
2. **Line Chart**: Hourly distribution with smooth curves
3. **Bar Chart**: Weekly distribution and completion rates
4. **Donut Chart**: Content type distribution

## Database Queries

The analytics system leverages the existing Views System:

### Key Models
- `View`: Confirmed views (polymorphic: Movie/Episode)
- `WatchProgress`: Real-time playback progress
- `User`: User information and relationships
- `Movie`: Movie data
- `Episode`: Episode data with TV show relationships

### Optimizations
- **Indexes**: Efficient queries on viewable_type, user_id, viewed_at
- **Aggregations**: Use of GROUP BY and database-level counting
- **Date Ranges**: Filtered queries for performance
- **Eager Loading**: Relationships loaded efficiently

## Performance Considerations

1. **Data Caching**: Consider implementing caching for overview stats
2. **Query Optimization**: All queries use proper indexes
3. **Pagination**: Recent views limited to 20 items
4. **Date Filtering**: Hourly and weekly distributions limited to 30 days
5. **Parallel Requests**: Frontend fetches all data in parallel using `Promise.all()`

## Future Enhancements

Potential features for future versions:

1. **Export Reports**: PDF/CSV export functionality
2. **Custom Date Ranges**: Allow admins to select specific date ranges
3. **Content Comparison**: Compare performance of multiple items
4. **Geographic Analytics**: Views by location (if tracking)
5. **Revenue Analytics**: Link views to subscription conversions
6. **Predictive Analytics**: Forecast trending content
7. **Real-time Dashboard**: WebSocket-based live updates
8. **Email Reports**: Scheduled analytics reports
9. **Advanced Filters**: Filter by genre, rating, release date
10. **A/B Testing**: Content thumbnail/title testing analytics

## Usage Guidelines

### For Administrators

1. **Daily Monitoring**: Check recent views and today's statistics
2. **Content Strategy**: Use most viewed reports to inform content acquisition
3. **User Engagement**: Monitor engagement rate and active users
4. **Peak Times**: Use hourly/weekly distribution to optimize operations
5. **Content Quality**: Use completion rates to identify engaging vs. abandoned content

### Best Practices

1. **Regular Reviews**: Check analytics weekly for trends
2. **Action on Insights**: Use data to drive content decisions
3. **Monitor Trends**: Look for patterns in viewing behavior
4. **User Feedback**: Combine analytics with user feedback
5. **Content Lifecycle**: Track content performance over time

## Troubleshooting

### Common Issues

**Issue**: Charts not rendering
- **Solution**: Check browser console for errors, ensure ApexCharts is installed

**Issue**: No data displayed
- **Solution**: Verify database has views data, check API responses in network tab

**Issue**: Analytics not showing for admin user
- **Solution**: Verify user has admin role, refresh roles cache

**Issue**: Slow loading times
- **Solution**: Check database indexes, consider implementing caching

## Security

- **Role-Based Access**: Only admin users can access analytics
- **Middleware Protection**: All routes protected at Laravel level
- **Data Privacy**: User emails only shown to admins
- **API Security**: All endpoints require authentication

## Technical Stack

- **Backend**: Laravel 12, PHP 8.x
- **Frontend**: React 18, TypeScript
- **Charts**: ApexCharts 3.x
- **UI Components**: shadcn/ui
- **Routing**: Inertia.js
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Styling**: Tailwind CSS

## Maintenance

### Regular Tasks
1. Monitor database size and implement archiving if needed
2. Review query performance and optimize as needed
3. Update chart configurations based on user feedback
4. Add new metrics as platform evolves

### Updates
- Keep ApexCharts updated for bug fixes and features
- Monitor Laravel updates for performance improvements
- Review analytics needs quarterly and add features as needed

---

**Last Updated**: November 19, 2025  
**Version**: 1.0  
**Maintainer**: Libeflix2 Development Team

