# Cloud Functions Deployment Guide

This guide walks through deploying the automatic user-to-profiles sync Cloud Functions.

## Quick Start

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy to Firebase

```bash
npm run deploy
```

**Expected output:**
```
✔ functions: Deploying new functions(s): syncUserToProfile, syncAuthUserToProfile, syncProfilesNightly...
✔ functions[syncUserToProfile(us-central1)]: Successful create/update operation.
✔ functions[syncAuthUserToProfile(us-central1)]: Successful create/update operation.
✔ functions[syncProfilesNightly(us-central1)]: Successful create/update operation.
```

## What Gets Deployed

### 1. **syncUserToProfile** (Firestore Trigger)
- Automatically syncs user documents to profiles collection
- Triggers on every user document write
- Zero configuration needed after deployment

### 2. **syncAuthUserToProfile** (Auth Trigger)
- Syncs users created via Firebase Authentication
- Handles Google Sign-In and email/password signups
- Runs automatically for new users

### 3. **syncProfilesNightly** (Scheduled Function)
- Daily batch sync at 2 AM UTC
- Ensures data consistency
- Reports sync statistics

## Verification

### Check Deployment Status

```bash
firebase functions:list
```

You should see three functions listed:
- `syncUserToProfile`
- `syncAuthUserToProfile`
- `syncProfilesNightly`

### View Real-Time Logs

```bash
firebase functions:log --limit 100
```

### Test the Functions

#### Test Firestore Sync

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to Firestore Database
3. Create/update a user in the `users` collection
4. Check that the `profiles` collection was updated automatically
5. View logs: `firebase functions:log`

#### Test Auth Sync

1. Create a new user via Google Sign-In
2. Wait a few seconds
3. Check that the user appears in both `users` and `profiles` collections
4. View logs for confirmation

#### Test Scheduled Sync

1. Wait until 2 AM UTC, or
2. Trigger manually in Firebase Console (Cloud Scheduler tab)
3. Check logs for sync results

## Post-Deployment

### 1. Monitor First 24 Hours

```bash
# Watch logs in real-time
firebase functions:log --follow
```

### 2. Verify Data Sync

Run the migration script to verify all users are synced:

```bash
cd ..
node scripts/migrations/sync-users-to-profiles.mjs --dry-run
```

Should show mostly "SKIP" entries (profiles already exist from function sync).

### 3. Update Documentation

- [ ] Update team on new automatic sync behavior
- [ ] Document sync schedule (2 AM UTC daily)
- [ ] Share deployment guide with team

## Troubleshooting

### Functions Won't Deploy

**Problem:** TypeScript compilation errors

```bash
npm run build  # Check for errors
```

**Solution:**
```bash
npm install --save-dev typescript@latest
npm run build
```

### Permission Denied Errors

**Problem:** Function runs but can't write to Firestore

**Solution:** Update Firestore Security Rules

Edit `firestore.rules`:

```javascript
// Allow Cloud Functions to write to both collections
match /users/{document=**} {
  allow read, write: if request.auth.uid != null;
}

match /profiles/{document=**} {
  allow read, write: if request.auth.uid != null || request.auth == null;
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### Functions Run But Nothing Syncs

**Check:**
1. Are you writing to the `users` collection?
2. Are Firestore rules blocking the function?
3. Check logs: `firebase functions:log`

**Debug:**
```bash
# Add detailed logging
# Edit sync-profiles.ts and add console.log statements
npm run build
npm run deploy
firebase functions:log --limit 50
```

### Nightly Job Doesn't Run

**Check:**
1. Cloud Scheduler is enabled in your Firebase project
2. Correct timezone in function definition
3. Check Cloud Scheduler jobs in Firebase Console

**Force run:**
1. Open Firebase Console
2. Go to Cloud Scheduler
3. Find `syncProfilesNightly`
4. Click the three dots and select "Force run"

## Advanced Options

### Change Sync Schedule

Edit `functions/src/sync-profiles.ts`:

```typescript
// Line ~180: Change the schedule
.pubsub.schedule("0 2 * * *") // 2 AM UTC
```

**Crontab format:** `minute hour day month dayOfWeek`

Examples:
- `0 * * * *` - Every hour
- `0 0 * * 0` - Weekly (Sunday midnight)
- `0 3 * * *` - 3 AM UTC daily

### Change Region

Edit `functions/src/sync-profiles.ts`:

```typescript
.region("us-central1") // Change to your preferred region
```

Valid regions:
- `us-central1` (Iowa)
- `us-east1` (South Carolina)
- `us-west2` (Oregon)
- `europe-west1` (Belgium)
- `asia-northeast1` (Tokyo)

### Increase Timeout

Edit `functions/package.json`:

```json
{
  "functions": {
    "memory": 256,
    "timeout": 540
  }
}
```

## Rollback

If you need to remove the functions:

```bash
firebase functions:delete syncUserToProfile
firebase functions:delete syncAuthUserToProfile
firebase functions:delete syncProfilesNightly
```

Or redeploy the previous version:

```bash
git checkout HEAD~1 functions/
npm run deploy
```

## Cost Estimation

Monthly cost for typical usage (1,000 users):

| Component | Cost |
|-----------|------|
| Firestore reads (nightly sync) | ~$0.06 |
| Firestore writes (daily sync) | ~$0.12 |
| Function invocations | ~$0.40 |
| **Total** | **~$0.58** |

*Actual costs depend on request volume and region*

## Next Steps

1. ✅ Deploy functions
2. ✅ Verify in Firebase Console
3. ✅ Check logs for first 24 hours
4. ✅ Run migration script to verify
5. ✅ Update team documentation
6. ✅ Monitor nightly sync results

## Support

For issues:
1. Check logs: `firebase functions:log`
2. Review error messages in Firebase Console
3. Check Firestore rules and permissions
4. Test with emulator locally
