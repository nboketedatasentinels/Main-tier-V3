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

// Per-journey impact_log totalFrequency caps from src/config/pointsConfig.ts
// JOURNEY_ACTIVITY_CONFIG. Source of truth — keep in sync if the catalog changes.
// Recovery MUST honor these or we re-create the 2026-05-07 over-credit incident
// where transactions written under looser legacy caps got replayed verbatim.
const IMPACT_LOG_CAP_BY_JOURNEY = {
  '4W': 2,
  '6W': 4,
  '3M': 6,
  '6M': 12,
  '9M': 18,
}

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

  // Existing ledger entries from ANY source for this user that are tied to an
  // impact_log activity. We must NOT recover a tx if a canonical ledger entry
  // already exists for the same impact_log_entry (matched by claimRef =
  // points_transactions.sourceId), or we will double-count. This is the case
  // for entries that went through pointsService normally on or after the fix
  // in commit 61f674f8 — they have source like 'impact_log_submission' or
  // 'auto', not 'impact_log_recovery', so the dedupe set above misses them.
  const allImpactLogLedgerSnap = await db
    .collection('pointsLedger')
    .where('uid', '==', uid)
    .where('activityId', '==', 'impact_log')
    .get()
  const ledgeredImpactLogClaimRefs = new Set(
    allImpactLogLedgerSnap.docs
      .map((d) => d.data()?.claimRef)
      .filter((ref) => typeof ref === 'string' && ref.length > 0),
  )

  // Read current state up-front so we know the user's CURRENT journey for cap math.
  const [profileSnap, userSnap] = await Promise.all([
    db.collection('profiles').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ])
  const currentProfileTotal = num(profileSnap.data()?.totalPoints)
  const currentUserTotal = num(userSnap.data()?.totalPoints)
  const name =
    profileSnap.data()?.fullName ?? userSnap.data()?.fullName ?? '(no name)'
  const currentJourney = profileSnap.data()?.journeyType ?? userSnap.data()?.journeyType ?? null

  // Cap enforcement: count impact_log ledger entries the user already has
  // (from any source, not just prior recoveries) and only allow recovery up
  // to the journey's totalFrequency. Trusting tx rows verbatim past the cap
  // re-creates the 2026-05-07 over-credit incident.
  const existingImpactLogSnap = await db
    .collection('pointsLedger')
    .where('uid', '==', uid)
    .where('activityId', '==', 'impact_log')
    .get()
  const existingImpactLogCount = existingImpactLogSnap.size

  const journeyCap = IMPACT_LOG_CAP_BY_JOURNEY[currentJourney] ?? null
  const slotsAvailable = journeyCap == null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, journeyCap - existingImpactLogCount)

  // Journey-window filter: only recover transactions awarded ON OR AFTER the
  // user's current journeyStartDate. Without this, the script credits the
  // user's CURRENT journey with activity from a previous cohort/iteration,
  // inflating their total. This is the bug that gave syntiche musawu 6,000
  // phantom pts on 2026-05-08 — three impact-log entries dated 2026-04-08/09/14
  // were ledgered against her 6W journey that started 2026-04-15.
  const journeyStartIsoForFilter = profileSnap.data()?.journeyStartDate
    ?? userSnap.data()?.journeyStartDate
    ?? null
  const journeyStart = journeyStartIsoForFilter ? new Date(journeyStartIsoForFilter) : null

  // Sort tx rows oldest-first so the entries that "win" the cap are the
  // earliest legitimate ones, not arbitrary later rows.
  const sortedTxDocs = [...txSnap.docs].sort((a, b) => {
    const aAt = a.data()?.awardedAt ?? ''
    const bAt = b.data()?.awardedAt ?? ''
    return String(aAt).localeCompare(String(bAt))
  })

  let toCreate = 0
  let recoverPoints = 0
  let skippedOverCap = 0
  let skippedOverCapPoints = 0
  let skippedPreJourney = 0
  let skippedPreJourneyPoints = 0
  let skippedNoImpactLog = 0
  const writes = []
  for (const txDoc of sortedTxDocs) {
    const tx = { id: txDoc.id, ...txDoc.data() }
    const points = num(tx.pointsAwarded ?? tx.points)
    if (points <= 0) continue

    const ledgerId = ledgerIdFor(tx)
    if (alreadyRecovered.has(ledgerId)) continue

    // Skip if this exact impact_log entry is already ledgered under a
    // different source (e.g., the canonical impact_log_submission flow ran
    // for it). Match by tx.sourceId === ledger.claimRef.
    if (tx.sourceId && ledgeredImpactLogClaimRefs.has(tx.sourceId)) continue

    // Pre-journey filter — apply to BOTH tx.awardedAt AND the underlying
    // impact_logs.date. The latter catches the case where a tx was awarded
    // post-journey but the impact_logs entry it points to is dated before
    // the journey started (often the case for test data or backfills). See
    // the syntiche musawu incident on 2026-05-09 where one tx awardedAt
    // 2026-04-17 referred to an impact_log dated 2026-04-09.
    if (journeyStart) {
      const awardedAt = tx.awardedAt ? new Date(tx.awardedAt) : null
      const txAwardedPreJourney = awardedAt && !Number.isNaN(awardedAt.getTime())
        ? awardedAt < journeyStart
        : false

      let impactLogPreJourney = false
      let impactLogExists = true
      if (tx.sourceId) {
        const impactDoc = await db.collection('impact_logs').doc(tx.sourceId).get()
        if (!impactDoc.exists) {
          impactLogExists = false
        } else {
          const dateField = impactDoc.data()?.date || impactDoc.data()?.entryDate
          if (dateField) {
            const at = new Date(dateField)
            if (!Number.isNaN(at.getTime()) && at < journeyStart) {
              impactLogPreJourney = true
            }
          }
        }
      }

      if (!impactLogExists) {
        skippedNoImpactLog += 1
        continue
      }
      if (txAwardedPreJourney || impactLogPreJourney) {
        skippedPreJourney += 1
        skippedPreJourneyPoints += points
        continue
      }
    }

    if (writes.length >= slotsAvailable) {
      skippedOverCap += 1
      skippedOverCapPoints += points
      continue
    }

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
  if (!isAll || hasDrift || skippedOverCap > 0 || skippedPreJourney > 0) {
    const capLine = journeyCap == null
      ? `\n  cap: unknown journey (${currentJourney ?? 'null'}) — no enforcement`
      : `\n  cap: ${currentJourney} allows ${journeyCap} impact-log entries; existing=${existingImpactLogCount}, slots=${Number.isFinite(slotsAvailable) ? slotsAvailable : '∞'}`
    const journeyStartLine = journeyStart
      ? `\n  journey start: ${journeyStartIsoForFilter} (txs awarded before this are skipped)`
      : `\n  journey start: unknown — pre-journey filter NOT enforced`
    const overCapLine = skippedOverCap > 0
      ? `\n  SKIPPED OVER-CAP: ${skippedOverCap} tx rows worth ${fmt(skippedOverCapPoints)} pts (would exceed catalog)`
      : ''
    const preJourneyLine = skippedPreJourney > 0
      ? `\n  SKIPPED PRE-JOURNEY: ${skippedPreJourney} tx rows worth ${fmt(skippedPreJourneyPoints)} pts (awarded before current journey started)`
      : ''
    console.log(
      `\n${name}  (${uid})`,
      `\n  current: profiles=${fmt(currentProfileTotal)} users=${fmt(currentUserTotal)}`,
      `\n  ledger now: ${fmt(existingLedgerSum)} (${fullLedgerSnap.size} entries)`,
      capLine,
      journeyStartLine,
      `\n  impact-log txs to recover: ${toCreate} entries worth ${fmt(recoverPoints)} pts`,
      overCapLine,
      preJourneyLine,
      `\n  proposed final total: ${fmt(proposedTotal)} (level ${proposedLevel})`,
    )
  }

  if (!isApply) return { uid, toCreate, recoverPoints, proposedTotal, hasDrift }

  // Always reconcile weeklyProgress in apply mode — even when totals match,
  // weeklyProgress can still be stale (e.g., a previous recovery run wrote
  // ledger but not weeklyProgress, or a manual ledger fix bypassed
  // pointsService). This is the field the Weekly Checklist UI reads, so
  // skipping it leaves the math inconsistent across pages.
  const journeyStartIso = profileSnap.data()?.journeyStartDate
    ?? userSnap.data()?.journeyStartDate
    ?? null

  if (toCreate === 0 && currentProfileTotal === proposedTotal && currentUserTotal === proposedTotal) {
    const wpResult = await reconcileWeeklyProgressFromLedger(uid, journeyStartIso)
    console.log(`  [skip] totals already correct; weeklyProgress reconciled ${wpResult.weeksWritten} weeks, sum=${fmt(wpResult.sum)}`)
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
      // Use the catalog activityId 'impact_log' so cap-aware reconcilers
      // recognize these as legitimate impact_log activities (subject to the
      // journey's totalFrequency cap). A previous version of this script
      // wrote 'impact_log_entry' which didn't match the catalog and caused
      // every recovered entry to be flagged as orphan / over-cap.
      activityId: 'impact_log',
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

  const wpResult = await reconcileWeeklyProgressFromLedger(uid, journeyStartIso)
  console.log(`  [APPLIED] +${fmt(recoverPoints)} pts → totalPoints=${fmt(proposedTotal)}, level=${proposedLevel}`)
  console.log(`  [WEEKLY-PROGRESS] reconciled ${wpResult.weeksWritten} weeks, sum=${fmt(wpResult.sum)}`)
  return { uid, toCreate, recoverPoints, proposedTotal, applied: true }
}

/**
 * Re-compute weeklyProgress for a user directly from pointsLedger.
 * Each ledger entry contributes to weeklyProgress[uid_<week>] keyed by:
 *   1. ledger.weekNumber if present (canonical for normal-flow awards)
 *   2. derived from originalAwardedAt + journeyStartDate (recovery entries)
 *   3. fallback to week 1 if no date is recoverable
 *
 * Idempotent: writes the FULL ledger sum per week each run, so re-running
 * on a clean state is a no-op.
 */
const reconcileWeeklyProgressFromLedger = async (uid, journeyStartIso) => {
  const start = journeyStartIso ? new Date(journeyStartIso) : null
  const ledgerSnap = await db.collection('pointsLedger').where('uid', '==', uid).get()

  const byWeek = {}
  for (const d of ledgerSnap.docs) {
    const data = d.data()
    let wk = data.weekNumber
    if (typeof wk !== 'number') {
      const dateRef = data.originalAwardedAt || data.awardedAt
      if (dateRef && start) {
        const at = new Date(dateRef)
        const days = Math.floor((at.getTime() - start.getTime()) / 86400000)
        wk = Math.max(1, Math.floor(days / 7) + 1)
      } else {
        wk = 1
      }
    }
    byWeek[wk] = (byWeek[wk] || 0) + num(data.points)
  }

  const batch = db.batch()
  let weeksWritten = 0
  let sum = 0
  for (const [wkStr, pts] of Object.entries(byWeek)) {
    const wk = Number(wkStr)
    const ref = db.collection('weeklyProgress').doc(`${uid}__${wk}`)
    batch.set(
      ref,
      {
        uid,
        weekNumber: wk,
        pointsEarned: pts,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    weeksWritten += 1
    sum += pts
  }
  await batch.commit()
  return { weeksWritten, sum }
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
