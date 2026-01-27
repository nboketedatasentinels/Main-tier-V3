/**
 * Migration Script: Sync users collection to profiles collection
 *
 * This script copies user documents from the 'users' collection to the 'profiles' collection
 * for users who signed up via email/password before the fix that writes to both collections.
 *
 * Usage:
 *   node scripts/migrations/sync-users-to-profiles.mjs
 *
 * Options:
 *   --dry-run    Preview changes without writing to Firestore
 *   --force      Overwrite existing profiles (default: skip if profile exists)
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Initialize Firebase Admin
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable or default credentials
let app
try {
  app = initializeApp()
} catch (error) {
  // App might already be initialized
  console.log('Firebase app already initialized or using default credentials')
}

const db = getFirestore()

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const forceOverwrite = args.includes('--force')

async function syncUsersToProfiles() {
  console.log('='.repeat(60))
  console.log('Migration: Sync users to profiles collection')
  console.log('='.repeat(60))
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Force overwrite: ${forceOverwrite ? 'YES' : 'NO (skip existing)'}`)
  console.log('')

  try {
    // Get all documents from users collection
    const usersSnapshot = await db.collection('users').get()
    console.log(`Found ${usersSnapshot.size} documents in 'users' collection`)

    let synced = 0
    let skipped = 0
    let errors = 0

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id
      const userData = userDoc.data()

      try {
        // Check if profile already exists
        const profileRef = db.collection('profiles').doc(userId)
        const profileDoc = await profileRef.get()

        if (profileDoc.exists && !forceOverwrite) {
          console.log(`  [SKIP] ${userId} (${userData.email || 'no email'}) - profile already exists`)
          skipped++
          continue
        }

        // Prepare profile data
        const profileData = {
          ...userData,
          // Ensure timestamps are set
          updatedAt: FieldValue.serverTimestamp(),
        }

        // Only set createdAt if it doesn't exist in the source
        if (!userData.createdAt) {
          profileData.createdAt = FieldValue.serverTimestamp()
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] Would sync: ${userId} (${userData.email || 'no email'})`)
          console.log(`            Role: ${userData.role}, Company: ${userData.companyCode || userData.companyId || 'none'}`)
        } else {
          await profileRef.set(profileData, { merge: true })
          console.log(`  [SYNCED] ${userId} (${userData.email || 'no email'})`)
        }
        synced++

      } catch (docError) {
        console.error(`  [ERROR] ${userId}: ${docError.message}`)
        errors++
      }
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('Summary:')
    console.log(`  Total users:    ${usersSnapshot.size}`)
    console.log(`  Synced:         ${synced}${isDryRun ? ' (would sync)' : ''}`)
    console.log(`  Skipped:        ${skipped}`)
    console.log(`  Errors:         ${errors}`)
    console.log('='.repeat(60))

    if (isDryRun) {
      console.log('')
      console.log('This was a dry run. To apply changes, run without --dry-run flag.')
    }

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
syncUsersToProfiles()
  .then(() => {
    console.log('')
    console.log('Migration complete.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
