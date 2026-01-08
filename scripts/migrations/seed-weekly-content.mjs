#!/usr/bin/env node

/**
 * Migration Script: Seed weekly_content with sample podcast episodes
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure service-account-key.json is available at repo root
 * 3. Run: node scripts/migrations/seed-weekly-content.mjs
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

const VIDEO_URL = 'https://www.youtube.com/watch?v=Du71f-J9s2A'

const buildEntry = ({ weekNumber, journeyType, title }) => ({
  weekNumber,
  journeyType,
  title,
  description: `Week ${weekNumber} insights for the ${journeyType} journey.`,
  videoUrl: VIDEO_URL,
  thumbnailUrl: 'https://img.youtube.com/vi/Du71f-J9s2A/hqdefault.jpg',
  duration: '30 min',
  isActive: true,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
})

const seedEntries = () => {
  const entries = []
  for (let week = 1; week <= 4; week += 1) {
    entries.push(buildEntry({ weekNumber: week, journeyType: '4W', title: `4W Week ${week} Podcast` }))
  }
  for (let week = 1; week <= 6; week += 1) {
    entries.push(buildEntry({ weekNumber: week, journeyType: '6W', title: `6W Week ${week} Podcast` }))
  }
  return entries
}

const run = async () => {
  console.log('Seeding weekly_content collection...')
  const batch = db.batch()
  const entries = seedEntries()

  entries.forEach(entry => {
    const docRef = db.collection('weekly_content').doc()
    batch.set(docRef, entry)
  })

  await batch.commit()
  console.log(`Seeded ${entries.length} podcast entries.`)
}

run()
  .then(() => {
    console.log('Seed complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('Seed failed', error)
    process.exit(1)
  })
