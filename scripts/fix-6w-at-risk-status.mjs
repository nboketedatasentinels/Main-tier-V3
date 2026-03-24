/**
 * FIX: Clear incorrect at_risk status for 6-Week journey users in weeks 1-5
 *
 * This script finds all users in 6-week journey organizations who are:
 * 1. Currently marked as at_risk
 * 2. In weeks 1-5 of their journey
 *
 * And clears their at_risk status to 'warning' or 'on_track'
 *
 * Run with: node scripts/fix-6w-at-risk-status.mjs
 * Dry run:  node scripts/fix-6w-at-risk-status.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const isDryRun = process.argv.includes('--dry-run')

// Constants
const SIX_WEEK_JOURNEY_TYPE = '6W'
const AT_RISK_WEEK_THRESHOLD = 5
const PASS_MARK = 40000

/**
 * Calculate current week from journey start date
 */
function calculateCurrentWeek(startDate) {
  if (!startDate) return 1

  const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
  if (isNaN(start.getTime())) return 1

  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const currentWeek = Math.floor(diffDays / 7) + 1

  return Math.max(1, currentWeek)
}

/**
 * Resolve journey type from weeks or months
 */
function resolveJourneyType(org) {
  if (org.journeyType && ['4W', '6W', '3M', '6M', '9M'].includes(org.journeyType)) {
    return org.journeyType
  }

  const weeks = org.programDurationWeeks
  if (weeks) {
    if (weeks <= 4) return '4W'
    if (weeks <= 6) return '6W'
    if (weeks <= 12) return '3M'
    if (weeks <= 24) return '6M'
    return '9M'
  }

  const months = org.programDuration
  if (months) {
    if (months === 1.5) return '6W'
    if (months <= 1) return '4W'
    if (months <= 3) return '3M'
    if (months <= 6) return '6M'
    return '9M'
  }

  return null
}

async function main() {
  console.log('🔧 Fix 6-Week Journey At-Risk Status\n')
  console.log(isDryRun ? '⚠️  DRY RUN MODE - No changes will be made\n' : '🚀 LIVE MODE - Changes will be applied\n')

  // Initialize Firebase Admin
  const serviceAccountPath = resolve(__dirname, '../serviceAccountKey.json')

  if (!existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found at:', serviceAccountPath)
    console.log('Please download your Firebase service account key and save it there.')
    process.exit(1)
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  // Step 1: Get all 6-week journey organizations
  console.log('📋 Finding 6-week journey organizations...\n')

  const orgsSnapshot = await db.collection('organizations').get()
  const sixWeekOrgs = []

  for (const orgDoc of orgsSnapshot.docs) {
    const org = orgDoc.data()
    const journeyType = resolveJourneyType(org)

    if (journeyType === SIX_WEEK_JOURNEY_TYPE) {
      sixWeekOrgs.push({
        id: orgDoc.id,
        name: org.name || orgDoc.id,
        cohortStartDate: org.cohortStartDate,
      })
    }
  }

  console.log(`Found ${sixWeekOrgs.length} 6-week journey organizations\n`)

  if (sixWeekOrgs.length === 0) {
    console.log('No 6-week organizations found. Exiting.')
    return
  }

  // Step 2: Process each organization
  let totalFixed = 0
  let totalSkipped = 0
  let totalErrors = 0
  const fixedUsers = []

  for (const org of sixWeekOrgs) {
    console.log(`\n📁 Processing: ${org.name} (${org.id})`)

    // Get all users in this org
    const usersSnapshot = await db.collection('profiles')
      .where('companyId', '==', org.id)
      .get()

    console.log(`   Found ${usersSnapshot.size} users`)

    for (const userDoc of usersSnapshot.docs) {
      try {
        const profile = userDoc.data()
        const userId = userDoc.id
        const userName = profile.fullName || profile.email || userId

        // Calculate current week
        const journeyStartDate = profile.journeyStartDate || profile.cohortStartDate || org.cohortStartDate
        const currentWeek = profile.currentWeek || calculateCurrentWeek(journeyStartDate)
        const totalPoints = profile.totalPoints || 0

        // Skip if in week 6+ (they might legitimately be at risk)
        if (currentWeek > AT_RISK_WEEK_THRESHOLD) {
          continue
        }

        // Check weekly_points for at_risk status
        const weeklyPointsSnapshot = await db.collection('weekly_points')
          .where('user_id', '==', userId)
          .where('status', '==', 'at_risk')
          .get()

        // Check learner_status for at_risk status
        const statusDoc = await db.collection('learner_status').doc(userId).get()
        const statusData = statusDoc.exists ? statusDoc.data() : null
        const isAtRiskInStatus = statusData?.currentStatus === 'at_risk'

        // Check windowProgress for at_risk status
        const windowProgressSnapshot = await db.collection('windowProgress')
          .where('uid', '==', userId)
          .where('status', '==', 'at_risk')
          .get()

        const hasIncorrectAtRisk = !weeklyPointsSnapshot.empty || isAtRiskInStatus || !windowProgressSnapshot.empty

        if (!hasIncorrectAtRisk) {
          continue
        }

        console.log(`   ⚠️  ${userName}: Week ${currentWeek}, ${totalPoints} pts - incorrectly marked at_risk`)

        if (!isDryRun) {
          // Fix weekly_points
          for (const wpDoc of weeklyPointsSnapshot.docs) {
            await wpDoc.ref.update({
              status: 'warning',
              updated_at: FieldValue.serverTimestamp(),
            })
          }

          // Fix learner_status
          if (isAtRiskInStatus) {
            await db.collection('learner_status').doc(userId).update({
              currentStatus: 'active',
              previousStatus: 'at_risk',
              pointsBasedAtRisk: false,
              journeyAtRiskReason: FieldValue.delete(),
              statusChangedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            })
          }

          // Fix windowProgress
          for (const wpDoc of windowProgressSnapshot.docs) {
            await wpDoc.ref.update({
              status: 'warning',
              updatedAt: FieldValue.serverTimestamp(),
            })
          }

          console.log(`   ✅ Fixed: ${userName}`)
        }

        fixedUsers.push({
          userId,
          userName,
          orgName: org.name,
          currentWeek,
          totalPoints,
        })
        totalFixed++

      } catch (error) {
        console.error(`   ❌ Error processing user ${userDoc.id}:`, error.message)
        totalErrors++
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Summary:')
  console.log(`  Organizations processed: ${sixWeekOrgs.length}`)
  console.log(`  Users fixed: ${totalFixed}`)
  console.log(`  Errors: ${totalErrors}`)

  if (isDryRun && totalFixed > 0) {
    console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.')
  }

  if (fixedUsers.length > 0) {
    console.log('\nUsers that were/would be fixed:')
    fixedUsers.forEach(u => {
      console.log(`  - ${u.userName} (${u.orgName}): Week ${u.currentWeek}, ${u.totalPoints} pts`)
    })
  }

  console.log('\n✅ Done!')
}

main().catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
