# Weekly Points Feature - Testing Guide

## What Was Implemented

The Weekly Points card on the Weekly Glance page now displays real-time data from your Firestore database.

### Components Created/Updated:

1. **Weekly Points Service** (`src/services/weeklyPointsService.ts`)
   - `getOrCreateWeeklyPoints(userId)` - Creates weekly points record if it doesn't exist
   - `updateWeeklyPoints(userId)` - Recalculates and updates weekly points from user activities
   - `calculateWeeklyStatus()` - Determines if user is on_track, warning, or at_risk

2. **Database Schema** (`database/firestore-schema.md`)
   - Added `weekly_points` collection definition
   - Added security rules for the collection
   - Added composite indexes for queries

3. **Hook Updates** (`src/hooks/useWeeklyGlanceData.ts`)
   - Added automatic initialization of weekly points on page load
   - Updated query to include `week_year` field
   - Added real-time listener for instant updates

## Current Scoring Model (6-Week Sprint)

- **Minimum points required per week**: 4,000 points, built around the core activity mix of podcasts, peer matching, and LinkedIn engagement.
- **Maximum over six weeks**: 36,000 points when participants layer in the higher-value activities (roughly a 6,000-point weekly ceiling at full cadence).
- **Completion threshold**: 67% of the six-week maximum (24,120 points) to pass the course while keeping expectations realistic for full-time professionals.

### Activity Cadence and Caps
These caps are visible to participants and coaches so expectations are clear:

| Activity | Points per completion | Recommended cadence | Point cap (per month) |
| --- | --- | --- | --- |
| Watch/listen to podcast | 1,000 | Weekly | 3,000 |
| Complete podcast workbook | 1,000 | Weekly (paired with podcast) | 3,000 |
| Attend webinar | 2,000 | Monthly | 2,000 |
| Complete webinar workbook | 2,000 | Monthly (paired with webinar) | 2,000 |
| Peer Matching | 1,000 | Weekly | 4,000 |
| Book Club Participation | 1,500 | Monthly | 1,500 |
| Peer to Peer Session | 2,500 | Monthly | 2,500 |
| LinkedIn engagement (post/comment) | 500 | Twice monthly | 1,000 |
| LIFT Course Module Completed | 3,000 | Monthly | 3,000 |

At the recommended cadence, participants consistently hit the 4,000-point minimum while understanding that the weekly ceiling hovers around 6,000 points when stacking higher-value items (e.g., a webinar or LIFT module).

## How to Test

### Step 1: Set Up Firestore Indexes

Before testing, you need to create composite indexes in Firebase Console:

1. Go to Firebase Console → Firestore Database → Indexes
2. Create these composite indexes:

**Index 1:**
- Collection: `weekly_points`
- Fields: `user_id` (Ascending), `week_number` (Ascending), `week_year` (Ascending)

**Index 2:**
- Collection: `user_points`
- Fields: `userId` (Ascending), `recordedAt` (Descending)

### Step 2: Test with Manual Data Entry

**Method A: Using Firebase Console**

1. Navigate to Firestore Database in Firebase Console
2. Click "Start collection" and name it `weekly_points`
3. Add a document with your user ID and these fields:

```javascript
{
  user_id: "YOUR_USER_UID",           // Your Firebase Auth UID
  week_number: 50,                     // Current ISO week number
  week_year: 2024,                     // Current year
  points_earned: 1500,                 // Example: 1500 points
  target_points: 4000,                 // Minimum points required per week (6-week sprint baseline)
  engagement_count: 5,                 // Number of activities completed
  status: "warning",                   // on_track, warning, or at_risk
  week_start: [Timestamp],             // Monday of this week
  week_end: [Timestamp],               // Sunday of this week
  created_at: [Current Timestamp],
  updated_at: [Current Timestamp]
}
```

4. Visit the Weekly Glance page - you should see your data displayed

**Method B: Using the Populate Script**

1. Make sure you have at least one user account created
2. The app will automatically create a weekly_points record when you visit `/app/weekly-glance`
3. To add test points data, run:

```bash
# Create sample user_points records in Firebase Console
# Collection: user_points
{
  userId: "YOUR_USER_UID",
  source: "test_activity",
  points: 1000,
  recordedAt: [Current Timestamp]
}
```

### Step 3: Test Real-Time Updates

1. Open the Weekly Glance page in your browser
2. In another tab, open Firebase Console
3. Edit the `weekly_points` document for your user
4. Change the `points_earned` value
5. Watch the Weekly Points card update automatically (no page refresh needed)

### Step 4: Test Automatic Calculation

To test the automatic calculation feature:

1. Create some `user_points` records for this week
2. Open browser console on the Weekly Glance page
3. Run this command:

```javascript
// Import the service (you may need to expose this via window for testing)
import { updateWeeklyPoints } from '@/services/weeklyPointsService'
await updateWeeklyPoints('YOUR_USER_UID')
```

This will:
- Calculate total points from `user_points` collection for this week
- Count completed activities from `weeklyActivities` subcollection
- Update the status based on progress vs the minimum requirement
- Update the `weekly_points` record

## Understanding the Status Indicators

The status badge shows your progress toward the minimum points required this week:

- **On Track** (Green): You've earned ≥70% of the minimum requirement
- **Warning** (Yellow): You've earned 40-69% of the minimum requirement
- **At Risk** (Red): You've earned <40% of the minimum requirement

## Data Structure

### weekly_points Collection
Stores weekly progress for each user. One document per user per week.

### user_points Collection
Stores individual point awards. Multiple documents per user.

### weeklyActivities Subcollection
Under `profiles/{userId}/weeklyActivities/`, stores completed activities.

## Troubleshooting

### "No data showing" or shows "--"

1. Check if `weekly_points` collection exists in Firestore
2. Verify the document has the correct `user_id` matching your Firebase Auth UID
3. Check that `week_number` and `week_year` match the current week
4. Verify Firestore indexes are created
5. Check browser console for errors

### "Permission denied" errors

1. Verify you're logged in
2. Check that the security rules are deployed:
   ```javascript
   match /weekly_points/{weeklyPointsId} {
     allow read: if isAuthenticated() &&
       (request.auth.uid == resource.data.user_id || hasRole('super_admin'));
     allow create, update: if isAuthenticated() &&
       (request.resource.data.user_id == request.auth.uid || hasRole('super_admin'));
   }
   ```

### Data not updating in real-time

1. Check browser console for listener errors
2. Verify Firestore connection is active
3. Try refreshing the page

## Next Steps

To fully integrate this feature, you should:

1. **Add point-awarding logic** when users complete activities
2. **Call `updateWeeklyPoints(userId)`** after awarding points
3. **Set up the minimum weekly points requirement** based on user's journey
4. **Create a background job** to initialize weekly_points for all users at the start of each week

## Sample Data Script

You can modify the `scripts/populate-weekly-points.ts` file to generate test data for your specific needs.
