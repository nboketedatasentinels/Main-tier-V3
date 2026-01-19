#!/usr/bin/env node

/**
 * Diagnostic Script: Partner Organization Mismatch Analyzer
 *
 * Purpose: Identifies why users aren't showing in Partner Dashboard
 *
 * This script:
 * 1. Reads partner's assigned organizations from their profile
 * 2. Fetches organization details (code, name)
 * 3. Queries all user profiles
 * 4. Identifies users with mismatched organization fields
 * 5. Reports detailed findings and suggested fixes
 *
 * Usage:
 *   node scripts/diagnose-partner-org-mismatch.mjs <partnerUserId>
 *   node scripts/diagnose-partner-org-mismatch.mjs --email partner@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

// Main diagnostic function
async function diagnosePartnerOrgMismatch(partnerUserId) {
  console.log('🔍 Partner Organization Mismatch Diagnostic Tool\n')
  console.log('=' .repeat(60))

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
  console.log(`   User ID: ${partnerUserId}`)
  console.log(`   Role: ${partnerData.role || 'unknown'}`)
  console.log(`   Assigned Organizations: ${JSON.stringify(assignedOrganizations)}`)

  if (assignedOrganizations.length === 0) {
    console.log('\n⚠️  WARNING: Partner has NO assigned organizations!')
    console.log('   This is why no users are showing in the dashboard.')
    console.log('   Solution: Add organization IDs to the assignedOrganizations array.')
    return
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
        status: orgData.status || 'unknown',
      })
      console.log(`   ✓ ${orgId}: ${orgData.name || 'Unknown'} (code: ${orgData.code || 'N/A'})`)
    } else {
      console.log(`   ✗ ${orgId}: NOT FOUND in organizations collection`)
    }
  }

  // Step 3: Build expected org keys (matching frontend logic)
  console.log(`\n📋 Step 3: Building expected organization keys...`)
  const assignedOrgKeys = new Set()

  // Add raw org IDs
  assignedOrganizations.forEach((orgId) => {
    const normalized = normalizeOrgKey(orgId)
    if (normalized) assignedOrgKeys.add(normalized)
  })

  // Add org codes and IDs from fetched orgs
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

  console.log(`   Expected keys (${assignedOrgKeys.size}):`)
  Array.from(assignedOrgKeys).forEach((key) => {
    console.log(`     - "${key}"`)
  })

  // Step 4: Query all user profiles
  console.log(`\n📋 Step 4: Scanning all user profiles...`)
  const usersSnapshot = await db.collection('profiles').get()

  const matchedUsers = []
  const mismatchedUsers = []
  const inactiveUsers = []

  usersSnapshot.forEach((userDoc) => {
    const userData = userDoc.data()

    // Check account status
    const accountStatus = (userData.accountStatus || userData.status || 'active').toLowerCase()
    const allowedStatuses = ['active', 'onboarding', 'paused']

    if (!allowedStatuses.includes(accountStatus)) {
      inactiveUsers.push({
        id: userDoc.id,
        email: userData.email,
        name: userData.name || userData.fullName,
        status: accountStatus,
      })
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

    const userInfo = {
      id: userDoc.id,
      email: userData.email,
      name: userData.name || userData.fullName || 'Unknown',
      status: accountStatus,
      orgKeys: Array.from(userOrgKeys),
      companyCode: userData.companyCode || '',
      company_code: userData.company_code || '',
      companyId: userData.companyId || '',
      company_id: userData.company_id || '',
      organizationId: userData.organizationId || '',
      organization_id: userData.organization_id || '',
    }

    if (hasMatch) {
      matchedUsers.push(userInfo)
    } else {
      mismatchedUsers.push(userInfo)
    }
  })

  // Step 5: Report findings
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 DIAGNOSTIC RESULTS')
  console.log('='.repeat(60))

  console.log(`\n✅ MATCHED USERS (${matchedUsers.length})`)
  console.log('   These users WILL show in the Partner Dashboard:\n')

  if (matchedUsers.length === 0) {
    console.log('   (none)')
  } else {
    matchedUsers.slice(0, 10).forEach((user) => {
      console.log(`   • ${user.name || user.email}`)
      console.log(`     ID: ${user.id}`)
      console.log(`     Org Keys: ${user.orgKeys.join(', ') || '(none)'}`)
      console.log('')
    })

    if (matchedUsers.length > 10) {
      console.log(`   ... and ${matchedUsers.length - 10} more`)
    }
  }

  console.log(`\n❌ MISMATCHED USERS (${mismatchedUsers.length})`)
  console.log('   These users WILL NOT show in the Partner Dashboard:\n')

  if (mismatchedUsers.length === 0) {
    console.log('   (none)')
  } else {
    mismatchedUsers.slice(0, 20).forEach((user) => {
      console.log(`   • ${user.name || user.email}`)
      console.log(`     ID: ${user.id}`)
      console.log(`     Current Org Keys: ${user.orgKeys.join(', ') || '(EMPTY!)'}`)
      console.log(`     Fields:`)
      console.log(`       companyCode: "${user.companyCode}"`)
      console.log(`       companyId: "${user.companyId}"`)
      console.log(`       organizationId: "${user.organizationId}"`)
      console.log('')
    })

    if (mismatchedUsers.length > 20) {
      console.log(`   ... and ${mismatchedUsers.length - 20} more`)
    }
  }

  if (inactiveUsers.length > 0) {
    console.log(`\n⏸️  INACTIVE USERS (${inactiveUsers.length})`)
    console.log('   These users are filtered out due to account status:\n')

    inactiveUsers.slice(0, 10).forEach((user) => {
      console.log(`   • ${user.name || user.email} (status: ${user.status})`)
    })

    if (inactiveUsers.length > 10) {
      console.log(`   ... and ${inactiveUsers.length - 10} more`)
    }
  }

  // Step 6: Generate fix suggestions
  console.log(`\n${'='.repeat(60)}`)
  console.log('💡 FIX RECOMMENDATIONS')
  console.log('='.repeat(60))

  if (mismatchedUsers.length > 0) {
    console.log('\n🔧 To fix the mismatched users, you have two options:\n')

    console.log('Option 1: Run the automated fix script')
    console.log('   node scripts/fix-user-organization-assignments.mjs ' + partnerUserId)
    console.log('')

    console.log('Option 2: Manual Firestore updates')
    console.log('   For each mismatched user, update their profile document:')
    console.log('')

    // Pick the first org to use as the fix target
    const targetOrg = Array.from(orgDetails.values())[0]
    if (targetOrg) {
      console.log(`   Set these fields to: "${targetOrg.code}" or "${targetOrg.id}"`)
      console.log(`     - companyCode`)
      console.log(`     - organizationId`)
      console.log('')
    }

    console.log('   Example for first mismatched user:')
    const firstMismatch = mismatchedUsers[0]
    if (firstMismatch && targetOrg) {
      console.log(`     Firestore Console → profiles → ${firstMismatch.id}`)
      console.log(`     Update:`)
      console.log(`       companyCode: "${targetOrg.code}"`)
      console.log(`       organizationId: "${targetOrg.id}"`)
    }
  } else {
    console.log('\n✅ No mismatched users found!')
    console.log('   All active users have correct organization assignments.')
    console.log('')
    console.log('   If users still aren\'t showing in the dashboard, check:')
    console.log('   1. The partner user is logged in correctly')
    console.log('   2. Browser console for JavaScript errors')
    console.log('   3. Firestore security rules allow reading user profiles')
  }

  console.log(`\n${'='.repeat(60)}\n`)
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage:')
    console.log('  node scripts/diagnose-partner-org-mismatch.mjs <partnerUserId>')
    console.log('  node scripts/diagnose-partner-org-mismatch.mjs --email partner@example.com')
    console.log('')
    console.log('Examples:')
    console.log('  node scripts/diagnose-partner-org-mismatch.mjs abc123xyz')
    console.log('  node scripts/diagnose-partner-org-mismatch.mjs --email john@partner.com')
    process.exit(0)
  }

  let partnerUserId = null

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
    await diagnosePartnerOrgMismatch(partnerUserId)
  } catch (error) {
    console.error('\n❌ Error during diagnosis:')
    console.error(error)
    process.exit(1)
  }
}

main()
