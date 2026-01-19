# Database Migration Scripts

This directory contains migration scripts for updating the Firestore database schema.

## Migration: Add Role-Based Login Fields

### File: `add-role-based-fields.mjs`

This migration adds the following fields to existing user profiles to support the role-based login redirect system:

- `transformationTier` - User's transformation tier (individual_free, individual_paid, corporate_member, corporate_leader)
- `assignedOrganizations` - Array of organization codes the user (admin) can access
- `accountStatus` - Account status (active, inactive, pending, suspended)
- `mustChangePassword` - Boolean flag for first-time password change requirement
- `onboardingComplete` - Boolean flag for onboarding completion
- `onboardingSkipped` - Boolean flag for onboarding skip
- `hasSeenDashboardTour` - Boolean flag for dashboard tour
- `dashboardPreferences` - Object containing user's dashboard preferences
- `defaultDashboardRoute` - User's default landing route

### Prerequisites

1. **Firebase Admin SDK Setup**: Ensure you have a service account key file at the project root:
   ```bash
   # Download from Firebase Console > Project Settings > Service Accounts
   # Save as: service-account-key.json
   ```

2. **Environment Variables**:
   ```bash
   export FIREBASE_PROJECT_ID="your-project-id"
   ```

3. **Dependencies**: Firebase Admin SDK must be installed
   ```bash
   npm install firebase-admin
   ```

### Running the Migration

1. **Backup your database** before running any migration:
   ```bash
   # Use Firebase Console or gcloud CLI to export your database
   gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
   ```

2. **Run the migration script**:
   ```bash
   node scripts/migrations/add-role-based-fields.mjs
   ```

3. **Monitor the output**: The script will:
   - Skip profiles that have already been migrated
   - Process profiles in batches of 500
   - Display progress and any errors
   - Provide a summary at the end

### Post-Migration Steps

After running the migration, you should:

1. **Review Admin Users**: Assign organizations to admin users by updating their `assignedOrganizations` array
   ```javascript
   // Example: Assign admin to organizations
   db.collection('profiles').doc(adminUserId).update({
     assignedOrganizations: ['org-code-1', 'org-code-2']
   })
   ```

2. **Update Transformation Tiers**: Review and update `transformationTier` for corporate users as needed
   ```javascript
   // Example: Update transformation tier
   db.collection('profiles').doc(userId).update({
     transformationTier: 'corporate_leader'
   })
   ```

3. **Test Login Flows**: Test login for each role type:
   - Super Admin → `/super-admin/dashboard`
   - Admin → `/admin/dashboard`
   - Mentor → `/mentor/dashboard`
   - Ambassador → `/ambassador/dashboard`
   - Paid Member → `/app/dashboard/member`
   - Free User → `/app/dashboard/free`

4. **Deploy Updated Security Rules**: Deploy the updated `firestore.rules` to Firebase:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Rollback

If you need to rollback this migration:

1. Restore from your backup:
   ```bash
   gcloud firestore import gs://your-bucket/backup-YYYYMMDD
   ```

2. Or remove the added fields manually:
   ```javascript
   const fieldsToRemove = [
     'transformationTier',
     'assignedOrganizations',
     'accountStatus',
     'mustChangePassword',
     'onboardingComplete',
     'onboardingSkipped',
     'hasSeenDashboardTour',
     'dashboardPreferences',
     'defaultDashboardRoute'
   ]
   
   // Remove fields from all profiles
   const profiles = await db.collection('profiles').get()
   const batch = db.batch()
   
   profiles.forEach(doc => {
     const updates = {}
     fieldsToRemove.forEach(field => {
       updates[field] = admin.firestore.FieldValue.delete()
     })
     batch.update(doc.ref, updates)
   })
   
   await batch.commit()
   ```

## Migration Best Practices

1. **Always backup** before running migrations
2. **Test in development** environment first
3. **Run during low-traffic** periods
4. **Monitor for errors** during and after migration
5. **Have a rollback plan** ready
6. **Document all changes** and their impact

## Migration: Backfill Email Verification

### File: `backfill-email-verified.mjs`

This migration marks every user profile in the `users` collection as `emailVerified: true`. It only updates profiles where the field is missing or false, and it updates records in batches of 500 to keep the migration safe for large datasets.

### Running the Migration

```bash
node scripts/migrations/backfill-email-verified.mjs
```

### Notes

- Ensure the Firebase Admin SDK is configured as described above before running this script.
- The migration logs progress as it scans and updates user profiles.

## Migration: Copy Organization Fields to Profiles

### File: `migrate-org-fields-to-profiles.mjs`

This migration copies organization-related fields from the `users` collection into existing documents in the `profiles` collection. It is idempotent and skips profiles already marked as migrated.

Fields migrated:

- `companyId`
- `companyCode`
- `companyName`
- `transformationTier`
- `villageId`
- `clusterId`
- `corporateVillageId`
- `cohortIdentifier`
- `assignedOrganizations`

### Running the Migration

```bash
node scripts/migrations/migrate-org-fields-to-profiles.mjs
```

### Notes

- The script writes progress to the `migration_runs` collection and logs a summary report.
- Profiles that do not exist are skipped and reported.

## Reconciliation: Validate Organization Field Migration

### File: `reconcile-org-fields.mjs`

This reconciliation script compares organization fields between the `users` and `profiles` collections to confirm the migration completed successfully. It reports:

- Missing profiles for users
- Missing users for profiles
- Field-level mismatches across organization fields
- Sample mismatches for quick review

### Running the Reconciliation

```bash
node scripts/migrations/reconcile-org-fields.mjs --output reports/migration-reconciliation-report.json
```

### Report Output

- The report is saved as JSON (default: `reports/migration-reconciliation-report.json`).
- Use the report to document reconciliation results and identify follow-up fixes.
