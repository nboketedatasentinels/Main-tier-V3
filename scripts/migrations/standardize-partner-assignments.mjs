/**
 * Migration Script: Standardize Partner Assignments
 *
 * Purpose: Ensure all partner assignments have both organizationId AND companyCode
 *
 * This script:
 * 1. Reads all partner documents from the `partners` collection
 * 2. For each assignment, resolves missing organizationId or companyCode
 * 3. Updates the partner document with standardized assignments
 * 4. Logs all changes for audit trail
 *
 * Usage:
 *   node scripts/migrations/standardize-partner-assignments.mjs [--dry-run] [--partner-id=xyz]
 *
 * Options:
 *   --dry-run: Preview changes without writing to Firestore
 *   --partner-id: Only process specific partner (for testing)
 *   --verbose: Show detailed logging
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const specificPartner = args.find(arg => arg.startsWith('--partner-id='))?.split('=')[1]

console.log('🚀 Partner Assignment Standardization Migration')
console.log('================================================\n')

if (dryRun) {
  console.log('⚠️  DRY RUN MODE - No changes will be written to Firestore\n')
}

if (specificPartner) {
  console.log(`🎯 Processing specific partner: ${specificPartner}\n`)
}

// Initialize Firebase Admin
const resolveServiceAccountPath = () => {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (configuredPath) {
    return resolve(__dirname, configuredPath)
  }

  const candidates = [
    resolve(__dirname, '../../service-account-key.json'),
    resolve(__dirname, '../../serviceAccountKey.json'),
  ]

  return candidates.find((candidate) => existsSync(candidate))
}

let serviceAccount
try {
  const serviceAccountPath = resolveServiceAccountPath()
  if (!serviceAccountPath) {
    throw new Error('No service account key file found.')
  }
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (err) {
  console.error('❌ Failed to load service account key')
  console.error(
    '   Make sure service-account-key.json exists in the project root (or set FIREBASE_SERVICE_ACCOUNT_PATH)',
  )
  console.error(`   Error: ${err.message}`)
  process.exit(1)
}

const app = initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore(app)

// Statistics tracking
const stats = {
  totalPartners: 0,
  partnersProcessed: 0,
  partnersSkipped: 0,
  partnersUpdated: 0,
  assignmentsStandardized: 0,
  assignmentsMissingOrgId: 0,
  assignmentsMissingCode: 0,
  assignmentsUnresolved: 0,
  errors: []
}

/**
 * Normalize assignment to ensure it has both organizationId and companyCode
 */
async function standardizeAssignment(assignment, partnerId) {
  if (verbose) {
    console.log(`  Processing assignment:`, assignment)
  }

  // Handle string format (legacy)
  if (typeof assignment === 'string') {
    const orgId = assignment.trim()

    // Try to fetch organization document to get code
    try {
      const orgDoc = await db.collection('organizations').doc(orgId).get()

      if (!orgDoc.exists) {
        console.warn(`    ⚠️  Organization ${orgId} not found`)
        stats.assignmentsUnresolved++
        return {
          organizationId: orgId,
          companyCode: orgId, // Fallback to ID
          status: 'active',
          _warning: 'Organization document not found'
        }
      }

      const orgData = orgDoc.data()
      stats.assignmentsMissingCode++

      return {
        organizationId: orgId,
        companyCode: orgData.code || orgId,
        status: 'active',
        _resolved: 'Added companyCode from organization document'
      }
    } catch (err) {
      console.error(`    ❌ Error fetching organization ${orgId}:`, err.message)
      stats.errors.push({
        partnerId,
        assignment: orgId,
        error: err.message
      })
      return {
        organizationId: orgId,
        companyCode: orgId,
        status: 'active',
        _error: err.message
      }
    }
  }

  // Object format
  const result = { ...assignment }
  let modified = false

  // Case 1: Has organizationId but no companyCode
  if (result.organizationId && !result.companyCode) {
    try {
      const orgDoc = await db.collection('organizations').doc(result.organizationId).get()

      if (orgDoc.exists) {
        const orgData = orgDoc.data()
        result.companyCode = orgData.code || result.organizationId
        result._resolved = 'Added companyCode from organization document'
        stats.assignmentsMissingCode++
        modified = true
      } else {
        result.companyCode = result.organizationId
        result._warning = 'Organization document not found, used ID as code'
        stats.assignmentsUnresolved++
      }
    } catch (err) {
      console.error(`    ❌ Error resolving companyCode for ${result.organizationId}:`, err.message)
      result.companyCode = result.organizationId
      result._error = err.message
      stats.errors.push({
        partnerId,
        assignment: result.organizationId,
        error: err.message
      })
    }
  }

  // Case 2: Has companyCode but no organizationId
  if (result.companyCode && !result.organizationId) {
    try {
      const orgQuery = await db.collection('organizations')
        .where('code', '==', result.companyCode)
        .limit(1)
        .get()

      if (!orgQuery.empty) {
        result.organizationId = orgQuery.docs[0].id
        result._resolved = 'Added organizationId by querying with companyCode'
        stats.assignmentsMissingOrgId++
        modified = true
      } else {
        result.organizationId = result.companyCode
        result._warning = 'No organization found with this code, used code as ID'
        stats.assignmentsUnresolved++
      }
    } catch (err) {
      console.error(`    ❌ Error resolving organizationId for ${result.companyCode}:`, err.message)
      result.organizationId = result.companyCode
      result._error = err.message
      stats.errors.push({
        partnerId,
        assignment: result.companyCode,
        error: err.message
      })
    }
  }

  // Case 3: Has neither (should be rare)
  if (!result.organizationId && !result.companyCode) {
    console.warn(`    ⚠️  Assignment has neither organizationId nor companyCode:`, assignment)
    stats.assignmentsUnresolved++
    return null // Skip this assignment
  }

  // Ensure status field exists
  if (!result.status) {
    result.status = 'active'
    modified = true
  }

  if (modified) {
    stats.assignmentsStandardized++
  }

  return result
}

/**
 * Process a single partner document
 */
async function processPartner(partnerDoc) {
  const partnerId = partnerDoc.id
  const partnerData = partnerDoc.data()

  console.log(`\n📋 Processing partner: ${partnerId}`)

  if (!partnerData.assignedOrganizations) {
    console.log(`  ⏭️  No assignedOrganizations field, skipping`)
    stats.partnersSkipped++
    return
  }

  if (!Array.isArray(partnerData.assignedOrganizations)) {
    console.log(`  ⚠️  assignedOrganizations is not an array, skipping`)
    stats.partnersSkipped++
    return
  }

  if (partnerData.assignedOrganizations.length === 0) {
    console.log(`  ⏭️  Empty assignedOrganizations array, skipping`)
    stats.partnersSkipped++
    return
  }

  console.log(`  Found ${partnerData.assignedOrganizations.length} assignment(s)`)

  // Standardize each assignment
  const standardizedAssignments = []

  for (const assignment of partnerData.assignedOrganizations) {
    const standardized = await standardizeAssignment(assignment, partnerId)
    if (standardized) {
      standardizedAssignments.push(standardized)
    }
  }

  console.log(`  Standardized ${standardizedAssignments.length} assignment(s)`)

  // Check if any changes were made
  const hasChanges = standardizedAssignments.some(a => a._resolved || a._warning || a._error)

  if (!hasChanges) {
    console.log(`  ✅ All assignments already standardized`)
    stats.partnersProcessed++
    return
  }

  // Remove internal metadata before writing
  const cleanedAssignments = standardizedAssignments.map(({ _resolved, _warning, _error, ...rest }) => rest)

  if (verbose) {
    console.log(`  Cleaned assignments:`, JSON.stringify(cleanedAssignments, null, 2))
  }

  // Update Firestore (unless dry run)
  if (!dryRun) {
    try {
      await partnerDoc.ref.update({
        assignedOrganizations: cleanedAssignments,
        updatedAt: FieldValue.serverTimestamp(),
        _migrationNote: 'Assignments standardized by standardize-partner-assignments.mjs'
      })
      console.log(`  ✅ Updated partner document`)
      stats.partnersUpdated++
    } catch (err) {
      console.error(`  ❌ Failed to update partner document:`, err.message)
      stats.errors.push({
        partnerId,
        error: `Update failed: ${err.message}`
      })
    }
  } else {
    console.log(`  📝 Would update with:`, JSON.stringify(cleanedAssignments, null, 2))
    stats.partnersUpdated++ // Count as "would update"
  }

  stats.partnersProcessed++
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    console.log('📊 Fetching partner documents...\n')

    let partnersQuery = db.collection('partners')

    // Filter by specific partner if provided
    if (specificPartner) {
      partnersQuery = partnersQuery.where('__name__', '==', specificPartner)
    }

    const partnersSnapshot = await partnersQuery.get()
    stats.totalPartners = partnersSnapshot.size

    console.log(`Found ${stats.totalPartners} partner(s) to process\n`)
    console.log('=' .repeat(60))

    // Process each partner
    for (const partnerDoc of partnersSnapshot.docs) {
      await processPartner(partnerDoc)
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total partners found:        ${stats.totalPartners}`)
    console.log(`Partners processed:          ${stats.partnersProcessed}`)
    console.log(`Partners skipped:            ${stats.partnersSkipped}`)
    console.log(`Partners updated:            ${stats.partnersUpdated}`)
    console.log(`\nAssignments standardized:    ${stats.assignmentsStandardized}`)
    console.log(`  Missing organizationId:    ${stats.assignmentsMissingOrgId}`)
    console.log(`  Missing companyCode:       ${stats.assignmentsMissingCode}`)
    console.log(`  Unresolved:                ${stats.assignmentsUnresolved}`)
    console.log(`\nErrors encountered:          ${stats.errors.length}`)

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. Partner ${err.partnerId}:`, err.error)
      })
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN COMPLETE - No changes were written to Firestore')
      console.log('   Run without --dry-run to apply changes')
    } else {
      console.log('\n✅ Migration complete!')
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n👋 Exiting...')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Unexpected error:', err)
    process.exit(1)
  })
