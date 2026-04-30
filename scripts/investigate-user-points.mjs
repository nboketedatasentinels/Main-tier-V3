#!/usr/bin/env node

/**
 * Read-only investigation: reconstruct a single user's TRUE total points
 * from the underlying audit trails, regardless of what
 * `users/{uid}.totalPoints` or `profiles/{uid}.totalPoints` currently say.
 *
 * Sources consulted (in order of authority):
 *   1. pointsLedger        — canonical per-event ledger (sum = truth)
 *   2. points_transactions — secondary log; cross-check
 *   3. weeklyProgress      — per-week aggregate; cross-check
 *   4. points_verification_requests (status='approved') — should have hit ledger
 *   5. points_verification_requests (status='pending')  — claimed but not yet awarded
 *   6. impact_logs                                      — activity that should award points
 *   7. userBadges                                       — earned badges (context only)
 *
 * This script DOES NOT WRITE anything. It only reads.
 *
 * Usage:
 *   node scripts/investigate-user-points.mjs --name "Ayakwa Fobi"
 *   node scripts/investigate-user-points.mjs --email someone@x.com
 *   node scripts/investigate-user-points.mjs --uid <uid>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const valueOf = (name) => (flag(name) ? args[args.indexOf(name) + 1] : null)

const nameFilter = valueOf('--name')
const emailFilter = valueOf('--email')
const uidFilter = valueOf('--uid')

if (!nameFilter && !emailFilter && !uidFilter) {
  console.error('Provide one of: --name "First Last", --email someone@x.com, --uid <uid>')
  process.exit(1)
}

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

const sep = (label = '') =>
  console.log('\n' + '='.repeat(70) + (label ? `\n${label}` : ''))
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fmt = (n) => num(n).toLocaleString('en-US')
const ts = (v) => {
  if (!v) return '(none)'
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

const findUser = async () => {
  // --uid: direct lookup
  if (uidFilter) {
    const [pSnap, uSnap] = await Promise.all([
      db.collection('profiles').doc(uidFilter).get(),
      db.collection('users').doc(uidFilter).get(),
    ])
    return {
      uid: uidFilter,
      profile: pSnap.exists ? pSnap.data() : null,
      user: uSnap.exists ? uSnap.data() : null,
    }
  }

  // --email: query both collections
  if (emailFilter) {
    const lower = emailFilter.toLowerCase()
    const [pByEmail, uByEmail] = await Promise.all([
      db.collection('profiles').where('email', '==', lower).limit(5).get(),
      db.collection('users').where('email', '==', lower).limit(5).get(),
    ])
    const matches = new Map()
    for (const d of pByEmail.docs) matches.set(d.id, { profile: d.data(), user: null })
    for (const d of uByEmail.docs) {
      const existing = matches.get(d.id) ?? { profile: null, user: null }
      existing.user = d.data()
      matches.set(d.id, existing)
    }
    if (matches.size === 0) return null
    if (matches.size > 1) {
      console.warn(`WARNING: ${matches.size} users matched email "${emailFilter}". Showing first.`)
    }
    const [uid, val] = matches.entries().next().value
    return { uid, ...val }
  }

  // --name: scan profiles by fullName / firstName + lastName.
  // (No exact full-text search in Firestore; we scan and match in-process.)
  const target = nameFilter.toLowerCase().trim()
  const targetParts = target.split(/\s+/).filter(Boolean)
  const allProfiles = await db.collection('profiles').get()
  const candidates = []
  for (const d of allProfiles.docs) {
    const data = d.data() || {}
    const full = String(data.fullName ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`)
      .toLowerCase()
      .trim()
    if (!full) continue
    if (full === target) {
      candidates.unshift({ uid: d.id, profile: data, score: 100 })
      continue
    }
    // Fuzzy: every word in target appears in full
    if (targetParts.every((p) => full.includes(p))) {
      candidates.push({ uid: d.id, profile: data, score: 50 })
    }
  }
  if (candidates.length === 0) return null
  if (candidates.length > 1) {
    console.warn(`Found ${candidates.length} candidates matching "${nameFilter}":`)
    for (const c of candidates.slice(0, 10)) {
      console.warn(`  ${c.uid}  ${c.profile.fullName ?? '(no name)'}  ${c.profile.email ?? ''}`)
    }
    console.warn('Re-run with --uid <uid> or --email to disambiguate.')
  }
  const best = candidates[0]
  const userSnap = await db.collection('users').doc(best.uid).get()
  return {
    uid: best.uid,
    profile: best.profile,
    user: userSnap.exists ? userSnap.data() : null,
  }
}

const sumCollection = async (collectionName, uidFields, pointsField = 'points') => {
  const total = { count: 0, points: 0, perWeek: new Map(), perSource: new Map(), samples: [] }
  for (const uidField of uidFields) {
    const snap = await db.collection(collectionName).where(uidField, '==', user.uid).get()
    for (const d of snap.docs) {
      const data = d.data() || {}
      const pts = num(data[pointsField] ?? data.pointsEarned ?? data.points)
      total.count += 1
      total.points += pts
      const wk = data.weekNumber ?? data.week ?? '?'
      total.perWeek.set(wk, num(total.perWeek.get(wk)) + pts)
      const src = data.source ?? data.sourceType ?? data.category ?? data.activityId ?? '(unknown)'
      total.perSource.set(src, num(total.perSource.get(src)) + pts)
      if (total.samples.length < 5) {
        total.samples.push({
          id: d.id,
          points: pts,
          activity: data.activityId ?? data.activity_id ?? data.category ?? '?',
          week: wk,
          source: src,
          createdAt: ts(data.createdAt ?? data.created_at ?? data.timestamp),
        })
      }
    }
  }
  return total
}

let user
const main = async () => {
  sep('STEP 1 — Locate user')
  user = await findUser()
  if (!user) {
    console.error('User not found.')
    process.exit(1)
  }
  console.log(`uid:           ${user.uid}`)
  console.log(`fullName:      ${user.profile?.fullName ?? user.user?.fullName ?? '(none)'}`)
  console.log(`email:         ${user.profile?.email ?? user.user?.email ?? '(none)'}`)
  console.log(`companyId:     ${user.profile?.companyId ?? user.user?.companyId ?? '(none)'}`)
  console.log(`companyCode:   ${user.profile?.companyCode ?? user.user?.companyCode ?? '(none)'}`)
  console.log(`village:       ${user.profile?.village ?? user.profile?.villageId ?? '(none)'}`)
  console.log(`cluster:       ${user.profile?.cluster ?? user.profile?.clusterId ?? '(none)'}`)
  console.log(`journeyType:   ${user.profile?.journeyType ?? user.user?.journeyType ?? '(none)'}`)
  console.log(`journeyStart:  ${ts(user.profile?.journeyStartDate ?? user.user?.journeyStartDate)}`)
  console.log(`createdAt:     ${ts(user.profile?.createdAt ?? user.user?.createdAt)}`)
  console.log(`lastActiveAt:  ${ts(user.profile?.lastActiveAt ?? user.user?.lastActiveAt)}`)
  console.log('')
  console.log(`profiles.totalPoints: ${fmt(user.profile?.totalPoints)}`)
  console.log(`users.totalPoints:    ${fmt(user.user?.totalPoints)}`)
  console.log(`profiles.level:       ${num(user.profile?.level)}`)
  console.log(`users.level:          ${num(user.user?.level)}`)

  sep('STEP 2 — Sum pointsLedger (canonical truth)')
  const ledger = await sumCollection('pointsLedger', ['uid', 'userId'])
  console.log(`Ledger entries:  ${ledger.count}`)
  console.log(`Ledger sum:      ${fmt(ledger.points)} points`)
  if (ledger.perWeek.size > 0) {
    console.log('\nBy week:')
    const weeks = [...ledger.perWeek.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
    for (const [wk, pts] of weeks) console.log(`  week ${wk}:  ${fmt(pts)}`)
  }
  if (ledger.perSource.size > 0) {
    console.log('\nBy source:')
    for (const [src, pts] of [...ledger.perSource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(src).padEnd(30)}  ${fmt(pts)}`)
    }
  }
  if (ledger.samples.length > 0) {
    console.log('\nSample entries (first 5):')
    for (const s of ledger.samples) {
      console.log(`  ${s.id}  +${fmt(s.points)}  wk=${s.week}  src=${s.source}  at=${s.createdAt}`)
    }
  }

  sep('STEP 3 — Sum points_transactions (secondary log)')
  const tx = await sumCollection('points_transactions', ['userId', 'uid'])
  console.log(`Transaction entries: ${tx.count}`)
  console.log(`Transaction sum:     ${fmt(tx.points)} points`)
  if (tx.perSource.size > 0) {
    console.log('\nBy category:')
    for (const [src, pts] of [...tx.perSource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(src).padEnd(30)}  ${fmt(pts)}`)
    }
  }

  sep('STEP 4 — Sum weeklyProgress (per-week aggregate)')
  const wp = await sumCollection('weeklyProgress', ['uid', 'userId'], 'pointsEarned')
  console.log(`weeklyProgress docs: ${wp.count}`)
  console.log(`weeklyProgress sum:  ${fmt(wp.points)} points`)

  sep('STEP 5 — Verification requests (manual claim audit)')
  const vrApproved = await db
    .collection('points_verification_requests')
    .where('user_id', '==', user.uid)
    .where('status', '==', 'approved')
    .get()
  let vrApprovedSum = 0
  for (const d of vrApproved.docs) vrApprovedSum += num(d.data().points)
  console.log(`Approved claims:  ${vrApproved.size}  (worth ${fmt(vrApprovedSum)} pts)`)

  const vrPending = await db
    .collection('points_verification_requests')
    .where('user_id', '==', user.uid)
    .where('status', '==', 'pending')
    .get()
  let vrPendingSum = 0
  for (const d of vrPending.docs) vrPendingSum += num(d.data().points)
  console.log(`Pending claims:   ${vrPending.size}  (worth ${fmt(vrPendingSum)} pts if approved)`)
  if (vrPending.size > 0) {
    console.log('\nPending claim details:')
    for (const d of vrPending.docs.slice(0, 10)) {
      const x = d.data()
      console.log(`  ${d.id}  +${fmt(x.points)}  wk=${x.week ?? '?'}  activity=${x.activity_id ?? '?'}  at=${ts(x.created_at)}`)
    }
  }

  sep('STEP 6 — Impact logs')
  const impactSnap = await db.collection('impact_logs').where('userId', '==', user.uid).get()
  console.log(`impact_logs entries: ${impactSnap.size}`)

  sep('STEP 7 — Badges (context)')
  const badgeSnap = await db.collection('userBadges').where('userId', '==', user.uid).get()
  console.log(`userBadges:          ${badgeSnap.size}`)
  if (badgeSnap.size > 0) {
    for (const d of badgeSnap.docs) {
      console.log(`  - ${d.data().badgeId ?? d.id}  at=${ts(d.data().createdAt)}`)
    }
  }

  sep('VERDICT')
  const stored = Math.max(num(user.profile?.totalPoints), num(user.user?.totalPoints))
  const truth = ledger.points
  console.log(`Stored totalPoints:        ${fmt(stored)}`)
  console.log(`Reconstructed (ledger):    ${fmt(truth)}`)
  console.log(`Cross-check (transactions): ${fmt(tx.points)}`)
  console.log(`Pending (would add if approved): ${fmt(vrPendingSum)}`)
  console.log('')
  if (truth > stored) {
    console.log(`MISSING POINTS: ${fmt(truth - stored)}`)
    console.log('   → Aggregate fields are stale. Ledger has the real history.')
    console.log('   → Recovery is straightforward: write the ledger sum back.')
  } else if (truth === 0 && tx.points === 0 && vrApproved.size === 0 && impactSnap.size === 0 && badgeSnap.size === 0) {
    console.log('No activity history found across any audit trail.')
    console.log('   → User may have engaged outside the points-claim flows,')
    console.log('     or claims were made on a different uid (duplicate account?).')
  } else {
    console.log('Stored value matches reconstruction. No drift detected.')
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
