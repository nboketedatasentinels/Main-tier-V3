# Weekly Points Setup Guide

## Overview

The Weekly Points feature tracks user progress on a weekly basis, showing:
- Points earned this week
- Target points for the week
- Engagement count (completed activities)
- Status (on_track, warning, at_risk)

## Database Structure

The `weekly_points` collection stores weekly point data with the following structure:

```typescript
{
  user_id: string
  week_number: number         // ISO week number (1-53)
  week_year: number          // Year
  points_earned: number      // Points earned this week
  target_points: number      // Weekly target (from journey)
  engagement_count: number   // Number of completed activities
  status: 'on_track' | 'warning' | 'at_risk'
  week_start: Timestamp
  week_end: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}
```

## How It Works

1. **Automatic Initialization**: When a user visits the Weekly Glance page, the system automatically creates a `weekly_points` record for the current week if one doesn't exist.

2. **Target Points**: The weekly target is pulled from the user's current journey. The standard 6-week sprint target is **4,000 points** (the minimum expectation), and 4,000 is also used as the default if no journey is set.

3. **Status Calculation**:
   - `on_track`: >= 70% of target
   - `warning`: 40-69% of target
   - `at_risk`: < 40% of target

4. **Real-time Updates**: The Weekly Points card uses Firestore's real-time listeners to automatically update when data changes.

## 6-Week Journey Targets & Completion Rules

- **Weekly target (minimum)**: 4,000 points per week for the 6-week sprint, anchored around common activities like podcasts, peer matching, and LinkedIn posts.
- **Maximum achievable**: 36,000 points across six weeks (about 6,000 per week) when participants mix higher-value activities alongside the core cadence.
- **Pass threshold**: 67% of the six-week maximum (24,120 points) is the completion bar for the course.
- **Rationale**: The 4,000-point floor keeps users engaged without overwhelming participants who are also working full-time, while still allowing motivated learners to push higher.

## Setting Up Test Data

### Option 1: Using Firebase Console

1. Go to your Firebase Console > Firestore Database
2. Create a document in the `weekly_points` collection with these fields:
   - `user_id`: Your user UID
   - `week_number`: Current ISO week (e.g., 50)
   - `week_year`: Current year (e.g., 2024)
   - `points_earned`: Any number (e.g., 1500)
   - `target_points`: Target (e.g., 4000)
   - `engagement_count`: Number of activities (e.g., 5)
   - `status`: "on_track" or "warning" or "at_risk"
   - `week_start`: Timestamp of this week's Monday
   - `week_end`: Timestamp of this week's Sunday
   - `created_at`: Current timestamp
   - `updated_at`: Current timestamp

### Option 2: Using the Service

The application automatically calls `getOrCreateWeeklyPoints(userId)` when needed. You can also manually trigger updates by calling `updateWeeklyPoints(userId)` from your code.

## Updating Weekly Points

To update weekly points based on actual user activity:

```typescript
import { updateWeeklyPoints } from '@/services/weeklyPointsService'

// Call this after a user completes an activity
await updateWeeklyPoints(userId)
```

This function will:
1. Calculate points earned this week from the `user_points` collection
2. Count completed activities from the `weeklyActivities` subcollection
3. Calculate the status based on progress
4. Update the `weekly_points` record

## Testing

1. **Create a user account** and log in
2. **Navigate to Weekly Glance** page (/app/weekly-glance)
3. The system will automatically create a weekly_points record with:
   - 0 points earned
   - Default target of 4000 points
   - Status: at_risk

4. **Add test points** by creating records in `user_points`:
   ```typescript
   {
     userId: "your-user-id",
     source: "test_activity",
     points: 1000,
     recordedAt: Timestamp.now()
   }
   ```

5. **Trigger an update** by calling:
   ```typescript
   import { updateWeeklyPoints } from '@/services/weeklyPointsService'
   await updateWeeklyPoints('your-user-id')
   ```

6. The Weekly Points card should update automatically via real-time listener

## Firestore Indexes

Make sure to create these composite indexes in Firebase Console:

1. Collection: `weekly_points`
   - Fields: `user_id` (Ascending), `week_number` (Ascending)

2. Collection: `weekly_points`
   - Fields: `user_id` (Ascending), `week_year` (Ascending), `week_number` (Ascending)

3. Collection: `user_points`
   - Fields: `userId` (Ascending), `recordedAt` (Descending)

## Security Rules

The following security rules are already included in the schema:

```javascript
match /weekly_points/{weeklyPointsId} {
  allow read: if isAuthenticated() && (request.auth.uid == resource.data.user_id || hasRole('super_admin'));
  allow create, update: if isAuthenticated() && (request.resource.data.user_id == request.auth.uid || hasRole('super_admin'));
}
```

This ensures users can only read and update their own weekly points data.
