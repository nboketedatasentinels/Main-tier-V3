# Partner Dashboard User Loading Fix

## Problem

Users are not showing in the Partner Dashboard even though the Partner is assigned to an organization with users.

## Root Cause

This is a **data mismatch issue** between:
- The organization IDs in the partner's `assignedOrganizations` field
- The organization identifiers in users' profiles (`companyCode`, `organizationId`, etc.)

The Partner Dashboard filters users by comparing these values, and if they don't match, users are hidden.

## Solution

We've created two automated scripts to diagnose and fix this issue:

### 1. Diagnostic Script

**Purpose:** Identifies exactly which users are mismatched and why.

**Usage:**
```bash
# By partner user ID
npm run diagnose:partner-orgs <partnerUserId>

# By partner email
npm run diagnose:partner-orgs -- --email partner@example.com

# Direct node command
node scripts/diagnose-partner-org-mismatch.mjs <partnerUserId>
```

**Output:**
- Partner's assigned organizations
- Organization details (ID, code, name)
- List of matched users (will show in dashboard)
- List of mismatched users (won't show in dashboard)
- List of inactive users (filtered by status)
- Specific recommendations for fixing

**Example:**
```bash
npm run diagnose:partner-orgs abc123xyz
```

### 2. Bulk Fix Script

**Purpose:** Automatically updates all mismatched users to fix the issue.

**Usage:**
```bash
# Dry run (preview changes without applying)
npm run fix:partner-orgs:dry-run <partnerUserId>

# Apply fixes
npm run fix:partner-orgs <partnerUserId>

# By email
npm run fix:partner-orgs -- --email partner@example.com

# Direct node command
node scripts/fix-user-organization-assignments.mjs <partnerUserId>
node scripts/fix-user-organization-assignments.mjs <partnerUserId> --dry-run
```

**What it does:**
1. Identifies all mismatched users
2. Shows a preview of changes
3. Asks for confirmation
4. Updates users in batches (Firestore batch writes)
5. Sets both `companyCode` and `organizationId` fields
6. Stores original values for audit trail
7. Reports detailed results

**Safety features:**
- `--dry-run` mode to preview without changing data
- Confirmation prompt before applying changes
- Batch processing (500 users per batch max)
- Error handling and reporting
- Audit trail (stores original values)

**Example:**
```bash
# First, preview the changes
npm run fix:partner-orgs:dry-run abc123xyz

# If everything looks good, apply the fix
npm run fix:partner-orgs abc123xyz
```

## Step-by-Step Fix Process

### Option 1: Automated Fix (Recommended)

1. **Run diagnostic to understand the issue:**
   ```bash
   npm run diagnose:partner-orgs <partnerUserId>
   ```

2. **Preview the fixes (dry run):**
   ```bash
   npm run fix:partner-orgs:dry-run <partnerUserId>
   ```

3. **Apply the fixes:**
   ```bash
   npm run fix:partner-orgs <partnerUserId>
   ```
   Type "yes" when prompted to confirm.

4. **Verify in Partner Dashboard:**
   - Refresh the dashboard
   - Open the "Dashboard Debug Info" accordion
   - Check that "Rejected (Org Mismatch)" count is now 0
   - Verify users appear in the table

### Option 2: Manual Firestore Fix (Quick one-time fix)

If you need to fix users immediately without running scripts:

1. **Get the assigned org key from Partner Dashboard:**
   - Open the dashboard as the partner user
   - Expand the "Dashboard Debug Info" accordion
   - Note the values under "Assigned Organization Keys"
   - Example: `["org-abc-123"]`

2. **Update user profiles in Firestore Console:**
   ```
   Firestore Console → profiles → {userId}

   Update these fields:
     companyCode: "org-abc-123"  (use the key from step 1)
     organizationId: "org-abc-123"  (same value)
     accountStatus: "active"  (ensure it's active/onboarding/paused)
   ```

3. **Repeat for all users** that should be visible to the partner.

4. **Refresh the Partner Dashboard** to see the changes.

## Understanding the Debug Info

The Partner Dashboard has a built-in "Dashboard Debug Info" accordion that shows:

- **Snapshot Total:** Total users in Firestore
- **Kept:** Users that match and will show
- **Rejected (Org Mismatch):** Users filtered out due to org mismatch
- **Rejected (Filter):** Users filtered out by selected org dropdown
- **Assigned Organization Keys:** What the partner is assigned to
- **Samples of Mismatched Users:** Examples with their org field values

This accordion is invaluable for diagnosing the exact issue.

## Technical Details

### User Organization Fields (Multiple Variants)

Users can have organization info in ANY of these fields:
- `companyCode` (preferred)
- `company_code`
- `companyId`
- `company_id`
- `organizationId`
- `organization_id`

The dashboard checks ALL these fields and matches if ANY of them match the partner's assigned organizations.

### Organization Key Normalization

All organization keys are normalized (lowercased, trimmed) before comparison:
- `"ORG-ABC-123"` → `"org-abc-123"`
- `"  org-abc-123  "` → `"org-abc-123"`

### Partner Assignment Storage

Partner users have an `assignedOrganizations` array field in their profile:
```json
{
  "email": "partner@example.com",
  "role": "partner",
  "assignedOrganizations": ["TPgMOD8YMG76fPR0pVsg", "AnotherOrgId123"]
}
```

These IDs should match document IDs in the `organizations` collection.

### User Filtering Logic

Located in: [src/hooks/partner/usePartnerUsers.ts:223-258](../src/hooks/partner/usePartnerUsers.ts#L223-L258)

```typescript
// User is shown if ANY of their org fields match ANY assigned org key
const userOrgKeys = createOrgKeySet([
  data.companyCode,
  data.company_code,
  data.companyId,
  data.company_id,
  data.organizationId,
  data.organization_id,
])

const match = Array.from(userOrgKeys).some((key) => assignedOrgKeys.has(key))
if (!match) {
  // User is filtered out
  return false
}
```

## Troubleshooting

### Users still not showing after fix

1. **Check account status:**
   - Users must have `accountStatus` or `status` field set to: `'active'`, `'onboarding'`, or `'paused'`
   - Users with `'inactive'`, `'suspended'`, `'deleted'` are filtered out

2. **Check browser console:**
   - Look for `[PartnerUsers]` log messages
   - Check for JavaScript errors

3. **Try debug mode (super admin only):**
   - Click "Enable Debug Mode" button in the dashboard
   - This bypasses ALL filtering to confirm users exist in Firestore
   - If users appear in debug mode, it confirms a filtering issue

4. **Verify Firestore security rules:**
   - Ensure partners can read user profiles
   - Check Firestore Rules in Firebase Console

### Script errors

**"Could not read serviceAccountKey.json":**
- Ensure `serviceAccountKey.json` exists in the project root
- Download it from Firebase Console → Project Settings → Service Accounts

**"Partner profile not found":**
- Verify the partner user ID is correct
- Try using `--email` flag instead

**"No user found with email":**
- Verify the email is correct and exists in Firestore
- Check for typos or case sensitivity

## Files Modified/Created

### New Scripts
- `scripts/diagnose-partner-org-mismatch.mjs` - Diagnostic tool
- `scripts/fix-user-organization-assignments.mjs` - Bulk fix tool
- `scripts/README-PARTNER-ORG-FIX.md` - This documentation

### Modified Files
- `package.json` - Added npm script commands

### Key Source Files (Reference)
- `src/hooks/partner/usePartnerUsers.ts` - User filtering logic
- `src/hooks/partner/usePartnerOrganizations.ts` - Org fetching logic
- `src/services/organizationService.ts` - Organization service
- `src/pages/dashboards/PartnerDashboard.tsx` - Dashboard UI with debug info
- `src/utils/partnerDashboardUtils.ts` - Normalization utilities

## Prevention

To prevent this issue in the future:

1. **When creating new users:**
   - Always set BOTH `companyCode` AND `organizationId` fields
   - Use the organization's `code` field for `companyCode`
   - Use the organization's document ID for `organizationId`

2. **When assigning partners to organizations:**
   - Use the organization's Firestore document ID
   - Verify the organization exists before assignment

3. **Regular audits:**
   - Run the diagnostic script periodically
   - Check for users with empty org fields
   - Fix mismatches proactively

## Support

If you encounter issues or have questions:

1. Check the diagnostic script output for detailed info
2. Review the Dashboard Debug Info accordion
3. Examine the browser console for error messages
4. Verify Firestore data structure matches expectations

For persistent issues, provide:
- Partner user ID or email
- Diagnostic script output
- Dashboard Debug Info screenshot
- Browser console errors (if any)
