#!/usr/bin/env node

/**
 * Migration Script: Backfill referral codes for existing users
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/backfill-referral-codes.mjs
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

async function backfillReferralCodes() {
  console.log('Starting migration: Backfill referral codes...')

  try {
    const usersSnapshot = await db.collection('users').get()
    console.log(`Found ${usersSnapshot.size} users to process`)

    let batch = db.batch()
    let batchOps = 0
    let updatedCount = 0
    let skippedCount = 0
    let referralDocCount = 0
    let errors = []

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id
      const data = doc.data() || {}
      const code = (data.referralCode || userId).toString()

      if (!code) {
        skippedCount += 1
        continue
      }

      if (!data.referralCode) {
        batch.set(
          doc.ref,
          {
            referralCode: code,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        batchOps += 1
        updatedCount += 1
      } else {
        skippedCount += 1
      }

      const referralCodeRef = db.collection('referralCodes').doc(code)
      batch.set(
        referralCodeRef,
        {
          uid: userId,
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      batchOps += 1
      referralDocCount += 1

      const profileRef = db.collection('profiles').doc(userId)
      batch.set(
        profileRef,
        {
          referralCode: code,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      batchOps += 1

      if (batchOps >= BATCH_LIMIT) {
        await batch.commit()
        console.log(`Committed batch with ${batchOps} operations`)
        batch = db.batch()
        batchOps = 0
      }
    }

    if (batchOps > 0) {
      await batch.commit()
      console.log(`Committed final batch with ${batchOps} operations`)
    }

    console.log('\n=== Migration Complete ===')
    console.log(`Users updated with referralCode: ${updatedCount}`)
    console.log(`Referral code docs created/updated: ${referralDocCount}`)
    console.log(`Users skipped (already had code): ${skippedCount}`)

    if (errors.length > 0) {
      console.log('\nErrors encountered:')
      errors.forEach(({ userId, error }) => {
        console.log(`  - ${userId}: ${error}`)
      })
    }
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

backfillReferralCodes()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
