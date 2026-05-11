#!/usr/bin/env node

/**
 * RECOVERY SCRIPT — rebuild users.assignedOrganizations and
 * profiles.assignedOrganizations from the canonical org-side field
 * (organizations.transformationPartnerId).
 *
 * Background:
 *   When an admin assigns a partner to an org, assignLeadershipRole sets
 *   organizations/{orgId}.transformationPartnerId in a transaction (always
 *   succeeds), then calls syncOrganizationPartnerChange to mirror the
 *   assignment onto the partner doc(s). Historically the mirror used
 *   updateDoc + a try/catch that swallowed "doc not found" errors, so any
 *   partner whose users/{uid} doc didn't yet exist ended up with a stale
 *   assignedOrganizations array.
 *
 *   The runtime fix makes the partner dashboard's dropdown read
 *   transformationPartnerId directly, so the user-facing symptom is gone
 *   going forward. But the existing arrays in users/profiles stay stale,
 *   and other code paths that trust those arrays may still misbehave.
 *
 * What this script does (per partner uid):
 *   1. Find every organizations/{orgId} where transformationPartnerId == uid
 *      and status in {active, watch, paused}.
 *   2. Read users/{uid}.assignedOrganizations and
 *      profiles/{uid}.assignedOrganizations.
 *   3. Compute the union (no destructive removal — if some other code path
 *      legitimately added an org we don't know about, we keep it).
 *   4. Upsert both docs via setDoc(merge:true) with the union.
 *
 * Usage:
 *   node scripts/recover-partner-org-assignments.mjs --uid <uid>
 *   node scripts/recover-partner-org-assignments.mjs --uid <uid> --apply
 *
 *   # All partners platform-wide:
 *   node scripts/recover-partner-org-assignments.mjs --all
 *   node scripts/recover-partner-org-assignments.mjs --all --apply
 *
 * Dry-run by default — pass --apply to write.
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
const isAll = flag('--all')

if (!uidFilter && !isAll) {
  console.error('Provide --uid <uid> or --all')
  process.exit(1)
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))),
})
const db = getFirestore()

const VALID_ORG_STATUSES = new Set(['active', 'watch', 'paused'])

const collectTargetUids = async () => {
  if (uidFilter) return [uidFilter]
  const uids = new Set()
  for (const coll of ['users', 'profiles']) {
    const snap = await db.collection(coll).where('role', '==', 'partner').get()
    snap.docs.forEach((d) => uids.add(d.id))
  }
  return Array.from(uids)
}

const arraysEqual = (a, b) => {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  for (const item of b) if (!setA.has(item)) return false
  return true
}

const recoverOne = async (uid) => {
  const orgsSnap = await db
    .collection('organizations')
    .where('transformationPartnerId', '==', uid)
    .get()
  const canonicalOrgIds = orgsSnap.docs
    .filter((d) => VALID_ORG_STATUSES.has((d.data()?.status || 'active').toLowerCase()))
    .map((d) => d.id)

  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('profiles').doc(uid).get(),
  ])
  const existingUser = Array.isArray(userSnap.data()?.assignedOrganizations)
    ? userSnap.data().assignedOrganizations.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : []
  const existingProfile = Array.isArray(profileSnap.data()?.assignedOrganizations)
    ? profileSnap.data().assignedOrganizations.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : []

  const union = Array.from(new Set([...existingUser, ...existingProfile, ...canonicalOrgIds]))

  const userChanged = !arraysEqual(union, existingUser)
  const profileChanged = !arraysEqual(union, existingProfile)

  console.log(`\n[partner ${uid}]`)
  console.log(`  canonical (from organizations.transformationPartnerId): ${canonicalOrgIds.length}`)
  console.log(`  users/${uid}.assignedOrganizations: ${existingUser.length} → ${union.length} ${userChanged ? '(updating)' : '(no change)'}`)
  console.log(`  profiles/${uid}.assignedOrganizations: ${existingProfile.length} → ${union.length} ${profileChanged ? '(updating)' : '(no change)'}`)

  if (!userChanged && !profileChanged) return { uid, changed: false }
  if (!isApply) return { uid, changed: true, dryRun: true }

  const payload = {
    assignedOrganizations: union,
    assignedOrganizationsUpdatedAt: FieldValue.serverTimestamp(),
    assignedOrganizationsUpdatedBy: 'recovery-script',
  }
  await Promise.all([
    userChanged ? db.collection('users').doc(uid).set(payload, { merge: true }) : Promise.resolve(),
    profileChanged ? db.collection('profiles').doc(uid).set(payload, { merge: true }) : Promise.resolve(),
  ])
  return { uid, changed: true, dryRun: false }
}

const main = async () => {
  const uids = await collectTargetUids()
  console.log(`Found ${uids.length} partner uid(s) to inspect.`)
  console.log(`Mode: ${isApply ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`)

  let touched = 0
  let unchanged = 0
  for (const uid of uids) {
    try {
      const result = await recoverOne(uid)
      if (result.changed) touched++
      else unchanged++
    } catch (error) {
      console.error(`[partner ${uid}] FAILED:`, error)
    }
  }

  console.log(`\nDone. ${touched} partner(s) had drift; ${unchanged} already correct.`)
  if (touched > 0 && !isApply) {
    console.log('Re-run with --apply to write the fixes.')
  }
  process.exit(0)
}

main().catch((error) => {
  console.error('FATAL:', error)
  process.exit(1)
})
