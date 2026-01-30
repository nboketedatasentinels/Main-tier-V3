#!/usr/bin/env node

/**
 * Migration Script: Create the complementary Transformational Leadership course document
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/create-transformational-leadership-course.mjs
 */

import admin from 'firebase-admin'
import { readFile } from 'fs/promises'

const COURSE_ID = 'transformational-leadership'
const COURSE_TITLE = 'Transformational Leadership'
const COURSE_DESCRIPTION = 'Guide teams through change with vision and trust.'
const COURSE_LINK =
  'https://www.t4leader.com/challenge-page/transformational-leadership?programId=d4e58ca0-f0e6-4f12-b2a8-9dc5fcf6e335'
const COURSE_TOTAL_POINTS = 100
const COURSE_ESTIMATED_HOURS = 2.3

const serviceAccount = JSON.parse(
  await readFile(new URL('../../service-account-key.json', import.meta.url))
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
})

const db = admin.firestore()

async function createCourseDocument() {
  console.log('Starting migration: Create Transformational Leadership course document...')

  try {
    const courseRef = db.collection('courses').doc(COURSE_ID)
    const existing = await courseRef.get()

    if (existing.exists) {
      console.log(`Course document "${COURSE_ID}" already exists. No changes made.`)
      return
    }

    await courseRef.set({
      title: COURSE_TITLE,
      name: COURSE_TITLE,
      description: COURSE_DESCRIPTION,
      link: COURSE_LINK,
      totalPoints: COURSE_TOTAL_POINTS,
      estimatedHours: COURSE_ESTIMATED_HOURS,
      modules: [],
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`Course document "${COURSE_ID}" created successfully.`)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

createCourseDocument()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
