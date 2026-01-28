# Quick Reference: User-to-Profiles Sync Setup

## What Was Created

### Cloud Functions (3 total)
1. **syncUserToProfile** - Triggers on user document write
2. **syncAuthUserToProfile** - Triggers on Firebase auth signup
3. **syncProfilesNightly** - Runs daily at 2 AM UTC

### Files Created
```
functions/
├── src/
│   ├── sync-profiles.ts       ← All 3 functions (170 lines)
│   └── index.ts               ← Entry point
├── package.json               ← Dependencies
├── tsconfig.json              ← TypeScript config
├── README.md                  ← Full documentation
└── .gitignore

Root:
├── firebase.json              ← Firebase config (updated)
├── SYNC_IMPLEMENTATION_SUMMARY.md    ← Full summary
└── CLOUD_FUNCTIONS_DEPLOYMENT.md    ← Deployment guide
```

## Deploy in 3 Steps

```bash
# Step 1: Install dependencies
cd functions
npm install

# Step 2: Build
npm run build

# Step 3: Deploy
npm run deploy
```

**That's it!** Functions deploy automatically to Firebase.

## What It Does

### On Every User Write
```
App updates user document in "users" collection
    ↓
Cloud Function triggers automatically
    ↓
Syncs to "profiles" collection
    ↓
Logs confirmation
```

### Every Day at 2 AM UTC
```
Scheduled job runs
    ↓
Checks all users are synced
    ↓
Fixes any discrepancies
    ↓
Reports results
```

## Key Benefits

✅ **Automatic** - No manual syncing needed  
✅ **Reliable** - Three layers of sync protection  
✅ **Fast** - Real-time on write + daily verification  
✅ **Cheap** - ~$0.50-1.00/month for 1000 users  
✅ **Safe** - No changes to existing app code  

## Verify It Works

```bash
# Check if deployed
firebase functions:list

# Watch the logs
firebase functions:log --follow

# Or view past logs
firebase functions:log --limit 50
```

## Need to Change Something?

### Change sync time (currently 2 AM UTC):
Edit line 158 in `functions/src/sync-profiles.ts`:
```typescript
.pubsub.schedule("0 2 * * *") // Change this line
```

Examples:
- `"0 0 * * *"` = Midnight UTC
- `"0 12 * * *"` = Noon UTC
- `"0 */4 * * *"` = Every 4 hours

### Change region (currently us-central1):
Edit line 33 in `functions/src/sync-profiles.ts`:
```typescript
.region("us-central1") // Change this line
```

Other regions: us-east1, us-west2, europe-west1, asia-northeast1

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Deploy fails | Check: `npm install`, then `npm run build` |
| Functions don't run | Check Firestore rules allow writes |
| Nothing appears in profiles | Check function logs: `firebase functions:log` |
| Error: "Permission denied" | Update Firestore rules (see deployment guide) |

## Documentation

- **Full guide:** See `CLOUD_FUNCTIONS_DEPLOYMENT.md`
- **Code comments:** See `functions/src/sync-profiles.ts`
- **Function docs:** See `functions/README.md`
- **Implementation details:** See `SYNC_IMPLEMENTATION_SUMMARY.md`

## Cost Breakdown

**Monthly cost for 1000 users:**
- Firestore reads: ~$0.06
- Firestore writes: ~$0.12
- Function invocations: ~$0.40
- **Total: ~$0.58**

*Actual cost depends on usage patterns*

## Important Notes

✅ **No app code changes needed** - Existing signup already writes to both collections  
✅ **Backward compatible** - Works with current system  
✅ **Can be removed anytime** - Just delete functions if needed  
✅ **Fully reversible** - Git track all changes  

## Monitor Daily

```bash
# Quick health check
firebase functions:log | grep -i "sync"

# More detailed
firebase functions:log --limit 100
```

## Questions?

Check the deployment guide for:
- Detailed setup instructions
- Testing procedures
- Advanced configuration
- Performance tuning
- Cost estimation
- Rollback procedures

## One More Thing

After deploying, run this to verify all users are synced:

```bash
cd ..
node scripts/migrations/sync-users-to-profiles.mjs --dry-run
```

Should show mostly "SKIP" entries (already synced by functions).

---

**Ready to deploy?** Run `npm run deploy` from the functions directory!
