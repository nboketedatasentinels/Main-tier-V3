#!/usr/bin/env node

/**
 * RECOVERY SCRIPT — fix the architectural split for impact-log points.
 *
 * Background:
 *   awardPointsForImpactLog() (src/services/pointsTransactionService.ts)
 *   wrote impact-log awards into points_transactions and user_journeys.
 *   It NEVER wrote to pointsLedger or users/{uid}.totalPoints —
 *   so the leaderboard (which reads profiles/{uid}.totalPoints) shows 0
 *   for users whose points came entirely through impact logs.
 *
 * What this script does (per affected uid):
 *   1. Read every points_transactions row where
 *        userId == uid AND sourceType == 'impact_log_entry'.
 *      The pointsAwarded field on those rows is the truth of what was earned.
 *   2. For each row that doesn't already have a corresponding pointsLedger
 *      entry, write one. Doc id is derived from the tx id so re-runs are
 *      idempotent.
 *   3. Re-sum the full pointsLedger for the uid and write
 *      totalPoints + level into both users/{uid} and profiles/{uid}.
 *
 * Why re-sum the WHOLE ledger and not just += impact-log points:
 *   The user may already have non-impact-log points (checklist awards, etc.)
 *   correctly written via pointsService.awardPoints(). Re-summing makes the
 *   final total = canonical truth, regardless of prior drift.
 *
 * Usage:
 *   node scripts/recover-impact-log-points.mjs --uid <uid>
 *   node scripts/recover-impact-log-points.mjs --uid <uid> --apply
 *
 *   # Process every learner in an org:
 *   node scripts/recover-impact-log-points.mjs --code ORGPJW
 *   node scripts/recover-impact-log-points.mjs --code ORGPJW --apply
 *
 *   # Process every learner platform-wide:
 *   node scripts/recover-impact-log-points.mjs --all
 *   node scripts/recover-impact-log-points.mjs --all --apply
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
const uidFilter = valueOf('--uid')
const orgCode = valueOf('--code')
const orgId = valueOf('--org')
const isAll = flag('--all')

if (!uidFilter && !orgCode && !orgId && !isAll) {
  console.error('Provide --uid <uid> or --code <orgCode> or --org <orgId> or --all')
  process.exit(1)
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))),
})
const db = getFirestore()

const LEVEL_STEP = 500
const MIN_LEVEL = 1
const calculateLevel = (totalPoints) => {
  const normalized = Math.max(0, Number.isFinite(totalPoints) ? totalPoints : 0)
  return Math.max(MIN_LEVEL, Math.floor(normalized / LEVEL_STEP) + 1)
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fmt = (n) => num(n).toLocaleString('en-US')

const collectTargetUids = async () => {
  if (uidFilter) return [uidFilter]
  if (isAll) {
    const snap = await db.collection('profiles').get()
    return snap.docs.map((d) => d.id)
  }
  let q = db.collection('profiles')
  q = orgId ? q.where('companyId', '==', orgId) : q.where('companyCode', '==', orgCode)
  const snap = await q.get()
  return snap.docs.map((d) => d.id)
}

// Returns a deterministic ledger doc id for a given transaction.
// Includes the source impact_log entry id so idempotency holds even if
// transactions are deleted and recreated.
const ledgerIdFor = (tx) => `impact_log_recovery__${tx.id}`

const recoverOne = async (uid) => {
  const txSnap = await db
    .collection('points_transactions')
    .where('userId', '==', uid)
    .where('sourceType', '==', 'impact_log_entry')
    .get()

  // Existing ledger entries that came from this recovery
  const existingLedger = await db
    .collection('pointsLedger')
    .where('uid', '==', uid)
    .where('source', '==', 'impact_log_recovery')
    .get()
  const alreadyRecovered = new Set(existingLedger.docs.map((d) => d.id))

  let toCreate = 0
  let recoverPoints = 0
  const writes = []
  for (const txDoc of txSnap.docs) {
    const tx = { id: txDoc.id, ...txDoc.data() }
    const points = num(tx.pointsAwarded ?? tx.points)
    if (points <= 0) continue

    const ledgerId = ledgerIdFor(tx)
    if (alreadyRecovered.has(ledgerId)) continue

    toCreate += 1
    recoverPoints += points
    writes.push({
      ledgerId,
      points,
      sourceId: tx.sourceId,
      journeyType: tx.journeyType,
      windowId: tx.windowId,
      awardedAt: tx.awardedAt,
    })
  }

  // Read current state for reporting
  const [profileSnap, userSnap] = await Promise.all([
    db.collection('profiles').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ])
  const currentProfileTotal = num(profileSnap.data()?.totalPoints)
  const currentUserTotal = num(userSnap.data()?.totalPoints)
  const name =
    profileSnap.data()?.fullName ?? userSnap.data()?.fullName ?? '(no name)'

  // Compute the proposed final total. We need to re-sum the WHOLE ledger
  // (existing + about-to-be-written) to get the truthful total.
  const fullLedgerSnap = await db
    .collection('pointsLedger')
    .where('uid', '==', uid)
    .get()
  let existingLedgerSum = 0
  for (const d of fullLedgerSnap.docs) existingLedgerSum += num(d.data().points)

  const proposedTotal = existingLedgerSum + recoverPoints
  const proposedLevel = calculateLevel(proposedTotal)

  const hasDrift =
    toCreate > 0 ||
    currentProfileTotal !== proposedTotal ||
    currentUserTotal !== proposedTotal

  // In --all mode, only print users that need a change to keep the log readable.
  // For single-user / single-org runs, print everyone for full visibility.
  if (!isAll || hasDrift) {
    console.log(
      `\n${name}  (${uid})`,
      `\n  current: profiles=${fmt(currentProfileTotal)} users=${fmt(currentUserTotal)}`,
      `\n  ledger now: ${fmt(existingLedgerSum)} (${fullLedgerSnap.size} entries)`,
      `\n  impact-log txs to recover: ${toCreate} entries worth ${fmt(recoverPoints)} pts`,
      `\n  proposed final total: ${fmt(proposedTotal)} (level ${proposedLevel})`,
    )
  }

  if (!isApply) return { uid, toCreate, recoverPoints, proposedTotal, hasDrift }

  if (toCreate === 0 && currentProfileTotal === proposedTotal && currentUserTotal === proposedTotal) {
    console.log('  [skip] already correct')
    return { uid, toCreate: 0, recoverPoints: 0, proposedTotal }
  }

  // Firestore batches max out at 500 ops; we have ledger writes + 2 doc updates.
  // 35 ledger + 2 = 37 max for a single user. Single batch is fine.
  const batch = db.batch()
  const nowIso = new Date().toISOString()

  for (const w of writes) {
    const ledgerRef = db.collection('pointsLedger').doc(w.ledgerId)
    batch.set(ledgerRef, {
      uid,
      activityId: 'impact_log_entry',
      points: w.points,
      source: 'impact_log_recovery',
      claimRef: w.sourceId ?? null,
      approvalType: 'auto',
      journeyType: w.journeyType ?? null,
      windowId: w.windowId ?? null,
      originalAwardedAt: w.awardedAt ?? null,
      recoveredAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  const update = {
    totalPoints: proposedTotal,
    level: proposedLevel,
    pointsVersion: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }
  batch.set(db.collection('users').doc(uid), update, { merge: true })
  batch.set(db.collection('profiles').doc(uid), update, { merge: true })

  await batch.commit()
  console.log(`  [APPLIED] +${fmt(recoverPoints)} pts → totalPoints=${fmt(proposedTotal)}, level=${proposedLevel}`)
  return { uid, toCreate, recoverPoints, proposedTotal, applied: true }
}

const main = async () => {
  console.log(`Mode: ${isApply ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`)
  const uids = await collectTargetUids()
  console.log(`Target uids: ${uids.length}`)

  let totalRecovered = 0
  let usersChanged = 0
  let usersWithMirrorDrift = 0
  for (const uid of uids) {
    const r = await recoverOne(uid)
    if (r.toCreate > 0) {
      usersChanged += 1
      totalRecovered += r.recoverPoints
    }
    if (r.hasDrift) usersWithMirrorDrift += 1
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Users scanned:                  ${uids.length}`)
  console.log(`Users with any drift:           ${usersWithMirrorDrift}`)
  console.log(`Users with recoverable points:  ${usersChanged}`)
  console.log(`Total points to recover:        ${fmt(totalRecovered)}`)
  if (!isApply) console.log('\nRe-run with --apply to commit.')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
