#!/usr/bin/env node

/**
 * Migration Script: Assign the complimentary free-tier course to existing free users.
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure Firebase Admin credentials are available in service-account-key.json
 * 3. Run: node scripts/migrations/assign-free-course.mjs
 */

import admin from 'firebase-admin'
import { readFile } from 'fs/promises'

const FREE_COURSE_TITLE = 'Transformational Leadership'
const FREE_COURSE_DESCRIPTION = 'Guide teams through change with vision and trust.'
const FREE_COURSE_LINK = 'https://t4leader.com/program/transformational-leadership'
const FREE_COURSE_ESTIMATED_MINUTES = 140
const FREE_COURSE_DIFFICULTY = 'Advanced'

const serviceAccount = JSON.parse(
  await readFile(new URL('../../service-account-key.json', import.meta.url))
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
})

const db = admin.firestore()

const normalizeTitle = (value = '') => value.trim().toLowerCase()

const buildCoursePayload = (userId) => ({
  user_id: userId,
  title: FREE_COURSE_TITLE,
  description: FREE_COURSE_DESCRIPTION,
  link: FREE_COURSE_LINK,
  status: 'assigned',
  source: 'user',
  assignedAt: admin.firestore.FieldValue.serverTimestamp(),
  progress: 0,
  estimatedMinutes: FREE_COURSE_ESTIMATED_MINUTES,
  difficulty: FREE_COURSE_DIFFICULTY
})

const collectFreeUsers = async () => {
  const usersRef = db.collection('users')
  const [tierSnap, roleSnap, statusSnap] = await Promise.all([
    usersRef.where('transformationTier', '==', 'individual_free').get(),
    usersRef.where('role', '==', 'free_user').get(),
    usersRef.where('membershipStatus', '==', 'free').get()
  ])

  const userIds = new Map()
  for (const snap of [tierSnap, roleSnap, statusSnap]) {
    snap.forEach((docSnap) => {
      userIds.set(docSnap.id, true)
    })
  }

  return Array.from(userIds.keys())
}

const hasFreeCourseAssignment = async (userId) => {
  const snapshot = await db
    .collection('user_courses')
    .where('user_id', '==', userId)
    .get()
  const normalizedFreeTitle = normalizeTitle(FREE_COURSE_TITLE)
  return snapshot.docs.some((docSnap) => {
    const data = docSnap.data() || {}
    return normalizeTitle(data.title || '') === normalizedFreeTitle
  })
}

async function runMigration() {
  console.log('Starting migration: assign free course to existing free users...')

  try {
    const userIds = await collectFreeUsers()
    console.log(`Found ${userIds.length} free-tier users to evaluate.`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0
    const errors = []

    const batchSize = 500
    let batch = db.batch()
    let batchCount = 0
    let processedCount = 0

    for (const userId of userIds) {
      processedCount++
      try {
        const alreadyAssigned = await hasFreeCourseAssignment(userId)
        if (alreadyAssigned) {
          skipCount++
          continue
        }

        const docRef = db.collection('user_courses').doc()
        batch.set(docRef, buildCoursePayload(userId))
        batchCount++
        successCount++

        if (batchCount >= batchSize) {
          await batch.commit()
          console.log(`Committed batch of ${batchCount} assignments (processed ${processedCount}/${userIds.length}).`)
          batch = db.batch()
          batchCount = 0
        }
      } catch (error) {
        errorCount++
        errors.push({ userId, error: error?.message || String(error) })
        console.error(`Error processing user ${userId}:`, error?.message || error)
      }
    }

    if (batchCount > 0) {
      await batch.commit()
      console.log(`Committed final batch of ${batchCount} assignments.`)
    }

    console.log('\n=== Migration Complete ===')
    console.log(`Processed users: ${processedCount}`)
    console.log(`New assignments: ${successCount}`)
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

runMigration()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
