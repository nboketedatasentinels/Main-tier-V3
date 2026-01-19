#!/usr/bin/env node

/**
 * Reconciliation Script: Validate organization fields in users vs profiles
 *
 * This script:
 * - Scans users and profiles in batches
 * - Compares organization fields across collections
 * - Captures mismatches and missing documents
 * - Writes a JSON report to ./reports/migration-reconciliation-report.json by default
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure Firebase Admin credentials are configured
 * 3. Run: node scripts/migrations/reconcile-org-fields.mjs --output reports/migration-reconciliation-report.json
 */

import admin from 'firebase-admin'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

const serviceAccount = JSON.parse(
  await readFile(new URL('../../service-account-key.json', import.meta.url))
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
})

const db = admin.firestore()
const usersCollection = db.collection('users')
const profilesCollection = db.collection('profiles')

const ORG_FIELDS = [
  'companyId',
  'companyCode',
  'companyName',
  'transformationTier',
  'villageId',
  'clusterId',
  'corporateVillageId',
  'cohortIdentifier',
  'assignedOrganizations',
]

const batchSize = 500
const maxSamples = 25
const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output')
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : 'reports/migration-reconciliation-report.json'

const isEqualValue = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
  }
  return left === right
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    scannedUsers: 0,
    scannedProfiles: 0,
    matchedProfiles: 0,
    mismatchedProfiles: 0,
    missingProfiles: 0,
    missingUsers: 0,
  },
  mismatchedFields: Object.fromEntries(ORG_FIELDS.map((field) => [field, 0])),
  samples: [],
}

const addSample = (sample) => {
  if (report.samples.length >= maxSamples) return
  report.samples.push(sample)
}

const reconcileUsers = async () => {
  let lastDoc = null

  while (true) {
    let query = usersCollection.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const userSnapshot = await query.get()
    if (userSnapshot.empty) break

    report.summary.scannedUsers += userSnapshot.size
    console.log(`Reconciling users batch: ${userSnapshot.size} (total ${report.summary.scannedUsers})`)

    const profileRefs = userSnapshot.docs.map((docSnap) => profilesCollection.doc(docSnap.id))
    const profileSnapshots = await db.getAll(...profileRefs)
    const profileById = new Map(profileSnapshots.map((snap) => [snap.id, snap]))

    for (const userDoc of userSnapshot.docs) {
      const userId = userDoc.id
      const userData = userDoc.data()
      const profileSnap = profileById.get(userId)

      if (!profileSnap?.exists) {
        report.summary.missingProfiles += 1
        addSample({ userId, type: 'missing-profile' })
        continue
      }

      const profileData = profileSnap.data() || {}
      let hasMismatch = false

      for (const field of ORG_FIELDS) {
        const userValue = userData[field]
        const profileValue = profileData[field]
        if (typeof userValue === 'undefined' && typeof profileValue === 'undefined') {
          continue
        }
        if (!isEqualValue(userValue, profileValue)) {
          hasMismatch = true
          report.mismatchedFields[field] += 1
          addSample({
            userId,
            type: 'field-mismatch',
            field,
            userValue,
            profileValue,
          })
        }
      }

      if (hasMismatch) {
        report.summary.mismatchedProfiles += 1
      } else {
        report.summary.matchedProfiles += 1
      }
    }

    lastDoc = userSnapshot.docs[userSnapshot.docs.length - 1]
  }
}

const reconcileProfiles = async () => {
  let lastDoc = null

  while (true) {
    let query = profilesCollection.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const profileSnapshot = await query.get()
    if (profileSnapshot.empty) break

    report.summary.scannedProfiles += profileSnapshot.size
    console.log(`Reconciling profiles batch: ${profileSnapshot.size} (total ${report.summary.scannedProfiles})`)

    const userRefs = profileSnapshot.docs.map((docSnap) => usersCollection.doc(docSnap.id))
    const userSnapshots = await db.getAll(...userRefs)
    const userById = new Map(userSnapshots.map((snap) => [snap.id, snap]))

    for (const profileDoc of profileSnapshot.docs) {
      const profileId = profileDoc.id
      const userSnap = userById.get(profileId)
      if (!userSnap?.exists) {
        report.summary.missingUsers += 1
        addSample({ userId: profileId, type: 'missing-user' })
      }
    }

    lastDoc = profileSnapshot.docs[profileSnapshot.docs.length - 1]
  }
}

const writeReport = async () => {
  if (!outputPath) return
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Report written to ${outputPath}`)
}

const run = async () => {
  console.log('Starting reconciliation: users vs profiles (org fields)')
  await reconcileUsers()
  await reconcileProfiles()

  console.log('\n=== Reconciliation Summary ===')
  console.log(`Users scanned: ${report.summary.scannedUsers}`)
  console.log(`Profiles scanned: ${report.summary.scannedProfiles}`)
  console.log(`Profiles matched: ${report.summary.matchedProfiles}`)
  console.log(`Profiles mismatched: ${report.summary.mismatchedProfiles}`)
  console.log(`Missing profiles: ${report.summary.missingProfiles}`)
  console.log(`Missing users: ${report.summary.missingUsers}`)

  await writeReport()
}

run()
  .then(() => {
    console.log('Reconciliation script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Reconciliation failed:', error)
    process.exit(1)
  })
