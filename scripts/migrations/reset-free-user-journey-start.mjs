/**
 * Migration Script: Reset journey start date for all free users
 *
 * For every user with role === 'free_user', sets:
 *   - journeyStartDate = today at 00:00:00 UTC (ISO string)
 *   - currentWeek      = 1
 *   - updatedAt        = serverTimestamp()
 *
 * Writes to BOTH `profiles` and `users` collections (the mirror pattern used
 * across the app — see AuthContext dual-write and superAdminService's
 * cascadeCohortStartDateToProfiles for precedent).
 *
 * Usage:
 *   # 1. Point at your service account:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *
 *   # 2. Dry run first (no writes):
 *   node scripts/migrations/reset-free-user-journey-start.mjs --dry-run
 *
 *   # 3. Apply for real:
 *   node scripts/migrations/reset-free-user-journey-start.mjs
 *
 * Options:
 *   --dry-run           Preview changes without writing.
 *   --date=YYYY-MM-DD   Override the start date (defaults to today UTC).
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1]

function resolveIsoStartDate(override) {
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      throw new Error(`Invalid --date value "${override}". Expected YYYY-MM-DD.`)
    }
    const [y, m, d] = override.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toISOString()
  }
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

const TARGET_ROLE = 'free_user'
const BATCH_SIZE = 450 // matches cascadeCohortStartDateToProfiles precedent

try {
  initializeApp({ credential: applicationDefault() })
} catch (error) {
  if (!/already exists/i.test(error?.message ?? '')) throw error
}

const db = getFirestore()

async function collectUidsWithRole(collectionName, role) {
  const snap = await db
    .collection(collectionName)
    .where('role', '==', role)
    .get()
  return new Set(snap.docs.map((d) => d.id))
}

async function commitBatch(ops) {
  if (ops.length === 0) return
  const batch = db.batch()
  for (const { ref, data } of ops) batch.update(ref, data)
  await batch.commit()
}

async function run() {
  const isoStart = resolveIsoStartDate(dateArg)

  console.log('='.repeat(64))
  console.log('Reset journey start date for free users')
  console.log('='.repeat(64))
  console.log(`Mode:             ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(`Target role:      ${TARGET_ROLE}`)
  console.log(`journeyStartDate: ${isoStart}`)
  console.log(`currentWeek:      1`)
  console.log('')

  console.log('Querying free users in both collections...')
  const [profileUids, userUids] = await Promise.all([
    collectUidsWithRole('profiles', TARGET_ROLE),
    collectUidsWithRole('users', TARGET_ROLE),
  ])

  const allUids = new Set([...profileUids, ...userUids])
  console.log(`  profiles.role == free_user: ${profileUids.size}`)
  console.log(`  users.role    == free_user: ${userUids.size}`)
  console.log(`  union (unique UIDs):        ${allUids.size}`)

  const onlyInProfiles = [...profileUids].filter((u) => !userUids.has(u))
  const onlyInUsers = [...userUids].filter((u) => !profileUids.has(u))
  if (onlyInProfiles.length > 0) {
    console.log(
      `  note: ${onlyInProfiles.length} UID(s) in profiles but not users (users mirror will be skipped for these)`,
    )
  }
  if (onlyInUsers.length > 0) {
    console.log(
      `  note: ${onlyInUsers.length} UID(s) in users but not profiles (profile update will be skipped for these)`,
    )
  }

  if (allUids.size === 0) {
    console.log('\nNothing to do. Exiting.')
    return
  }

  const updatePayload = {
    journeyStartDate: isoStart,
    currentWeek: 1,
    updatedAt: FieldValue.serverTimestamp(),
  }

  const pending = []
  for (const uid of allUids) {
    if (profileUids.has(uid)) {
      pending.push({
        ref: db.collection('profiles').doc(uid),
        data: updatePayload,
      })
    }
    if (userUids.has(uid)) {
      pending.push({
        ref: db.collection('users').doc(uid),
        data: updatePayload,
      })
    }
  }

  console.log(`\nTotal document writes to perform: ${pending.length}`)
  console.log(
    `  profiles writes: ${pending.filter((p) => p.ref.parent.id === 'profiles').length}`,
  )
  console.log(
    `  users writes:    ${pending.filter((p) => p.ref.parent.id === 'users').length}`,
  )

  if (isDryRun) {
    console.log('\n[DRY RUN] No writes performed. Sample of first 5 UIDs:')
    ;[...allUids].slice(0, 5).forEach((uid) => console.log(`  - ${uid}`))
    console.log(
      '\nRun again without --dry-run to apply. Point GOOGLE_APPLICATION_CREDENTIALS at the prod service account.',
    )
    return
  }

  let committed = 0
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE)
    await commitBatch(chunk)
    committed += chunk.length
    console.log(`  committed ${committed} / ${pending.length}`)
  }

  console.log('\n='.repeat(64))
  console.log(`Done. Updated ${allUids.size} free users (${pending.length} docs).`)
  console.log('='.repeat(64))
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nMigration failed:', err)
    process.exit(1)
  })
