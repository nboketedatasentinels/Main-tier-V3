#!/usr/bin/env node

/**
 * Migration Script: Backfill organizationId for existing points_verification_requests
 *
 * This script looks up each user's profile to get their organizationId and adds it
 * to their pending points verification requests. This enables organization-based
 * filtering for partner approval queues.
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/backfill-approval-organization-ids.mjs
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

const BATCH_LIMIT = 400

async function backfillApprovalOrganizationIds() {
  console.log('Starting migration: Backfill organizationId for points_verification_requests...')

  try {
    // Get all points_verification_requests that don't have organizationId
    const requestsSnapshot = await db.collection('points_verification_requests').get()
    console.log(`Found ${requestsSnapshot.size} total requests to check`)

    // Filter to only those without organizationId
    const requestsToUpdate = requestsSnapshot.docs.filter((doc) => {
      const data = doc.data()
      return !data.organizationId
    })

    console.log(`Found ${requestsToUpdate.length} requests needing organizationId`)

    if (requestsToUpdate.length === 0) {
      console.log('No requests need updating. Migration complete.')
      return
    }

    // Build a cache of user profiles to avoid repeated lookups
    const userIds = [...new Set(requestsToUpdate.map((doc) => doc.data().user_id))]
    console.log(`Loading profiles for ${userIds.length} unique users...`)

    const profileCache = new Map()
    for (let i = 0; i < userIds.length; i += 10) {
      const chunk = userIds.slice(i, i + 10)
      const profileSnapshots = await Promise.all(
        chunk.map((userId) => db.collection('profiles').doc(userId).get())
      )
      profileSnapshots.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data()
          profileCache.set(snap.id, {
            organizationId: data.organizationId || data.companyId || null,
          })
        }
      })
    }

    console.log(`Loaded ${profileCache.size} profiles`)

    let batch = db.batch()
    let batchOps = 0
    let updatedCount = 0
    let skippedCount = 0
    const errors = []

    for (const doc of requestsToUpdate) {
      const data = doc.data()
      const userId = data.user_id

      if (!userId) {
        console.warn(`Request ${doc.id} has no user_id, skipping`)
        skippedCount++
        continue
      }

      const userProfile = profileCache.get(userId)

      if (!userProfile) {
        console.warn(`Profile not found for user ${userId}, skipping request ${doc.id}`)
        skippedCount++
        continue
      }

      const organizationId = userProfile.organizationId

      if (!organizationId) {
        console.warn(`User ${userId} has no organizationId, setting to null for request ${doc.id}`)
      }

      batch.update(doc.ref, {
        organizationId: organizationId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      batchOps++
      updatedCount++

      if (batchOps >= BATCH_LIMIT) {
        try {
          await batch.commit()
          console.log(`Committed batch with ${batchOps} operations`)
        } catch (error) {
          console.error(`Error committing batch:`, error)
          errors.push({ batchOps, error: error.message })
        }
        batch = db.batch()
        batchOps = 0
      }
    }

    if (batchOps > 0) {
      try {
        await batch.commit()
        console.log(`Committed final batch with ${batchOps} operations`)
      } catch (error) {
        console.error(`Error committing final batch:`, error)
        errors.push({ batchOps, error: error.message })
      }
    }

    console.log('\n=== Migration Complete ===')
    console.log(`Requests updated with organizationId: ${updatedCount}`)
    console.log(`Requests skipped: ${skippedCount}`)

    if (errors.length > 0) {
      console.log('\nErrors encountered:')
      errors.forEach(({ batchOps, error }) => {
        console.log(`  - Batch (${batchOps} ops): ${error}`)
      })
    }
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

backfillApprovalOrganizationIds()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
