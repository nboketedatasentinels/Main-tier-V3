#!/usr/bin/env node

/**
 * Bulk Fix Script: User Organization Assignment Corrector
 *
 * Purpose: Automatically fixes mismatched organization fields in user profiles
 *          so they appear in the Partner Dashboard
 *
 * This script:
 * 1. Runs the diagnostic logic to identify mismatched users
 * 2. Prompts for confirmation before making changes
 * 3. Updates user profiles in batches using Firestore batch writes
 * 4. Sets both companyCode and organizationId fields
 * 5. Reports detailed results
 *
 * Safety features:
 * - Dry-run mode to preview changes
 * - Batch size limits (500 per batch max)
 * - Detailed logging of all changes
 * - Confirmation prompt before applying
 *
 * Usage:
 *   node scripts/fix-user-organization-assignments.mjs <partnerUserId>
 *   node scripts/fix-user-organization-assignments.mjs <partnerUserId> --dry-run
 *   node scripts/fix-user-organization-assignments.mjs --email partner@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import * as readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
let serviceAccount

try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (error) {
  console.error('❌ Error: Could not read serviceAccountKey.json')
  console.error('   Please ensure the file exists at:', serviceAccountPath)
  process.exit(1)
}

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

// Normalization utilities (matching frontend logic)
const normalizeOrgKey = (key) => {
  if (!key || typeof key !== 'string') return null
  const trimmed = key.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

const createOrgKeySet = (keys) => {
  const normalized = keys
    .map(normalizeOrgKey)
    .filter((key) => key !== null)
  return new Set(normalized)
}

// Prompt user for confirmation
function promptConfirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

// Main fix function
async function fixUserOrganizationAssignments(partnerUserId, dryRun = false) {
  console.log('🔧 User Organization Assignment Fixer\n')
  console.log('='.repeat(60))

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('='.repeat(60))
  }

  // Step 1: Get partner profile
  console.log(`\n📋 Step 1: Fetching partner profile...`)
  const partnerDoc = await db.collection('profiles').doc(partnerUserId).get()

  if (!partnerDoc.exists) {
    console.error(`❌ Error: Partner profile not found for ID: ${partnerUserId}`)
    process.exit(1)
  }

  const partnerData = partnerDoc.data()
  const assignedOrganizations = partnerData.assignedOrganizations || []

  console.log(`   Partner: ${partnerData.email || partnerData.name || 'Unknown'}`)
  console.log(`   Assigned Organizations: ${JSON.stringify(assignedOrganizations)}`)

  if (assignedOrganizations.length === 0) {
    console.log('\n⚠️  ERROR: Partner has NO assigned organizations!')
    console.log('   Cannot fix users without knowing which organization to assign.')
    console.log('   Please assign organizations to the partner first.')
    process.exit(1)
  }

  // Step 2: Fetch organization details
  console.log(`\n📋 Step 2: Fetching organization details...`)
  const orgDetails = new Map()

  for (const orgId of assignedOrganizations) {
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    if (orgDoc.exists) {
      const orgData = orgDoc.data()
      orgDetails.set(orgId, {
        id: orgId,
        code: orgData.code || orgId,
        name: orgData.name || 'Unknown',
      })
      console.log(`   ✓ ${orgId}: ${orgData.name || 'Unknown'} (code: ${orgData.code || 'N/A'})`)
    } else {
      console.log(`   ✗ ${orgId}: NOT FOUND`)
    }
  }

  // Step 3: Build expected org keys
  const assignedOrgKeys = new Set()

  assignedOrganizations.forEach((orgId) => {
    const normalized = normalizeOrgKey(orgId)
    if (normalized) assignedOrgKeys.add(normalized)
  })

  orgDetails.forEach((org) => {
    if (org.id) {
      const normalized = normalizeOrgKey(org.id)
      if (normalized) assignedOrgKeys.add(normalized)
    }
    if (org.code) {
      const normalized = normalizeOrgKey(org.code)
      if (normalized) assignedOrgKeys.add(normalized)
    }
  })

  // Step 4: Query all user profiles and identify mismatches
  console.log(`\n📋 Step 3: Scanning user profiles...`)
  const usersSnapshot = await db.collection('profiles').get()

  const mismatchedUsers = []

  usersSnapshot.forEach((userDoc) => {
    const userData = userDoc.data()

    // Only process active users
    const accountStatus = (userData.accountStatus || userData.status || 'active').toLowerCase()
    const allowedStatuses = ['active', 'onboarding', 'paused']

    if (!allowedStatuses.includes(accountStatus)) {
      return // Skip inactive users
    }

    // Extract user's organization keys
    const userOrgKeys = createOrgKeySet([
      userData.companyCode,
      userData.company_code,
      userData.companyId,
      userData.company_id,
      userData.organizationId,
      userData.organization_id,
    ])

    // Check if any user org key matches assigned org keys
    const hasMatch = Array.from(userOrgKeys).some((key) => assignedOrgKeys.has(key))

    if (!hasMatch) {
      mismatchedUsers.push({
        id: userDoc.id,
        email: userData.email,
        name: userData.name || userData.fullName || 'Unknown',
        currentCompanyCode: userData.companyCode || '',
        currentOrganizationId: userData.organizationId || '',
      })
    }
  })

  console.log(`   Found ${mismatchedUsers.length} mismatched users`)

  if (mismatchedUsers.length === 0) {
    console.log('\n✅ No mismatched users found!')
    console.log('   All users already have correct organization assignments.')
    return
  }

  // Step 5: Determine which org to assign
  const targetOrg = Array.from(orgDetails.values())[0]

  if (!targetOrg) {
    console.error('\n❌ Error: No valid organization found to assign')
    process.exit(1)
  }

  console.log(`\n🎯 Target Organization:`)
  console.log(`   Name: ${targetOrg.name}`)
  console.log(`   ID: ${targetOrg.id}`)
  console.log(`   Code: ${targetOrg.code}`)

  // Step 6: Preview changes
  console.log(`\n📝 Changes to be applied (${mismatchedUsers.length} users):\n`)

  const previewLimit = 10
  mismatchedUsers.slice(0, previewLimit).forEach((user) => {
    console.log(`   • ${user.name || user.email}`)
    console.log(`     Current: companyCode="${user.currentCompanyCode}", organizationId="${user.currentOrganizationId}"`)
    console.log(`     New:     companyCode="${targetOrg.code}", organizationId="${targetOrg.id}"`)
    console.log('')
  })

  if (mismatchedUsers.length > previewLimit) {
    console.log(`   ... and ${mismatchedUsers.length - previewLimit} more users`)
  }

  // Step 7: Confirm or execute
  if (dryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - No changes were made')
    console.log('   To apply these changes, run without --dry-run flag')
    return
  }

  console.log('\n⚠️  WARNING: This will update all mismatched user profiles!')
  const confirmed = await promptConfirm('   Do you want to proceed? (yes/no): ')

  if (!confirmed) {
    console.log('\n❌ Operation cancelled by user')
    return
  }

  // Step 8: Apply fixes in batches
  console.log('\n⚙️  Applying fixes...')

  const batchSize = 500 // Firestore batch write limit
  const batches = []
  let currentBatch = db.batch()
  let currentBatchCount = 0
  let totalUpdated = 0
  const errors = []

  for (const user of mismatchedUsers) {
    const userRef = db.collection('profiles').doc(user.id)

    currentBatch.update(userRef, {
      companyCode: targetOrg.code,
      organizationId: targetOrg.id,
      // Store original values for audit trail
      '_fix_original_companyCode': user.currentCompanyCode,
      '_fix_original_organizationId': user.currentOrganizationId,
      '_fix_timestamp': new Date().toISOString(),
      '_fix_by_script': true,
    })

    currentBatchCount++

    if (currentBatchCount >= batchSize) {
      batches.push(currentBatch)
      currentBatch = db.batch()
      currentBatchCount = 0
    }
  }

  // Add the last batch if it has items
  if (currentBatchCount > 0) {
    batches.push(currentBatch)
  }

  console.log(`   Processing ${batches.length} batch(es)...`)

  for (let i = 0; i < batches.length; i++) {
    try {
      await batches[i].commit()
      const batchCount = Math.min(batchSize, mismatchedUsers.length - totalUpdated)
      totalUpdated += batchCount
      console.log(`   ✓ Batch ${i + 1}/${batches.length} complete (${batchCount} users)`)
    } catch (error) {
      console.error(`   ✗ Batch ${i + 1}/${batches.length} failed:`, error.message)
      errors.push({ batch: i + 1, error: error.message })
    }
  }

  // Step 9: Report results
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 FIX RESULTS')
  console.log('='.repeat(60))

  console.log(`\n✅ Successfully updated: ${totalUpdated} users`)

  if (errors.length > 0) {
    console.log(`\n❌ Errors: ${errors.length} batch(es) failed`)
    errors.forEach((err) => {
      console.log(`   Batch ${err.batch}: ${err.error}`)
    })
  }

  console.log('\n🎉 Fix complete!')
  console.log('\nNext steps:')
  console.log('1. Refresh the Partner Dashboard')
  console.log('2. Check the Debug Accordion - rejection count should be 0')
  console.log('3. Verify users now appear in the dashboard table')

  console.log(`\n${'='.repeat(60)}\n`)
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage:')
    console.log('  node scripts/fix-user-organization-assignments.mjs <partnerUserId>')
    console.log('  node scripts/fix-user-organization-assignments.mjs <partnerUserId> --dry-run')
    console.log('  node scripts/fix-user-organization-assignments.mjs --email partner@example.com')
    console.log('')
    console.log('Options:')
    console.log('  --dry-run    Preview changes without applying them')
    console.log('  --email      Look up partner by email instead of user ID')
    console.log('')
    console.log('Examples:')
    console.log('  node scripts/fix-user-organization-assignments.mjs abc123xyz')
    console.log('  node scripts/fix-user-organization-assignments.mjs abc123xyz --dry-run')
    console.log('  node scripts/fix-user-organization-assignments.mjs --email john@partner.com')
    process.exit(0)
  }

  let partnerUserId = null
  const dryRun = args.includes('--dry-run')

  if (args[0] === '--email' && args[1]) {
    // Look up user by email
    const email = args[1]
    console.log(`Looking up partner by email: ${email}...`)

    const usersSnapshot = await db.collection('profiles')
      .where('email', '==', email)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      console.error(`❌ Error: No user found with email: ${email}`)
      process.exit(1)
    }

    partnerUserId = usersSnapshot.docs[0].id
    console.log(`Found user ID: ${partnerUserId}\n`)
  } else {
    partnerUserId = args[0]
  }

  try {
    await fixUserOrganizationAssignments(partnerUserId, dryRun)
  } catch (error) {
    console.error('\n❌ Error during fix operation:')
    console.error(error)
    process.exit(1)
  }
}

main()
