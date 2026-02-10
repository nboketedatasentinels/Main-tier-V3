#!/usr/bin/env node

/**
 * One-time cleanup script for deprecated invite-name fields.
 *
 * Removes:
 * - invitedName
 * - invitedNameByOrganization
 *
 * Collections:
 * - users
 * - profiles
 *
 * Default mode is dry-run (no writes). Use --apply to execute.
 *
 * Usage:
 *   node scripts/cleanup-invited-name-fields.mjs
 *   node scripts/cleanup-invited-name-fields.mjs --apply
 *   node scripts/cleanup-invited-name-fields.mjs --apply --batch-size=200 --page-size=500 --limit=1000
 */

import admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const TARGET_COLLECTIONS = ['users', 'profiles']
const TARGET_FIELDS = ['invitedName', 'invitedNameByOrganization']
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
      if (Number.isFinite(value) && value > 0 && value <= 500) parsed.batchSize = value
      return
    }
    if (arg.startsWith('--page-size=')) {
      const value = Number.parseInt(arg.slice('--page-size='.length), 10)
      if (Number.isFinite(value) && value > 0 && value <= 1000) parsed.pageSize = value
      return
    }
    if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(value) && value > 0) parsed.limit = value
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
    join(__dirname, '..', 'serviceAccountKey.json'),
    join(__dirname, '..', 'transformation-tier-firebase-adminsdk-fbsvc-48c82429e5.json'),
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

const hasDeprecatedFields = (data) =>
  TARGET_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(data, field))

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const scanCollection = async (db, collectionName, { pageSize, limit }) => {
  const matchingDocIds = []
  let scanned = 0
  let cursor = null

  while (true) {
    let q = db
      .collection(collectionName)
      .select(...TARGET_FIELDS)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize)

    if (cursor) {
      q = q.startAfter(cursor)
    }

    const snapshot = await q.get()
    if (snapshot.empty) break

    for (const docSnap of snapshot.docs) {
      scanned += 1
      const data = docSnap.data() || {}
      if (hasDeprecatedFields(data)) {
        matchingDocIds.push(docSnap.id)
        if (limit && matchingDocIds.length >= limit) {
          return { scanned, matchingDocIds, reachedLimit: true }
        }
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1].id
  }

  return { scanned, matchingDocIds, reachedLimit: false }
}

const applyCollectionCleanup = async (db, collectionName, docIds, batchSize) => {
  if (!docIds.length) return { updated: 0, batches: 0 }

  const updates = {
    invitedName: admin.firestore.FieldValue.delete(),
    invitedNameByOrganization: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  let updated = 0
  let batches = 0

  for (const idChunk of chunk(docIds, batchSize)) {
    const batch = db.batch()
    idChunk.forEach((docId) => {
      batch.set(db.collection(collectionName).doc(docId), updates, { merge: true })
    })
    await batch.commit()
    batches += 1
    updated += idChunk.length
  }

  return { updated, batches }
}

const main = async () => {
  const options = parseArgs()
  sanitizeProxyEnv(options)
  initAdmin()

  const db = admin.firestore()

  console.log('Deprecated invite-name fields cleanup')
  console.log('-------------------------------------')
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Collections: ${TARGET_COLLECTIONS.join(', ')}`)
  console.log(`Fields: ${TARGET_FIELDS.join(', ')}`)
  console.log(`Batch size: ${options.batchSize}`)
  console.log(`Page size: ${options.pageSize}`)
  if (options.limit) console.log(`Limit per collection: ${options.limit}`)

  const summary = []

  for (const collectionName of TARGET_COLLECTIONS) {
    console.log(`\nScanning collection: ${collectionName}`)
    const scanResult = await scanCollection(db, collectionName, options)
    const { scanned, matchingDocIds, reachedLimit } = scanResult

    console.log(`- Scanned: ${scanned}`)
    console.log(`- Matched: ${matchingDocIds.length}`)
    if (reachedLimit) {
      console.log(`- Limit reached (${options.limit}).`)
    }
    if (matchingDocIds.length) {
      const preview = matchingDocIds.slice(0, 10)
      console.log(`- Sample doc IDs: ${preview.join(', ')}${matchingDocIds.length > preview.length ? ', ...' : ''}`)
    }

    let updated = 0
    let batches = 0
    if (options.apply && matchingDocIds.length) {
      const applyResult = await applyCollectionCleanup(db, collectionName, matchingDocIds, options.batchSize)
      updated = applyResult.updated
      batches = applyResult.batches
      console.log(`- Updated: ${updated} across ${batches} batch(es)`)
    } else if (!options.apply) {
      console.log('- No writes in dry-run mode.')
    }

    summary.push({
      collectionName,
      scanned,
      matched: matchingDocIds.length,
      updated,
      batches,
    })
  }

  console.log('\nSummary')
  console.log('-------')
  summary.forEach((entry) => {
    console.log(
      `${entry.collectionName}: scanned=${entry.scanned}, matched=${entry.matched}, updated=${entry.updated}, batches=${entry.batches}`,
    )
  })
}

main().catch((error) => {
  console.error('\nCleanup failed:', error)
  process.exitCode = 1
})
