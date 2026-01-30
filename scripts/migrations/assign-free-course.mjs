#!/usr/bin/env node

/**
 * Migration Script: Assign free "Transformational Leadership" course to free users
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/assign-free-course.mjs
 */

import admin from 'firebase-admin'
import { readFile } from 'fs/promises'

const COURSE_TITLE = 'Transformational Leadership'
const COURSE_DETAILS = {
  description: 'Guide teams through change with vision and trust.',
  link: 'https://www.t4leader.com/challenge-page/transformational-leadership?programId=d4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335',
}
const COURSE_METADATA = {
  estimatedMinutes: 140,
  difficulty: 'Advanced',
}

const serviceAccount = JSON.parse(
  await readFile(new URL('../../service-account-key.json', import.meta.url))
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
})

const db = admin.firestore()

const getFreeUserDocs = async () => {
  const queries = [
    db.collection('users').where('transformationTier', '==', 'individual_free'),
    db.collection('users').where('role', '==', 'free_user'),
    db.collection('users').where('membershipStatus', '==', 'free'),
  ]

  const userMap = new Map()

  for (const queryRef of queries) {
    const snapshot = await queryRef.get()
    snapshot.forEach((doc) => {
      if (!userMap.has(doc.id)) {
        userMap.set(doc.id, doc.data())
      }
    })
  }

  return userMap
}

const hasCourseAssigned = async (userId) => {
  const snapshot = await db
    .collection('user_courses')
    .where('user_id', '==', userId)
    .where('title', '==', COURSE_TITLE)
    .limit(1)
    .get()
  return !snapshot.empty
}

async function assignFreeCourse() {
  console.log('Starting migration: Assign free course to free users...')

  try {
    const userMap = await getFreeUserDocs()
    console.log(`Found ${userMap.size} free users to evaluate`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0
    const errors = []

    const batchSize = 500
    let batch = db.batch()
    let batchCount = 0

    for (const userId of userMap.keys()) {
      try {
        const alreadyAssigned = await hasCourseAssigned(userId)
        if (alreadyAssigned) {
          skipCount++
          continue
        }

        const assignmentRef = db.collection('user_courses').doc()
        batch.set(assignmentRef, {
          user_id: userId,
          title: COURSE_TITLE,
          description: COURSE_DETAILS.description,
          link: COURSE_DETAILS.link,
          status: 'assigned',
          source: 'user',
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          progress: 0,
          estimatedMinutes: COURSE_METADATA.estimatedMinutes,
          difficulty: COURSE_METADATA.difficulty,
        })

        batchCount++

        if (batchCount >= batchSize) {
          await batch.commit()
          successCount += batchCount
          console.log(`Committed batch of ${batchCount} assignments (total: ${successCount})`)
          batch = db.batch()
          batchCount = 0
        }
      } catch (error) {
        errorCount++
        errors.push({ userId, error: error.message })
        console.error(`Error processing user ${userId}:`, error.message)
      }
    }

    if (batchCount > 0) {
      await batch.commit()
      successCount += batchCount
      console.log(`Committed final batch of ${batchCount} assignments`)
    }

    console.log('\n=== Migration Complete ===')
    console.log(`Assigned: ${successCount}`)
    console.log(`Skipped (already assigned): ${skipCount}`)
    console.log(`Errors: ${errorCount}`)

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

assignFreeCourse()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
