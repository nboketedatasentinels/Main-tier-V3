#!/usr/bin/env node

/**
 * Org-wide repair: scan profiles/ (and users/) for "stub" docs that are missing
 * the engagement markers the leaderboard, peer connect, partner dashboards, and
 * notification scheduler require. Writes the canonical defaults for any field
 * that is currently undefined, never overwrites real progress.
 *
 * Mirrors the logic in src/utils/profileDefaults.ts so behavior stays in sync.
 *
 * Markers we ensure:
 *   - accountStatus  ("active" if missing/empty)
 *   - totalPoints    (0 if not a number)
 *   - level          (1 if not a number)
 *   - onboardingComplete (false if not a boolean)
 *   - currentWeek    (1 if not a number)
 *   - journeyType / journeyStartDate / programDurationWeeks
 *       (only when the user's organization has these set, and the profile is missing them)
 *
 * Usage:
 *   node scripts/backfill-stub-profiles.mjs                  # dry-run, all profiles
 *   node scripts/backfill-stub-profiles.mjs --apply          # write changes
 *   node scripts/backfill-stub-profiles.mjs --org <orgId>    # restrict to one org
 *   node scripts/backfill-stub-profiles.mjs --code <ORGCODE> # restrict by org code
 *   node scripts/backfill-stub-profiles.mjs --limit 50       # cap docs scanned
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
const todayIso = () => new Date().toISOString()

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v) => typeof v === 'boolean'

const timestampToIso = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000).toISOString()
  return null
}

const loadOrgs = async () => {
  const map = new Map()
  const snap = await db.collection('organizations').get()
  snap.docs.forEach((d) => {
    const data = d.data() || {}
    map.set(d.id, {
      id: d.id,
      code: data.code || null,
      name: data.name || null,
      journeyType: data.journeyType || null,
      journeyStartDate: data.journeyStartDate || timestampToIso(data.cohortStartDate) || null,
      programDurationWeeks: typeof data.programDurationWeeks === 'number' ? data.programDurationWeeks : null,
    })
  })
  return map
}

const resolveProfileOrg = (profile, orgsById, orgsByCode) => {
  const orgIdCandidates = [profile.companyId, profile.organizationId].filter(isNonEmptyString)
  for (const id of orgIdCandidates) {
    if (orgsById.has(id)) return orgsById.get(id)
  }
  const codeCandidates = [profile.companyCode, profile.organizationCode].filter(isNonEmptyString)
  for (const code of codeCandidates) {
    if (orgsByCode.has(code)) return orgsByCode.get(code)
  }
  return null
}

// Mirrors getMissingEngagementDefaults() in src/utils/profileDefaults.ts.
const computeMissingDefaults = (profile, org) => {
  const updates = {}

  if (!isNonEmptyString(profile.accountStatus)) {
    updates.accountStatus = 'active'
  }
  if (!isNumber(profile.totalPoints)) {
    updates.totalPoints = 0
  }
  if (!isNumber(profile.level)) {
    updates.level = 1
  }
  if (!isBoolean(profile.onboardingComplete)) {
    updates.onboardingComplete = false
  }
  if (!isNumber(profile.currentWeek)) {
    updates.currentWeek = 1
  }

  if (org?.journeyType && !isNonEmptyString(profile.journeyType)) {
    updates.journeyType = org.journeyType
  }

  const hasJourneyContext = Boolean(org?.journeyType) || isNonEmptyString(profile.journeyType)
  if (hasJourneyContext && !isNonEmptyString(profile.journeyStartDate)) {
    updates.journeyStartDate = org?.journeyStartDate || todayIso()
  }

  if (
    typeof org?.programDurationWeeks === 'number' &&
    org.programDurationWeeks > 0 &&
    !isNumber(profile.programDurationWeeks)
  ) {
    updates.programDurationWeeks = org.programDurationWeeks
  }

  return updates
}

const scanCollection = async (collectionName, predicate) => {
  let q = db.collection(collectionName)
  if (orgFilter) q = q.where('companyId', '==', orgFilter)
  const snap = await q.get()
  const docs = []
  for (const d of snap.docs) {
    const data = d.data() || {}
    if (predicate(data)) docs.push({ id: d.id, ref: d.ref, data })
    if (scanLimit && docs.length >= scanLimit) break
  }
  return docs
}

const run = async () => {
  console.log(`Mode:    ${isApply ? 'APPLY (writing to Firestore)' : 'DRY RUN (no writes)'}`)
  console.log(`Filter:  ${orgFilter ? `org=${orgFilter}` : codeFilter ? `code=${codeFilter}` : 'ALL profiles'}`)
  if (scanLimit) console.log(`Limit:   ${scanLimit}`)

  sep('Step 1: Load organizations')
  const orgsById = await loadOrgs()
  const orgsByCode = new Map()
  orgsById.forEach((org) => {
    if (org.code) orgsByCode.set(org.code, org)
  })
  console.log(`Loaded ${orgsById.size} organizations.`)

  let codeFilteredOrgId = null
  if (codeFilter) {
    const match = orgsByCode.get(codeFilter)
    if (!match) {
      console.error(`No organization found with code "${codeFilter}".`)
      process.exit(1)
    }
    codeFilteredOrgId = match.id
    console.log(`Resolved code "${codeFilter}" → org id ${codeFilteredOrgId}`)
  }

  const matchesFilter = (profile) => {
    if (codeFilteredOrgId) {
      return (
        profile.companyId === codeFilteredOrgId ||
        profile.organizationId === codeFilteredOrgId ||
        profile.companyCode === codeFilter ||
        profile.organizationCode === codeFilter
      )
    }
    return true
  }

  sep('Step 2: Scan profiles/ for stubs')
  const profileDocs = await scanCollection('profiles', matchesFilter)
  console.log(`Scanned ${profileDocs.length} profile docs (post-filter).`)

  const writes = []
  let alreadyOk = 0
  let stubsFound = 0

  for (const p of profileDocs) {
    const org = resolveProfileOrg(p.data, orgsById, orgsByCode)
    const updates = computeMissingDefaults(p.data, org)
    if (Object.keys(updates).length === 0) {
      alreadyOk++
      continue
    }
    stubsFound++
    writes.push({ ref: p.ref, id: p.id, updates, org, data: p.data })
  }

  console.log(`\nResults: ${alreadyOk} already healthy, ${stubsFound} stubs needing repair.`)

  if (stubsFound === 0) {
    console.log('Nothing to do. Exiting.')
    return
  }

  sep('Step 3: Show repair plan (first 10 stubs)')
  writes.slice(0, 10).forEach((w, i) => {
    console.log(`\n[${i + 1}] profiles/${w.id}`)
    console.log(`  email:      ${w.data.email ?? 'n/a'}`)
    console.log(`  org:        ${w.org ? `${w.org.id} (${w.org.code ?? 'no code'})` : 'unresolved'}`)
    console.log(`  fields:     ${Object.keys(w.updates).join(', ')}`)
    console.log(`  payload:    ${JSON.stringify(w.updates)}`)
  })
  if (writes.length > 10) {
    console.log(`\n…and ${writes.length - 10} more.`)
  }

  sep('Step 4: Apply or skip')
  if (!isApply) {
    console.log(`Dry run: would update ${writes.length} profile doc(s) and mirror to users/.`)
    console.log('Re-run with --apply to commit.')
    return
  }

  let applied = 0
  let mirrored = 0
  for (const w of writes) {
    const payload = { ...w.updates, updatedAt: FieldValue.serverTimestamp() }
    try {
      await w.ref.update(payload)
      applied++
    } catch (error) {
      console.warn(`profiles/${w.id} update failed; falling back to set(merge):`, error?.message)
      await w.ref.set(payload, { merge: true })
      applied++
    }

    // Mirror to users/{id} so role/admin tooling that still reads users/ also sees the fields.
    try {
      const usersRef = db.collection('users').doc(w.id)
      const usersSnap = await usersRef.get()
      if (usersSnap.exists) {
        const usersData = usersSnap.data() || {}
        const usersUpdates = computeMissingDefaults(usersData, w.org)
        if (Object.keys(usersUpdates).length > 0) {
          await usersRef.update({ ...usersUpdates, updatedAt: FieldValue.serverTimestamp() })
          mirrored++
        }
      }
    } catch (error) {
      console.warn(`users/${w.id} mirror failed:`, error?.message)
    }
  }

  console.log(`\nDone. Updated profiles/: ${applied}. Mirrored to users/: ${mirrored}.`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
