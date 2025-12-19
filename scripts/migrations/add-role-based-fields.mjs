#!/usr/bin/env node

/**
 * Migration Script: Add Role-Based Login Fields to User Profiles
 * 
 * This script adds the following fields to existing user profiles:
 * - transformationTier (default: 'individual_free')
 * - assignedOrganizations (default: [])
 * - accountStatus (default: 'active')
 * - mustChangePassword (default: false)
 * - onboardingComplete (default: true for existing users)
 * - onboardingSkipped (default: false)
 * - hasSeenDashboardTour (default: false)
 * - dashboardPreferences (object with default values)
 * - defaultDashboardRoute (based on role)
 * 
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure you have Firebase Admin credentials configured
 * 3. Run: node scripts/migrations/add-role-based-fields.mjs
 */

import admin from 'firebase-admin'
import { readFile } from 'fs/promises'

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await readFile(new URL('../../service-account-key.json', import.meta.url))
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
})

const db = admin.firestore()

// Default dashboard route based on role
function getDefaultDashboardRoute(role) {
  const roleMap = {
    'super_admin': '/super-admin/dashboard',
    'admin': '/admin/dashboard',
    'company_admin': '/admin/dashboard',
    'mentor': '/mentor/dashboard',
    'ambassador': '/ambassador/dashboard',
    'paid_member': '/app/dashboard/member',
    'free_user': '/app/dashboard/free'
  }
  return roleMap[role] || '/app/weekly-glance'
}

// Default dashboard preferences based on role
function getDefaultDashboardPreferences(role) {
  const isFree = role === 'free_user'
  return {
    defaultRoute: '/app/weekly-glance',
    membershipStatus: isFree ? 'free' : 'paid',
    lockedToFreeExperience: isFree,
    source: 'migration',
    lastUpdatedAt: new Date().toISOString()
  }
}

async function migrateProfiles() {
  console.log('Starting migration: Adding role-based login fields to profiles...')
  
  try {
    // Create a backup timestamp
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
    console.log(`Backup timestamp: ${backupTimestamp}`)
    
    // Get all profiles
    const profilesSnapshot = await db.collection('profiles').get()
    console.log(`Found ${profilesSnapshot.size} profiles to migrate`)
    
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    // Process profiles in batches
    const batchSize = 500
    let batch = db.batch()
    let batchCount = 0
    
    for (const doc of profilesSnapshot.docs) {
      try {
        const profile = doc.data()
        const userId = doc.id
        
        // Skip if already migrated (check for transformationTier field)
        if (profile.transformationTier !== undefined) {
          console.log(`Skipping ${userId}: already migrated`)
          continue
        }
        
        // Prepare update data
        const updateData = {
          // Transformation tier based on existing data
          transformationTier: profile.companyId ? 'corporate_member' : 'individual_free',
          
          // Organization access (empty for now, admins will be assigned manually)
          assignedOrganizations: [],
          
          // Account status (default to active for existing users)
          accountStatus: 'active',
          
          // Password change not required for existing users
          mustChangePassword: false,
          
          // Onboarding (mark as complete for existing users since they're already using the system)
          onboardingComplete: true,
          onboardingSkipped: false,
          
          // Dashboard tour
          hasSeenDashboardTour: false,
          
          // Dashboard preferences
          dashboardPreferences: getDefaultDashboardPreferences(profile.role),
          
          // Default dashboard route
          defaultDashboardRoute: getDefaultDashboardRoute(profile.role),
          
          // Update timestamp
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
        
        // Add to batch
        const profileRef = db.collection('profiles').doc(userId)
        batch.update(profileRef, updateData)
        batchCount++
        
        // Commit batch if it reaches batch size
        if (batchCount >= batchSize) {
          await batch.commit()
          successCount += batchCount
          console.log(`Committed batch of ${batchCount} profiles (total: ${successCount})`)
          batch = db.batch()
          batchCount = 0
        }
        
      } catch (error) {
        errorCount++
        errors.push({ userId: doc.id, error: error.message })
        console.error(`Error processing profile ${doc.id}:`, error.message)
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit()
      successCount += batchCount
      console.log(`Committed final batch of ${batchCount} profiles`)
    }
    
    console.log('\n=== Migration Complete ===')
    console.log(`Successfully migrated: ${successCount} profiles`)
    console.log(`Errors: ${errorCount}`)
    
    if (errors.length > 0) {
      console.log('\nErrors encountered:')
      errors.forEach(({ userId, error }) => {
        console.log(`  - ${userId}: ${error}`)
      })
    }
    
    console.log('\nNext steps:')
    console.log('1. Review admin users and assign them to organizations via assignedOrganizations array')
    console.log('2. Update transformationTier for corporate users as needed')
    console.log('3. Test login flow for each role type')
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrateProfiles()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
