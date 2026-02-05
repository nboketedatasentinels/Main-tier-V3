import admin from 'firebase-admin'

// Usage:
//   - Set env vars (recommended):
//       - FIREBASE_PROJECT_ID=transformation-tier
//       - FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
//   - Then run:
//       node scripts/ensure-firestore-collections.mjs
//
// Options:
//   --dry-run   Print what would be created without writing.

const COLLECTIONS = [
  'activities',
  'activity_types',
  'adminRoleHistory',
  'admin_activity_log',
  'admin_notifications',
  'admin_settings',
  'approvals',
  'assigned_courses',
  'bookClubVisits',
  'book_club_books',
  'challenges',
  'companies',
  'courses',
  'engagement_point_logs',
  'eventAuditLogs',
  'forum_posts',
  'forum_replies',
  'free_user_points_limits',
  'friend_requests',
  'friends',
  'impactEntries',
  'impact_entries',
  'impact_goals',
  'invitations',
  'mentorship_sessions',
  'notifications',
  'nudge_status_transitions',
  'nudge_templates',
  'onboarding_analytics',
  'onboarding_progress',
  'organization_capacity_metrics',
  'organizations',
  'partner_daily_digest_queue',
  'partners',
  'payments',
  'peer_preferences',
  'peer_session_requests',
  'peer_sessions',
  'peer_weekly_matches',
  'platform_config',
  'pointsLedger',
  'points_transactions',
  'points_verification_requests',
  'profile_access_logs',
  'profiles',
  'proof_submissions',
  'referralCodes',
  'referrals',
  'resources',
  'shameless_workbooks',
  'shared_resources',
  'tutorial_completions',
  'typing_status',
  'user_badges',
  'user_courses',
  'user_daily_micro_challenges',
  'user_points',
  'users',
  'village_chat_messages',
  'village_invitations',
  'weekly_activity_templates',
  'weekly_checklist',
  'weekly_points',
  'weekly_progress',
  'weekly_tasks',
  'workshop_suggestion_votes',
]

const PLACEHOLDER_DOC_ID = '__collection_init__'

const parseArgs = () => {
  const args = new Set(process.argv.slice(2))
  return {
    dryRun: args.has('--dry-run'),
  }
}

const initAdmin = () => {
  if (admin.apps.length) return

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id,
  })
}

const ensureCollections = async ({ dryRun }) => {
  initAdmin()

  const projectId =
    admin.app().options.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    '(unknown project)'

  const uniqueCollections = [...new Set(COLLECTIONS)]
  if (uniqueCollections.length !== COLLECTIONS.length) {
    console.warn(
      `Duplicate collection names detected: ${
        COLLECTIONS.length - uniqueCollections.length
      } duplicates will be skipped.`,
    )
  }

  console.log(
    `Ensuring ${uniqueCollections.length} collections exist in Firestore project: ${projectId}`,
  )
  if (dryRun) console.log('Running in --dry-run mode (no writes).')

  const db = admin.firestore()
  const { serverTimestamp } = admin.firestore.FieldValue

  const created = []
  const skipped = []

  for (const collectionName of uniqueCollections) {
    const snap = await db.collection(collectionName).limit(1).get()
    if (!snap.empty) {
      skipped.push(collectionName)
      continue
    }

    if (dryRun) {
      created.push(collectionName)
      continue
    }

    await db.collection(collectionName).doc(PLACEHOLDER_DOC_ID).set(
      {
        __placeholder: true,
        __createdAt: serverTimestamp(),
        __createdBy: 'scripts/ensure-firestore-collections.mjs',
      },
      { merge: true },
    )

    created.push(collectionName)
  }

  console.log(
    `Done. ${dryRun ? 'Would create' : 'Created'} ${created.length} collections; skipped ${skipped.length} already-present collections.`,
  )

  if (created.length) console.log(`${dryRun ? 'Would create' : 'Created'}: ${created.join(', ')}`)
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`)
}

ensureCollections(parseArgs()).catch((error) => {
  console.error('Failed to ensure Firestore collections:', error)
  process.exit(1)
})

