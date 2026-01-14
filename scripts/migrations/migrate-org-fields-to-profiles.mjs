#!/usr/bin/env node

/**
 * Migration Script: Copy organization fields from users -> profiles
 *
 * This script:
 * - Scans users in batches
 * - Copies organization fields into matching profile docs
 * - Skips profiles that are already migrated or missing
 * - Writes progress to a migration_runs document
 * - Logs a summary report
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure Firebase Admin credentials are configured
 * 3. Run: node scripts/migrations/migrate-org-fields-to-profiles.mjs
 */

import admin from 'firebase-admin'
import { readFile } from 'fs/promises'

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
const migrationRunsCollection = db.collection('migration_runs')

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
const startedAt = new Date()
const migrationId = `org-fields-to-profiles-${startedAt.toISOString().replace(/[:.]/g, '-')}`
const migrationRef = migrationRunsCollection.doc(migrationId)

const isEqualValue = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
  }
  return left === right
}

const buildUpdates = (userData, profileData) => {
  const updates = {}

  for (const field of ORG_FIELDS) {
    const userValue = userData[field]
    if (typeof userValue === 'undefined') continue
    if (!isEqualValue(userValue, profileData[field])) {
      updates[field] = userValue
    }
  }

  return updates
}

const logMigrationProgress = async (payload) => {
  await migrationRef.set(
    {
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

const migrateProfiles = async () => {
  console.log('Starting migration: Copy organization fields to profiles...')

  await migrationRef.set({
    name: 'org-fields-to-profiles',
    status: 'running',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    totals: {
      scanned: 0,
      updated: 0,
      skipped: 0,
      missingProfiles: 0,
      errors: 0,
    },
  })

  let lastDoc = null
  let scanned = 0
  let updated = 0
  let skipped = 0
  let missingProfiles = 0
  let errors = 0
  const errorSamples = []

  while (true) {
    let query = usersCollection.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const userSnapshot = await query.get()
    if (userSnapshot.empty) {
      break
    }

    scanned += userSnapshot.size
    console.log(`Scanning batch of ${userSnapshot.size}. Total scanned: ${scanned}`)

    const profileRefs = userSnapshot.docs.map((docSnap) => profilesCollection.doc(docSnap.id))
    const profileSnapshots = await db.getAll(...profileRefs)
    const profileById = new Map(
      profileSnapshots.map((snap) => [snap.id, snap])
    )

    let batch = db.batch()
    let batchCount = 0

    for (const userDoc of userSnapshot.docs) {
      const userId = userDoc.id
      const userData = userDoc.data()
      const profileSnap = profileById.get(userId)

      if (!profileSnap?.exists) {
        missingProfiles += 1
        continue
      }

      const profileData = profileSnap.data() || {}
      if (profileData.orgFieldsMigratedAt) {
        skipped += 1
        continue
      }

      try {
        const updates = buildUpdates(userData, profileData)

        const profileRef = profilesCollection.doc(userId)
        batch.update(profileRef, {
          ...updates,
          orgFieldsMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
          orgFieldsMigrationSource: 'users',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        batchCount += 1

        if (batchCount >= batchSize) {
          await batch.commit()
          updated += batchCount
          console.log(`Committed batch of ${batchCount} updates. Total updated: ${updated}`)
          batch = db.batch()
          batchCount = 0
        }
      } catch (error) {
        errors += 1
        if (errorSamples.length < 25) {
          errorSamples.push({ userId, message: error?.message || String(error) })
        }
        console.error(`Error preparing update for user ${userId}:`, error)
      }
    }

    if (batchCount > 0) {
      await batch.commit()
      updated += batchCount
      console.log(`Committed final batch of ${batchCount} updates. Total updated: ${updated}`)
    }

    await logMigrationProgress({
      totals: {
        scanned,
        updated,
        skipped,
        missingProfiles,
        errors,
      },
      errorSamples,
    })

    lastDoc = userSnapshot.docs[userSnapshot.docs.length - 1]
  }

  console.log('\n=== Migration Complete ===')
  console.log(`Total scanned users: ${scanned}`)
  console.log(`Profiles updated: ${updated}`)
  console.log(`Profiles skipped (already migrated): ${skipped}`)
  console.log(`Users missing profiles: ${missingProfiles}`)
  console.log(`Errors: ${errors}`)

  if (errorSamples.length > 0) {
    console.log('\nSample errors:')
    errorSamples.forEach((sample) => {
      console.log(`  - ${sample.userId}: ${sample.message}`)
    })
  }

  await migrationRef.set(
    {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      totals: {
        scanned,
        updated,
        skipped,
        missingProfiles,
        errors,
      },
      errorSamples,
    },
    { merge: true },
  )
}

migrateProfiles()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Migration failed:', error)
    await migrationRef.set(
      {
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error?.message || String(error),
      },
      { merge: true },
    )
    process.exit(1)
  })
