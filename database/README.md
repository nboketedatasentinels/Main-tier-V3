# Database Schema

This directory contains the complete database schema for the T4L platform using **Firebase Firestore**.

## Setup Instructions

1. Create a new Firebase project at https://firebase.google.com
2. Navigate to Firestore Database in your Firebase console
3. Click "Create database" and choose production mode
4. Set up Security Rules from `firestore-security-rules.txt`
5. Review the structure in `firestore-schema.md`
6. Copy your Firebase configuration to `.env`

## Database Structure

### Core Collections
- **profiles** - User profiles and settings
- **journeys** - Available transformation journeys
- **activities** - Available activities with points
- **courses** - Available courses
- **badges** - Achievement badges
- **villages** - Community groups
- **companies** - Organization profiles
- **events** - Platform events

### Subcollections (under profiles/{userId}/)
- **userJourneys** - User enrollment in journeys
- **weeklyActivities** - User activity completion tracking
- **impactLogs** - User impact tracking
- **userBadges** - Badges earned by users
- **notifications** - User notifications

### Security

Firestore Security Rules are configured to:
- Users can only access their own data
- Admins have elevated permissions
- Reference collections (journeys, activities, etc.) are readable by authenticated users
- Write access to reference data is admin-only

## Using Firestore

The Firebase SDK is configured in `src/services/firebase.ts`:

```typescript
import { db } from '@/services/firebase'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'

// Example: Get user profile
const docRef = doc(db, 'profiles', userId)
const docSnap = await getDoc(docRef)
const profile = docSnap.data()

// Example: Create document
await setDoc(doc(db, 'profiles', userId), profileData)
```

See the full schema in `firestore-schema.md` for complete collection definitions and security rules.

## Legacy onboarding cleanup migration

The onboarding and guided tour systems have been fully retired. Use `scripts/migrations/cleanup-onboarding.mjs` to remove legacy onboarding documents and fields.

### Prerequisites
- Install dependencies: `npm install` (requires access to `firebase-admin`).
- Provide Firebase Admin credentials via one of the following:
  - Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a service account JSON file, **or**
  - Set `FIREBASE_SERVICE_ACCOUNT` to the JSON string of the service account.
- (Optional) Set `FIREBASE_PROJECT_ID` if the service account is used across multiple projects.

### Run the script

```bash
node scripts/migrations/cleanup-onboarding.mjs
```

### What the script does
- Sets `isOnboarded` to `true` for all profiles and removes any `onboardingSnapshot` and `dashboardTourCompleted` fields.
- Deletes all documents in `onboarding_steps`, `onboarding_progress`, and `onboarding_analytics`.
- Removes `user_points` records where `source` contains "onboarding".
