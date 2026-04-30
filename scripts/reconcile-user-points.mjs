#!/usr/bin/env node

/**
 * One-shot reconciliation: ensure `users/{uid}.totalPoints` and
 * `profiles/{uid}.totalPoints` (and .level) match for every user.
 *
 * Why this matters:
 *   - AuthContext (the user's logged-in profile widget) reads `users/{uid}` first
 *   - The leaderboard reads `profiles/{uid}`
 *   - If those values diverge for any user, the leaderboard shows a different
 *     number than the user sees on their own profile.
 *
 * pointsService.awardPoints() dual-writes to keep them in sync, but legacy
 * data, partial backfills, or one-off scripts can introduce drift. This
 * script writes the MAX(users, profiles) value back to both collections so
 * the leaderboard and each user's own profile show the same number.
 *
 * The runtime listener also reconciles via Math.max() at read time, so this
 * script is for cleaning up persistent drift, not a hard requirement.
 *
 * Usage:
 *   node scripts/reconcile-user-points.mjs              # dry-run
 *   node scripts/reconcile-user-points.mjs --apply      # write changes
 *   node scripts/reconcile-user-points.mjs --org <id>   # restrict by orgId
 *   node scripts/reconcile-user-points.mjs --code <ORG> # restrict by orgCode
 *   node scripts/reconcile-user-points.mjs --limit 100  # cap docs scanned
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const valueOf = (name) => (flag(name) ? args[args.indexOf(name) + 1] : null)

const isApply = flag('--apply')
const orgFilter = valueOf('--org')
const codeFilter = valueOf('--code')
const scanLimit = valueOf('--limit') ? parseInt(valueOf('--limit'), 10) : null

const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (error) {
  console.error('Could not read serviceAccountKey.json at', serviceAccountPath)
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const sep = (label = '') => console.log('\n' + '='.repeat(60) + (label ? `\n${label}` : ''))
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const matchesOrgFilter = (data) => {
  if (orgFilter) {
    return data?.companyId === orgFilter || data?.organizationId === orgFilter
  }
  if (codeFilter) {
    return data?.companyCode === codeFilter || data?.organizationCode === codeFilter
  }
  return true
}

const loadCollection = async (name) => {
  const map = new Map()
  let q = db.collection(name)
  if (orgFilter) q = q.where('companyId', '==', orgFilter)
  if (codeFilter && !orgFilter) q = q.where('companyCode', '==', codeFilter)
  const snap = await q.get()
  for (const d of snap.docs) {
    const data = d.data() || {}
    if (!matchesOrgFilter(data)) continue
    map.set(d.id, { ref: d.ref, data })
    if (scanLimit && map.size >= scanLimit) break
  }
  return map
}

const run = async () => {
  console.log(`Mode:    ${isApply ? 'APPLY (writing to Firestore)' : 'DRY RUN (no writes)'}`)
  console.log(`Filter:  ${orgFilter ? `org=${orgFilter}` : codeFilter ? `code=${codeFilter}` : 'ALL users'}`)
  if (scanLimit) console.log(`Limit:   ${scanLimit}`)

  sep('Step 1: Load profiles/ and users/')
  const [profilesMap, usersMap] = await Promise.all([
    loadCollection('profiles'),
    loadCollection('users'),
  ])
  console.log(`profiles loaded: ${profilesMap.size}`)
  console.log(`users    loaded: ${usersMap.size}`)

  // Union of all uids from both collections
  const allUids = new Set([...profilesMap.keys(), ...usersMap.keys()])

  const drifts = []
  for (const uid of allUids) {
    const p = profilesMap.get(uid)
    const u = usersMap.get(uid)
    const pPoints = num(p?.data?.totalPoints)
    const uPoints = num(u?.data?.totalPoints)
    const pLevel = num(p?.data?.level)
    const uLevel = num(u?.data?.level)

    const targetPoints = Math.max(pPoints, uPoints)
    const targetLevel = Math.max(pLevel, uLevel, 1)

    const profileNeedsWrite =
      p && (pPoints !== targetPoints || pLevel !== targetLevel)
    const userNeedsWrite =
      u && (uPoints !== targetPoints || uLevel !== targetLevel)

    if (!profileNeedsWrite && !userNeedsWrite) continue

    drifts.push({
      uid,
      email: p?.data?.email ?? u?.data?.email ?? '(unknown)',
      pPoints,
      uPoints,
      targetPoints,
      pLevel,
      uLevel,
      targetLevel,
      profileRef: p?.ref ?? null,
      userRef: u?.ref ?? null,
      profileNeedsWrite,
      userNeedsWrite,
    })
  }

  console.log(`\nDrift detected on ${drifts.length} user(s).`)

  if (drifts.length === 0) {
    console.log('All collections are already in sync. Nothing to do.')
    return
  }

  sep('Step 2: Show drift summary (first 15)')
  drifts.slice(0, 15).forEach((d, i) => {
    console.log(
      `[${i + 1}] ${d.uid}  email=${d.email}\n` +
      `     profiles=${d.pPoints} pts/lvl ${d.pLevel}  ` +
      `users=${d.uPoints} pts/lvl ${d.uLevel}  ` +
      `→ target=${d.targetPoints} pts/lvl ${d.targetLevel}`
    )
  })
  if (drifts.length > 15) console.log(`\n…and ${drifts.length - 15} more.`)

  sep('Step 3: Apply or skip')
  if (!isApply) {
    console.log(`Dry run: would reconcile ${drifts.length} user(s).`)
    console.log('Re-run with --apply to commit.')
    return
  }

  let writes = 0
  for (const d of drifts) {
    const payload = {
      totalPoints: d.targetPoints,
      level: d.targetLevel,
      pointsReconciledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (d.profileNeedsWrite && d.profileRef) {
      await d.profileRef.set(payload, { merge: true })
      writes++
    }
    if (d.userNeedsWrite && d.userRef) {
      await d.userRef.set(payload, { merge: true })
      writes++
    }
  }
  console.log(`\nDone. ${writes} document writes across ${drifts.length} users.`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
