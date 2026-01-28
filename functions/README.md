# Man-Tier Cloud Functions

This directory contains Firebase Cloud Functions for the Man-Tier application, specifically handling automatic synchronization of user data between the `users` and `profiles` collections.

## Functions

### 1. `syncUserToProfile`
**Type:** Firestore trigger  
**Trigger:** `users/{userId}` document write

Automatically syncs user documents to the `profiles` collection whenever a user document is created or updated.

**Features:**
- Syncs all user data to profiles collection
- Handles document deletion (optionally deletes from profiles too)
- Preserves timestamps
- Uses merge strategy to avoid overwriting existing data
- Logs all operations for monitoring

**When it runs:**
- Every time a user document is written (create/update)
- Immediately after the write event

### 2. `syncAuthUserToProfile`
**Type:** Authentication trigger  
**Trigger:** New user authentication event

Automatically syncs users created via Google Sign-In or other authentication methods.

**Features:**
- Creates minimal user profile for new auth users
- Checks if user already exists to avoid duplicates
- Writes to both `users` and `profiles` collections
- Captures email and display name from auth

**When it runs:**
- When a new user is created in Firebase Authentication

### 3. `syncProfilesNightly`
**Type:** Scheduled function  
**Schedule:** Daily at 2 AM UTC

Batch sync function that ensures the `profiles` collection stays in sync with the `users` collection. Useful for catching any missed syncs.

**Features:**
- Processes all users in batches
- Compares timestamps to avoid unnecessary updates
- Handles large datasets efficiently
- Detailed logging and error handling
- Reports sync statistics

**When it runs:**
- Every day at 2 AM UTC
- Can be adjusted by modifying the schedule string

## Setup & Deployment

### Prerequisites
- Node.js 18+
- Firebase CLI
- Service account credentials (already configured)

### Installation

```bash
cd functions
npm install
```

### Build

```bash
npm run build
```

### Deploy

```bash
# Deploy only the functions
npm run deploy

# Or from the root directory
firebase deploy --only functions
```

### Local Testing

```bash
# Run emulator
npm run serve

# Open Firebase console in another terminal
firebase emulators:start --only functions,firestore
```

### View Logs

```bash
npm run logs

# Or with Firebase CLI
firebase functions:log
```

## Architecture

### Why Two Collections?

The application maintains two collections:
- **`users`**: Primary user data, created during signup and updated by the app
- **`profiles`**: Mirror of users, used by admin dashboards and reporting

### Sync Flow

```
User creates/updates account
    ↓
App writes to both "users" and "profiles" (client-side)
    ↓
Cloud Function `syncUserToProfile` triggers (automatic backup)
    ↓
Function ensures profiles is always in sync
    ↓
Nightly job verifies everything is consistent
```

### Benefits

1. **Reliability**: Even if the app fails to write to profiles, the function ensures sync
2. **Admin Dashboard**: Always has fresh data from profiles collection
3. **Data Consistency**: Nightly verification catches any discrepancies
4. **Audit Trail**: All sync operations are logged

## Monitoring & Troubleshooting

### Check Sync Status

```bash
firebase functions:log --limit 50
```

### Manual Sync (if needed)

Use the migration script from the root directory:

```bash
node scripts/migrations/sync-users-to-profiles.mjs
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Functions not deploying | Ensure Node.js 18+ and all dependencies installed |
| Function runs but nothing syncs | Check Firestore rules allow function to write |
| High execution time | Function processes all users; normal for large datasets |
| Permission denied errors | Verify service account has Firestore write permissions |

## Configuration

### Modify Sync Schedule

Edit `sync-profiles.ts`:

```typescript
// Change from "0 2 * * *" to your preferred schedule
.pubsub.schedule("0 2 * * *") // 2 AM UTC daily
```

Schedule format is crontab style: `minute hour day month dayOfWeek`

### Change Region

Edit the region in `sync-profiles.ts`:

```typescript
.region("us-central1") // Change to your preferred region
```

## Performance Considerations

- **Sync on write**: <100ms per user (network dependent)
- **Nightly batch**: ~1-2 seconds for 100 users, scales linearly
- **Costs**: 
  - Firestore reads/writes per sync
  - Cloud Functions execution time
  - Scheduler invocation (minimal)

## Security

- Functions use Firebase Admin SDK with service account
- Firestore Security Rules enforce access control
- All operations are authenticated and logged
- No sensitive data is exposed in logs

## Future Enhancements

- [ ] Add sync status dashboard
- [ ] Implement rollback functionality
- [ ] Add alerts for sync failures
- [ ] Support partial syncs (specific fields only)
- [ ] Add A/B testing for sync strategies

## Support

For issues or questions:
1. Check the logs: `npm run logs`
2. Verify Firestore rules in `firestore.rules`
3. Test locally with emulator
4. Review function error messages in Firebase Console
