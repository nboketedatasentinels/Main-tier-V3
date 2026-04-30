#!/usr/bin/env node

/**
 * Targeted repair: ensure Ayakwa Fobi (info@data-sentinels.com) is fully
 * attached to the Data Sentinels organization and passes the leaderboard
 * eligibility checks in src/utils/organizationScope.ts.
 *
 * Inspects users/, profiles/, and organizations/ collections. Reports the
 * exact field state, then (with --apply) writes the canonical org fields
 * + eligibility markers onto every profile doc that matches the email.
 *
 * Usage:
 *   node scripts/fix-ayakwa-org-membership.mjs              # dry-run
 *   node scripts/fix-ayakwa-org-membership.mjs --apply      # write changes
 *   node scripts/fix-ayakwa-org-membership.mjs --email <addr> --code <CODE>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const emailArg = args.includes('--email') ? args[args.indexOf('--email') + 1] : null
const codeArg = args.includes('--code') ? args[args.indexOf('--code') + 1] : null

const TARGET_EMAIL = (emailArg || 'info@data-sentinels.com').trim().toLowerCase()
const TARGET_ORG_CODE = (codeArg || 'orgpjw').trim()

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

const findOrg = async () => {
  const titleCase = TARGET_ORG_CODE.charAt(0).toUpperCase() + TARGET_ORG_CODE.slice(1).toLowerCase()
  const variants = Array.from(new Set([
    TARGET_ORG_CODE,
    TARGET_ORG_CODE.toUpperCase(),
    TARGET_ORG_CODE.toLowerCase(),
    titleCase,
  ]))

  for (const variant of variants) {
    const direct = await db.collection('organizations').doc(variant).get()
    if (direct.exists) return { id: direct.id, ...direct.data() }
  }

  for (const variant of variants) {
    const byCode = await db.collection('organizations').where('code', '==', variant).limit(1).get()
    if (!byCode.empty) {
      const docSnap = byCode.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
  }

  // Last resort: scan whole collection and match case-insensitively on docId or code field.
  const target = TARGET_ORG_CODE.toLowerCase()
  const all = await db.collection('organizations').get()
  const match = all.docs.find((d) => {
    if (d.id.toLowerCase() === target) return true
    const code = d.data()?.code
    return typeof code === 'string' && code.toLowerCase() === target
  })
  if (match) return { id: match.id, ...match.data() }

  return null
}

const findDocsByEmail = async (collectionName) => {
  const snap = await db.collection(collectionName).where('email', '==', TARGET_EMAIL).get()
  return snap.docs.map((d) => ({ id: d.id, data: d.data(), ref: d.ref }))
}

const hasSignedInMarkers = (m) => (
  typeof m.totalPoints === 'number'
  || typeof m.level === 'number'
  || (typeof m.journeyType === 'string' && m.journeyType.trim().length > 0)
  || typeof m.onboardingComplete === 'boolean'
)

const explainEligibility = (profile, org) => {
  const reasons = []
  if (profile.mergedInto) reasons.push(`mergedInto=${profile.mergedInto} (excluded)`)
  const status = (profile.accountStatus ?? profile.status ?? '').toString().trim().toLowerCase()
  if (status && status !== 'active') reasons.push(`accountStatus="${status}" (must be empty or "active")`)
  if (!profile.email) reasons.push('email missing')
  if (!hasSignedInMarkers(profile)) reasons.push('no signed-in markers (totalPoints/level/journeyType/onboardingComplete all missing)')
  const orgIdMatches = profile.companyId === org.id || profile.organizationId === org.id
  const orgCodeMatches = profile.companyCode === org.code || profile.organizationCode === org.code
  if (!orgIdMatches && !orgCodeMatches) reasons.push(`org fields do not match Data Sentinels (companyId=${profile.companyId ?? 'n/a'}, companyCode=${profile.companyCode ?? 'n/a'})`)
  return reasons
}

const computeProfileUpdates = (profile, org) => {
  const updates = {}
  if (profile.companyId !== org.id) updates.companyId = org.id
  if (profile.organizationId !== org.id) updates.organizationId = org.id
  if (profile.companyCode !== org.code) updates.companyCode = org.code
  if (org.name && profile.companyName !== org.name) updates.companyName = org.name

  const assigned = Array.isArray(profile.assignedOrganizations) ? profile.assignedOrganizations : []
  if (!assigned.includes(org.id)) updates.assignedOrganizations = Array.from(new Set([...assigned, org.id]))

  if (profile.membershipStatus !== 'paid') updates.membershipStatus = 'paid'
  if (profile.transformationTier !== 'CORPORATE_MEMBER') updates.transformationTier = 'CORPORATE_MEMBER'

  const status = (profile.accountStatus ?? profile.status ?? '').toString().trim().toLowerCase()
  if (status && status !== 'active') updates.accountStatus = 'active'
  if (!profile.accountStatus) updates.accountStatus = 'active'

  if (profile.mergedInto) updates.mergedInto = FieldValue.delete()

  if (!hasSignedInMarkers(profile)) {
    if (typeof profile.totalPoints !== 'number') updates.totalPoints = 0
    if (typeof profile.level !== 'number') updates.level = 1
    if (typeof profile.onboardingComplete !== 'boolean') updates.onboardingComplete = false
    if (org.journeyType && typeof profile.journeyType !== 'string') updates.journeyType = org.journeyType
  }

  if (Object.keys(updates).length > 0) updates.updatedAt = FieldValue.serverTimestamp()
  return updates
}

const run = async () => {
  console.log(`Mode:   ${isApply ? 'APPLY (writing to Firestore)' : 'DRY RUN (no writes)'}`)
  console.log(`Email:  ${TARGET_EMAIL}`)
  console.log(`OrgCode: ${TARGET_ORG_CODE}`)

  sep('Step 1: Locate Data Sentinels organization')
  const org = await findOrg()
  if (!org) {
    console.error(`No organization found with code "${TARGET_ORG_CODE}".`)
    process.exit(1)
  }
  console.log(`Found org id=${org.id}  code=${org.code}  name=${org.name}  status=${org.status}  journeyType=${org.journeyType ?? 'n/a'}`)

  sep('Step 2: Look up email in users/ and profiles/')
  const [users, profiles] = await Promise.all([
    findDocsByEmail('users'),
    findDocsByEmail('profiles'),
  ])
  console.log(`users/    matches: ${users.length}  ids=${users.map((u) => u.id).join(', ') || 'none'}`)
  console.log(`profiles/ matches: ${profiles.length}  ids=${profiles.map((p) => p.id).join(', ') || 'none'}`)

  if (!users.length && !profiles.length) {
    console.error('\nNo users/ or profiles/ docs found for that email. The user has not signed up yet.')
    console.error('Action: ask them to sign up at the app using the Data Sentinels code.')
    process.exit(1)
  }

  sep('Step 3: Inspect each profile and compute repairs')

  const profileIds = new Set(profiles.map((p) => p.id))
  for (const u of users) {
    if (!profileIds.has(u.id)) {
      console.log(`\nusers/${u.id} has no matching profiles/${u.id} doc. Will create one from users/ data.`)
      profiles.push({ id: u.id, data: { ...u.data }, ref: db.collection('profiles').doc(u.id), synthesized: true })
    }
  }

  if (!profiles.length) {
    console.error('No profiles to repair. Aborting.')
    process.exit(1)
  }

  const writes = []
  for (const p of profiles) {
    console.log(`\n--- profiles/${p.id}${p.synthesized ? '  (will be created from users/ data)' : ''} ---`)
    const data = p.data || {}
    console.log('Current org fields:')
    console.log({
      companyId: data.companyId ?? null,
      companyCode: data.companyCode ?? null,
      organizationId: data.organizationId ?? null,
      companyName: data.companyName ?? null,
      assignedOrganizations: data.assignedOrganizations ?? null,
    })
    console.log('Current eligibility markers:')
    console.log({
      totalPoints: data.totalPoints,
      level: data.level,
      journeyType: data.journeyType,
      onboardingComplete: data.onboardingComplete,
      accountStatus: data.accountStatus ?? data.status,
      mergedInto: data.mergedInto ?? null,
      role: data.role ?? null,
      membershipStatus: data.membershipStatus ?? null,
    })

    const reasons = explainEligibility(data, org)
    if (reasons.length === 0) {
      console.log('Eligibility: PASSES all checks. No repair needed for this doc.')
      continue
    }
    console.log('Eligibility: FAILS. Reasons:')
    reasons.forEach((r) => console.log(`  - ${r}`))

    const updates = computeProfileUpdates(data, org)
    console.log('Proposed update payload:')
    console.log(updates)
    writes.push({ ref: p.ref, updates, synthesized: Boolean(p.synthesized) })
  }

  sep('Step 4: Apply or skip')
  if (!writes.length) {
    console.log('Nothing to write. Either everything is already correct or no profile docs exist.')
    return
  }
  if (!isApply) {
    console.log(`Dry run: would write to ${writes.length} profile doc(s). Re-run with --apply to commit.`)
    return
  }

  for (const w of writes) {
    if (w.synthesized) {
      await w.ref.set({ ...w.updates, email: TARGET_EMAIL, createdAt: FieldValue.serverTimestamp() }, { merge: true })
      console.log(`Created profiles/${w.ref.id}`)
    } else {
      await w.ref.update(w.updates)
      console.log(`Updated profiles/${w.ref.id}`)
    }
  }
  console.log(`\nDone. Wrote ${writes.length} doc(s).`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
