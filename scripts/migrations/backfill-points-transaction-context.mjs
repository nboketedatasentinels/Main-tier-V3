#!/usr/bin/env node

/**
 * Backfill points transaction context fields from user profiles.
 *
 * Fields:
 * - companyId
 * - companyCode
 * - villageId
 * - clusterId
 *
 * Default mode is dry-run. Use --apply to write updates.
 *
 * Usage:
 *   node scripts/migrations/backfill-points-transaction-context.mjs
 *   node scripts/migrations/backfill-points-transaction-context.mjs --apply
 *   node scripts/migrations/backfill-points-transaction-context.mjs --apply --batch-size=200 --page-size=500
 *   node scripts/migrations/backfill-points-transaction-context.mjs --doc-limit=1000
 */

import admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const TARGET_COLLECTION = 'points_transactions'
const PROFILE_COLLECTION = 'profiles'
const USER_COLLECTION = 'users'
const TARGET_FIELDS = ['companyId', 'companyCode', 'villageId', 'clusterId']

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const normalizeString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const isFieldMissing = (value) => normalizeString(value) === null

const parseArgs = () => {
  const args = process.argv.slice(2)
  const parsed = {
    apply: false,
    batchSize: 200,
    pageSize: 500,
    limit: null,
    keepProxy: false,
  }

  args.forEach((arg) => {
    if (arg === '--apply') {
      parsed.apply = true
      return
    }
    if (arg === '--keepProxy') {
      parsed.keepProxy = true
      return
    }
    if (arg.startsWith('--batch-size=')) {
      const value = Number.parseInt(arg.slice('--batch-size='.length), 10)
      if (Number.isFinite(value) && value > 0 && value <= 500) {
        parsed.batchSize = value
      }
      return
    }
    if (arg.startsWith('--page-size=')) {
      const value = Number.parseInt(arg.slice('--page-size='.length), 10)
      if (Number.isFinite(value) && value > 0 && value <= 1000) {
        parsed.pageSize = value
      }
      return
    }
    if (arg.startsWith('--doc-limit=')) {
      const value = Number.parseInt(arg.slice('--doc-limit='.length), 10)
      if (Number.isFinite(value) && value > 0) {
        parsed.limit = value
      }
      return
    }
    if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(value) && value > 0) {
        parsed.limit = value
      }
    }
  })

  return parsed
}

const sanitizeProxyEnv = ({ keepProxy }) => {
  if (keepProxy) return

  const blockedProxy = 'http://127.0.0.1:9'
  const envKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']
  const hasBlockedProxy = envKeys.some((key) => (process.env[key] || '').trim() === blockedProxy)
  if (!hasBlockedProxy) return

  envKeys.forEach((key) => {
    if (process.env[key]) process.env[key] = ''
  })

  process.env.NO_PROXY = '*'
  process.env.no_proxy = '*'
}

const initAdmin = () => {
  if (admin.apps.length) return

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  const localServiceAccountPathCandidates = [
    join(__dirname, '..', '..', 'serviceAccountKey.json'),
    join(__dirname, '..', '..', 'transformation-tier-firebase-adminsdk-fbsvc-48c82429e5.json'),
  ]

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

  const localServiceAccountPath = localServiceAccountPathCandidates.find((path) => existsSync(path))
  if (localServiceAccountPath) {
    const localServiceAccount = JSON.parse(readFileSync(localServiceAccountPath, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(localServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || localServiceAccount.project_id || projectId,
    })
    return
  }

  admin.initializeApp({ projectId })
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const extractProfileContext = (profileData = {}) => ({
  companyId: normalizeString(profileData.companyId || profileData.organizationId),
  companyCode: normalizeString(profileData.companyCode || profileData.organizationCode),
  villageId: normalizeString(profileData.villageId || profileData.corporateVillageId),
  clusterId: normalizeString(profileData.clusterId),
})

const loadProfilesByIds = async (db, userIds) => {
  const result = new Map()
  if (!userIds.length) return result

  for (const ids of chunk(userIds, 300)) {
    const profileRefs = ids.map((id) => db.collection(PROFILE_COLLECTION).doc(id))
    const profileSnaps = await db.getAll(...profileRefs)

    const missingFromProfiles = []
    profileSnaps.forEach((snap) => {
      if (snap.exists) {
        result.set(snap.id, extractProfileContext(snap.data()))
      } else {
        missingFromProfiles.push(snap.id)
      }
    })

    if (!missingFromProfiles.length) continue

    const userRefs = missingFromProfiles.map((id) => db.collection(USER_COLLECTION).doc(id))
    const userSnaps = await db.getAll(...userRefs)
    userSnaps.forEach((snap) => {
      if (snap.exists) {
        result.set(snap.id, extractProfileContext(snap.data()))
      }
    })
  }

  return result
}

const hasAnyContext = (context) =>
  TARGET_FIELDS.some((field) => normalizeString(context[field]) !== null)

const buildUpdates = (txData, context) => {
  const updates = {}

  TARGET_FIELDS.forEach((field) => {
    if (!isFieldMissing(txData[field])) return
    const nextValue = normalizeString(context[field])
    if (nextValue !== null) {
      updates[field] = nextValue
    }
  })

  return updates
}

const main = async () => {
  const options = parseArgs()
  sanitizeProxyEnv(options)
  initAdmin()

  const db = admin.firestore()
  const idField = admin.firestore.FieldPath.documentId()

  let cursor = null
  let scanned = 0
  let candidates = 0
  let updated = 0
  let skippedNoUser = 0
  let skippedNoProfile = 0
  let skippedAlreadySet = 0
  let skippedNoContext = 0
  let errors = 0
  const sampleUpdates = []
  const profileCache = new Map()

  console.log('Points transaction context backfill')
  console.log('----------------------------------')
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Collection: ${TARGET_COLLECTION}`)
  console.log(`Fields: ${TARGET_FIELDS.join(', ')}`)
  console.log(`Batch size: ${options.batchSize}`)
  console.log(`Page size: ${options.pageSize}`)
  if (options.limit) console.log(`Limit: ${options.limit}`)

  while (true) {
    if (options.limit && scanned >= options.limit) break

    let q = db
      .collection(TARGET_COLLECTION)
      .orderBy(idField)
      .limit(options.pageSize)

    if (cursor) {
      q = q.startAfter(cursor)
    }

    const snapshot = await q.get()
    if (snapshot.empty) break

    scanned += snapshot.size
    const docs = options.limit
      ? snapshot.docs.slice(0, Math.max(0, options.limit - (scanned - snapshot.size)))
      : snapshot.docs

    const docsNeedingContext = []
    const userIdsToLoad = new Set()

    docs.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const missingAnyTargetField = TARGET_FIELDS.some((field) => isFieldMissing(data[field]))

      if (!missingAnyTargetField) {
        skippedAlreadySet += 1
        return
      }

      const userId = normalizeString(data.userId || data.user_id)
      if (!userId) {
        skippedNoUser += 1
        return
      }

      docsNeedingContext.push({ docSnap, data, userId })
      if (!profileCache.has(userId)) {
        userIdsToLoad.add(userId)
      }
    })

    if (userIdsToLoad.size) {
      const loadedProfiles = await loadProfilesByIds(db, Array.from(userIdsToLoad))
      loadedProfiles.forEach((value, key) => profileCache.set(key, value))
    }

    const pendingWrites = []

    docsNeedingContext.forEach(({ docSnap, data, userId }) => {
      candidates += 1
      const context = profileCache.get(userId)
      if (!context) {
        skippedNoProfile += 1
        return
      }
      if (!hasAnyContext(context)) {
        skippedNoContext += 1
        return
      }

      const updates = buildUpdates(data, context)
      if (!Object.keys(updates).length) {
        skippedAlreadySet += 1
        return
      }

      if (sampleUpdates.length < 20) {
        sampleUpdates.push({
          transactionId: docSnap.id,
          userId,
          updates,
        })
      }

      pendingWrites.push({ ref: docSnap.ref, updates })
    })

    if (options.apply && pendingWrites.length) {
      for (const writeChunk of chunk(pendingWrites, options.batchSize)) {
        const batch = db.batch()
        writeChunk.forEach(({ ref, updates: payload }) => {
          batch.set(ref, payload, { merge: true })
        })
        try {
          await batch.commit()
          updated += writeChunk.length
        } catch (error) {
          errors += writeChunk.length
          console.error('Batch commit failed:', error)
        }
      }
    } else if (!options.apply) {
      updated += pendingWrites.length
    }

    cursor = snapshot.docs[snapshot.docs.length - 1]
    console.log(
      `Processed ${Math.min(scanned, options.limit || scanned)} docs | candidates=${candidates} | updatable=${updated}`
    )
  }

  console.log('\nSummary')
  console.log('-------')
  console.log(`Scanned: ${options.limit ? Math.min(scanned, options.limit) : scanned}`)
  console.log(`Candidates (missing at least one target field): ${candidates}`)
  console.log(`${options.apply ? 'Updated' : 'Would update'}: ${updated}`)
  console.log(`Skipped (no userId): ${skippedNoUser}`)
  console.log(`Skipped (no profile/user context found): ${skippedNoProfile}`)
  console.log(`Skipped (profile context empty): ${skippedNoContext}`)
  console.log(`Skipped (already set): ${skippedAlreadySet}`)
  console.log(`Errors: ${errors}`)

  if (sampleUpdates.length) {
    console.log('\nSample updates')
    console.log('--------------')
    sampleUpdates.forEach((sample) => {
      console.log(`${sample.transactionId} (${sample.userId}) -> ${JSON.stringify(sample.updates)}`)
    })
  }
}

main().catch((error) => {
  console.error('\nBackfill failed:', error)
  process.exitCode = 1
})
