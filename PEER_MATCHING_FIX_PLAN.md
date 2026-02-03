# Peer Matching Fix Plan

## Problem Analysis

The automatic peer matches are not showing for users in the T4L platform. After thorough investigation, I've identified the root causes:

### 1. **Cloud Functions Not Deployed**
- The `automatedWeeklyPeerMatching` function exists in code but may not be deployed to Firebase
- Scheduled to run every Monday at 6 AM UTC via Cloud Scheduler
- Without deployment, no automatic matches are being created in `peer_weekly_matches` collection

### 2. **No Admin UI to Manually Trigger**
- `triggerPeerMatching` Cloud Function exists for manual triggering (super_admin only)
- No admin dashboard UI to call this function
- Admins cannot manually trigger matching without direct Cloud Function invocation

### 3. **Field Naming Inconsistency**
- Cloud Function uses `peerId` (line 229 in automated-peer-matching.ts)
- UI reads both `peer_id` and `peerId` (lines 452, 788 in PeerConnectPage.tsx)
- Should standardize on `peer_id` (snake_case) per Firestore conventions

### 4. **Client-Side Fallback Limitations**
- UI creates client-side matches only when user visits the page
- Requires organization associations (companyCode, corporateVillageId, cohortIdentifier)
- Not a true "automatic" matching system

---

## Current Architecture

### Cloud Functions (functions/src/automated-peer-matching.ts)

**automatedWeeklyPeerMatching**
- Schedule: Every Monday at 6 AM UTC (cron: `0 6 * * 1`)
- Groups users by organization (cohort → village → company → org)
- Creates random pairings within each group
- Stores in `peer_weekly_matches/{userId-matchKey}`
- Creates notifications for users

**triggerPeerMatching (HTTPS Callable)**
- Manually triggered by super_admin
- Same logic as automated function
- Returns detailed execution stats

**expireOldPeerMatches**
- Schedule: Daily at midnight UTC (cron: `0 0 * * *`)
- Marks matches >14 days old as "expired"

### Frontend Logic (PeerConnectPage.tsx)

**Match Fetching Priority:**
1. Check if match document exists in `peer_weekly_matches`
2. If exists: Display stored match with peer profile
3. If not exists: Create client-side match from `availablePeers`
4. Real-time listener updates UI when match document changes

**Match Document ID Format:**
```
{userId}-{matchKey}
Example: abc123-weekly-2026-02-03
```

**Match Window Keys:**
- Weekly: `weekly-{YYYY-MM-DD}` (start of week based on preferredMatchDay)
- Biweekly: `biweekly-{YYYY-MM-DD}` (2-week cycles anchored to Jan 1, 2024)

---

## Implementation Plan

### Phase 1: Fix Field Naming Consistency

**File:** `functions/src/automated-peer-matching.ts`

**Changes:**
- Line 229: Change `peerId` to `peer_id` in match document structure
- Ensure all references use snake_case consistently

**Reason:** Aligns with Firestore conventions and existing collection schemas

---

### Phase 2: Deploy Cloud Functions

**Commands:**
```bash
cd functions
npm run build
firebase deploy --only functions:automatedWeeklyPeerMatching
firebase deploy --only functions:triggerPeerMatching
firebase deploy --only functions:expireOldPeerMatches
```

**Verification:**
- Check Firebase Console → Functions tab
- Verify scheduled functions show up in Cloud Scheduler
- Check function logs for successful deployment

---

### Phase 3: Add Admin UI to Manually Trigger Matching

**New Component:** `src/components/admin/PeerMatchingTrigger.tsx`

**Features:**
- Button to trigger peer matching for all organizations
- Optional organization filter dropdown
- Loading state during execution
- Success/error toast notifications
- Display execution stats (matches created, users processed, duration)
- Super_admin role check

**Integration:**
- Add to `src/pages/admin/AdminDashboard.tsx` or create dedicated page
- Add route in admin routes if separate page
- Use `peerMatchingService.triggerPeerMatching()` from existing service

---

### Phase 4: Improve UI Feedback

**File:** `src/pages/peer/PeerConnectPage.tsx`

**Enhancements:**
1. Add loading state indicator when fetching matches
2. Show clear message when no matches available:
   - "No organization associations found - contact admin"
   - "Matching disabled in preferences"
   - "No peers available in your organization"
3. Add "automatedMatch" badge to distinguish auto-generated vs manual matches
4. Improve console logging for debugging

---

### Phase 5: Testing & Verification

**Test Scenarios:**

1. **Scheduled Function Test:**
   - Wait for Monday 6 AM UTC or manually trigger via Firebase Console
   - Verify `peer_weekly_matches` documents are created
   - Check notifications collection for match notifications

2. **Manual Trigger Test:**
   - Login as super_admin
   - Use new admin UI to trigger matching
   - Verify execution stats returned
   - Check Firestore for created matches

3. **UI Display Test:**
   - Login as regular user with organization associations
   - Navigate to Peer Connect page
   - Verify automatic match displays with peer details
   - Test real-time updates when match changes

4. **Edge Cases:**
   - User with no organization: Should show helpful error
   - Organization with <2 users: Should skip gracefully
   - User with matching disabled: Should respect preference
   - Existing match for window: Should not duplicate

---

## File Changes Summary

### Modified Files:
1. `functions/src/automated-peer-matching.ts`
   - Fix field naming: `peerId` → `peer_id`

2. `src/pages/admin/AdminDashboard.tsx` (or create new admin page)
   - Add peer matching trigger UI section

3. `src/pages/peer/PeerConnectPage.tsx` (optional improvements)
   - Enhanced loading/error states
   - Better user feedback messages

### New Files:
1. `src/components/admin/PeerMatchingTrigger.tsx`
   - Admin UI component for manual matching trigger

---

## Rollout Plan

### Step 1: Code Changes
- Fix field naming in Cloud Function
- Build and test locally

### Step 2: Deploy Functions
- Deploy all three peer matching functions
- Verify deployment in Firebase Console
- Check Cloud Scheduler configuration

### Step 3: Add Admin UI
- Create PeerMatchingTrigger component
- Integrate into admin dashboard
- Test with super_admin account

### Step 4: Initial Data Population
- Use admin UI to manually trigger peer matching
- Verify matches created for all eligible users
- Check user notifications

### Step 5: Monitor Automated Runs
- Wait for next Monday 6 AM UTC
- Check Cloud Function logs
- Verify new matches created for new week
- Monitor user engagement with matches

---

## Success Criteria

✅ Cloud Functions successfully deployed and scheduled
✅ Automatic matches created every Monday at 6 AM UTC
✅ Admin UI allows manual triggering with proper feedback
✅ Users see their peer matches on Peer Connect page
✅ Real-time updates work when matches are created/updated
✅ Proper error handling and user feedback for edge cases
✅ No duplicate matches created for same window
✅ Field naming consistency across Cloud Functions and UI

---

## Risks & Mitigations

**Risk 1: Cloud Scheduler Quota**
- Free tier: 3 jobs, Blaze plan: 100 jobs
- Mitigation: Check current scheduler jobs, upgrade if needed

**Risk 2: Batch Write Limits**
- Firestore batches limited to 500 operations
- Mitigation: Already handled in Cloud Function with flush logic (450 ops/batch)

**Risk 3: Function Timeout**
- Max 540 seconds for scheduled functions
- Mitigation: Process groups in batches, add timeout monitoring

**Risk 4: Field Naming Migration**
- Existing matches may use `peerId` field
- Mitigation: UI already handles both field names as fallback

---

## Post-Deployment Monitoring

1. Check Cloud Function logs daily for first week
2. Monitor `peer_weekly_matches` collection growth
3. Track user engagement metrics (contacts, sessions scheduled)
4. Gather user feedback on match quality
5. Adjust matching algorithm if needed (e.g., skill-based, interest-based)

---

## Future Enhancements

- **Intelligent Matching:** Use ML for better peer compatibility
- **Match Preferences:** Allow users to specify interests/goals for matching
- **Match History:** Show previous matches and success metrics
- **Matching Analytics:** Dashboard showing match quality, engagement rates
- **Cross-Organization Matching:** Enable opt-in matching across organizations
- **Timezone-Aware Scheduling:** Consider user timezones for match creation time
