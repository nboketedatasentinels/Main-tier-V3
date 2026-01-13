#!/usr/bin/env node

/**
 * Migration Script: Copy legacy companies documents to organizations
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/migrate-companies-to-organizations.mjs
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

const migrateCompaniesToOrganizations = async () => {
  console.log('Starting migration: companies -> organizations')

  const companiesSnapshot = await db.collection('companies').get()
  if (companiesSnapshot.empty) {
    console.log('No companies collection data found. Nothing to migrate.')
    return
  }

  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const docSnap of companiesSnapshot.docs) {
    try {
      const orgRef = db.collection('organizations').doc(docSnap.id)
      const orgSnapshot = await orgRef.get()
      if (orgSnapshot.exists) {
        skippedCount += 1
        continue
      }

      await orgRef.set(
        {
          ...docSnap.data(),
          migratedFrom: 'companies',
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      createdCount += 1
    } catch (error) {
      errorCount += 1
      console.error(`Failed to migrate company ${docSnap.id}:`, error.message)
    }
  }

  console.log('Migration complete')
  console.log(`Created organizations: ${createdCount}`)
  console.log(`Skipped existing organizations: ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
}

migrateCompaniesToOrganizations()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
