/**
 * Data Cleanup Script: Peer Matching / Challenges eligibility
 *
 * Why:
 * - Removes "stub" / never-signed-in profiles from peer matching + leaderboard inputs
 * - Flags duplicate profiles by email and soft-merges them via `mergedInto`
 *
 * Safety:
 * - Default is dry-run (no writes)
 * - With `--apply`, updates are soft (no deletes)
 *
 * Usage:
 *   node scripts/cleanup-peer-engagement-data.mjs --orgId=<ORG_ID>
 *   node scripts/cleanup-peer-engagement-data.mjs --orgCode=<ORG_CODE>
 *   node scripts/cleanup-peer-engagement-data.mjs --orgId=<ORG_ID> --apply
 *
 * Options:
 *   --apply              Actually write changes (otherwise dry-run)
 *   --cleanMatches       Also expire matches involving ineligible users (best-effort)
 *   --limit=<N>          Limit number of profiles scanned (debugging)
 *
 * Auth:
 *   - Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file, OR
 *   - Set `FIREBASE_SERVICE_ACCOUNT` to the JSON content, OR
 *   - Use ADC credentials (gcloud) if available.
 */
import admin from 'firebase-admin'

const normalizeEmail = (email) => (email || '').toString().trim().toLowerCase()
const normalizeAccountStatus = (status) => (typeof status === 'string' ? status.trim().toLowerCase() : '')

const sanitizeProxyEnv = ({ keepProxy }) => {
  if (keepProxy) return

  const blockedProxy = 'http://127.0.0.1:9'
  const envKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']
  const hasBlockedProxy = envKeys.some((key) => (process.env[key] || '').trim() === blockedProxy)

  if (!hasBlockedProxy) return

  envKeys.forEach((key) => {
    if (process.env[key]) process.env[key] = ''
  })

  // Prefer bypassing all proxy routing for Firestore/gRPC calls in sandboxed envs.
  process.env.NO_PROXY = '*'
  process.env.no_proxy = '*'
}

const parseArgs = () => {
  const out = {
    orgId: null,
    orgCode: null,
    apply: false,
    cleanMatches: false,
    keepProxy: false,
    limit: null,
  }

  for (const raw of process.argv.slice(2)) {
    if (raw === '--apply') out.apply = true
    else if (raw === '--cleanMatches') out.cleanMatches = true
    else if (raw === '--keepProxy') out.keepProxy = true
    else if (raw.startsWith('--orgId=')) out.orgId = raw.slice('--orgId='.length).trim() || null
    else if (raw.startsWith('--orgCode=')) out.orgCode = raw.slice('--orgCode='.length).trim() || null
    else if (raw.startsWith('--limit=')) {
      const parsed = Number.parseInt(raw.slice('--limit='.length), 10)
      out.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
  }

  return out
}

const initAdmin = () => {
  if (admin.apps.length) return

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  const projectId =
    process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || 'transformation-tier'

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
    return
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    })
    return
  }

  admin.initializeApp({ projectId })
}

const hasOrgAssociation = (profile) =>
  Boolean(
    profile.companyId ||
      profile.companyCode ||
      profile.organizationId ||
      profile.organizationCode ||
      profile.corporateVillageId ||
      profile.villageId ||
      profile.cohortIdentifier ||
      (Array.isArray(profile.assignedOrganizations) && profile.assignedOrganizations.length > 0),
  )

const hasSignedInMarkers = (profile) => {
  if (typeof profile.totalPoints === 'number') return true
  if (typeof profile.level === 'number') return true
  if (typeof profile.journeyType === 'string' && profile.journeyType.trim().length > 0) return true
  if (typeof profile.onboardingComplete === 'boolean') return true
  return false
}

const scoreCanonical = (profile, index) => {
  let score = 0
  const status = normalizeAccountStatus(profile.accountStatus ?? profile.status)
  if (status === 'active') score += 50
  if (typeof profile.totalPoints === 'number') score += 20
  if (typeof profile.level === 'number') score += 10
  if (typeof profile.journeyType === 'string' && profile.journeyType.trim().length > 0) score += 10
  if ((profile.membershipStatus || '').toString() === 'paid') score += 10
  const role = typeof profile.role === 'string' ? profile.role.trim().toLowerCase() : ''
  if (role && role !== 'free_user') score += 5
  if (profile.companyId || profile.organizationId) score += 4
  if (profile.companyCode || profile.organizationCode) score += 2
  if (Array.isArray(profile.assignedOrganizations) && profile.assignedOrganizations.length > 0) score += 2
  if (profile.mergedInto) score -= 1000
  return { score, index }
}

const chunk = (items, size) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

const fetchOrgProfiles = async (db, { orgId, orgCode, limit }) => {
  const profiles = new Map()

  const addSnapshot = (snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      if (!profiles.has(docSnap.id)) {
        profiles.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
      }
    })
  }

  if (!orgId && !orgCode) {
    const base = db.collection('profiles')
    const snapshot = limit ? await base.limit(limit).get() : await base.get()
    addSnapshot(snapshot)
    return Array.from(profiles.values())
  }

  const queries = []
  if (orgId) {
    queries.push(db.collection('profiles').where('companyId', '==', orgId))
    queries.push(db.collection('profiles').where('organizationId', '==', orgId))
    queries.push(db.collection('profiles').where('assignedOrganizations', 'array-contains', orgId))
  }
  if (orgCode) {
    queries.push(db.collection('profiles').where('companyCode', '==', orgCode))
    queries.push(db.collection('profiles').where('organizationCode', '==', orgCode))
  }

  const snapshots = await Promise.all(queries.map((q) => (limit ? q.limit(limit).get() : q.get())))
  snapshots.forEach(addSnapshot)

  return Array.from(profiles.values())
}

const expireMatchesForUserIds = async (db, userIds) => {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  if (!ids.length) return { expired: 0, errors: 0 }

  let expired = 0
  let errors = 0

  for (const userId of ids) {
    const queries = [
      db.collection('peer_weekly_matches').where('user_id', '==', userId),
      db.collection('peer_weekly_matches').where('userId', '==', userId),
      db.collection('peer_weekly_matches').where('peer_id', '==', userId),
      db.collection('peer_weekly_matches').where('peerId', '==', userId),
    ]

    for (const q of queries) {
      try {
        const snapshot = await q.get()
        if (!snapshot.size) continue

        for (const batchDocs of chunk(snapshot.docs, 400)) {
          const batch = db.batch()
          batchDocs.forEach((docSnap) => {
            batch.set(
              docSnap.ref,
              {
                matchStatus: 'expired',
                expiredAt: admin.firestore.FieldValue.serverTimestamp(),
                expiredReason: 'ineligible_profile_cleanup',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            )
          })
          await batch.commit()
          expired += batchDocs.length
        }
      } catch (err) {
        errors += 1
        console.warn('[cleanup] Unable to expire matches for user', userId, err?.message || err)
      }
    }
  }

  return { expired, errors }
}

const main = async () => {
  const args = parseArgs()
  sanitizeProxyEnv({ keepProxy: args.keepProxy })
  initAdmin()
  const db = admin.firestore()

  const profiles = await fetchOrgProfiles(db, args)
  const scanned = profiles.length

  const byEmail = new Map()
  const stubs = []
  const ineligible = []

  profiles.forEach((profile, index) => {
    const emailKey = normalizeEmail(profile.email)
    if (emailKey) {
      const existing = byEmail.get(emailKey) || []
      existing.push({ profile, index })
      byEmail.set(emailKey, existing)
    }

    const status = normalizeAccountStatus(profile.accountStatus ?? profile.status)
    const isStub = hasOrgAssociation(profile) && !hasSignedInMarkers(profile)
    const hasEmail = Boolean(emailKey)
    const isMerged = Boolean(profile.mergedInto)
    const isInactiveStatus = Boolean(status && status !== 'active')

    if (isStub) stubs.push(profile)
    if (!hasEmail || isMerged || isInactiveStatus || isStub) ineligible.push(profile)
  })

  const duplicateGroups = Array.from(byEmail.entries())
    .map(([email, entries]) => ({ email, entries }))
    .filter((group) => group.entries.length > 1)

  console.log('\nPeer engagement cleanup report')
  console.log('-----------------------------')
  console.log('Scope:', args.orgId ? `orgId=${args.orgId}` : args.orgCode ? `orgCode=${args.orgCode}` : 'ALL (no scope)')
  console.log('Scanned profiles:', scanned)
  console.log('Stub (no sign-in markers):', stubs.length)
  console.log('Duplicate email groups:', duplicateGroups.length)
  console.log('Ineligible (merged/status/stub/missing email):', ineligible.length)

  if (!duplicateGroups.length && !stubs.length) {
    console.log('\nNo stub/duplicate candidates found.')
    return
  }

  const topDupes = duplicateGroups
    .slice()
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, 10)

  if (topDupes.length) {
    console.log('\nTop duplicate email groups (up to 10):')
    topDupes.forEach((group) => {
      console.log(`- ${group.email}: ${group.entries.length} profile(s)`)
    })
  }

  if (!args.apply) {
    console.log('\nDry run complete. Re-run with `--apply` to write soft-merge/status updates.')
    return
  }

  const now = admin.firestore.FieldValue.serverTimestamp()

  const updates = []

  // Soft-merge duplicates by email (keep canonical, mark others mergedInto + inactive)
  duplicateGroups.forEach((group) => {
    const scored = group.entries
      .map(({ profile, index }) => ({ profile, ...scoreCanonical(profile, index) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
    const canonical = scored[0]?.profile
    if (!canonical) return

    scored.slice(1).forEach(({ profile }) => {
      updates.push({
        id: profile.id,
        payload: {
          mergedInto: canonical.id,
          accountStatus: 'inactive',
          'privacySettings.allowPeerMatching': false,
          'privacySettings.showOnLeaderboard': false,
          updatedAt: now,
        },
      })
    })
  })

  // Mark stubs as pending and hide them from peer matching / leaderboard
  stubs.forEach((profile) => {
    updates.push({
      id: profile.id,
      payload: {
        accountStatus: 'pending',
        'privacySettings.allowPeerMatching': false,
        'privacySettings.showOnLeaderboard': false,
        updatedAt: now,
      },
    })
  })

  // Deduplicate updates by id (prefer mergedInto updates over pending stubs)
  const updatesById = new Map()
  updates.forEach((u) => updatesById.set(u.id, u.payload))

  const uniqueUpdates = Array.from(updatesById.entries()).map(([id, payload]) => ({ id, payload }))

  console.log(`\nApplying updates to ${uniqueUpdates.length} profile(s) (and users mirror)...`)

  for (const batchItems of chunk(uniqueUpdates, 200)) {
    const batch = db.batch()
    batchItems.forEach(({ id, payload }) => {
      batch.set(db.collection('profiles').doc(id), payload, { merge: true })
      batch.set(db.collection('users').doc(id), payload, { merge: true })
    })
    await batch.commit()
  }

  console.log('Profile/user updates applied.')

  if (args.cleanMatches) {
    console.log('\nExpiring peer matches involving updated user IDs (best-effort)...')
    const { expired, errors } = await expireMatchesForUserIds(db, uniqueUpdates.map((u) => u.id))
    console.log(`Expired matches: ${expired} (errors: ${errors})`)
  }
}

main().catch((err) => {
  console.error('\nCleanup script failed:', err)
  process.exitCode = 1
})
