/**
 * Migration: Backfill journey_type on organizations
 *
 * This script ensures all organizations have a journeyType field
 * calculated from their programDurationWeeks or programDuration.
 *
 * Run with: node scripts/migrations/backfill-journey-type.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Journey type mapping based on weeks
const JOURNEY_WEEKS_MAP = {
  4: '4W',
  6: '6W',
  12: '3M',
  24: '6M',
  36: '9M',
}

function journeyTypeFromDurationWeeks(weeks) {
  if (!weeks) return null
  const normalized = Math.round(weeks)
  if (!Number.isFinite(normalized)) return null

  const exactMatch = JOURNEY_WEEKS_MAP[normalized]
  if (exactMatch) return exactMatch

  if (normalized <= 4) return '4W'
  if (normalized <= 6) return '6W'
  if (normalized <= 12) return '3M'
  if (normalized <= 24) return '6M'
  if (normalized <= 36) return '9M'
  return '9M'
}

function resolveDurationWeeksFromProgramDuration(months) {
  if (months === undefined || months === null) return null
  const parsed = typeof months === 'string' ? Number(months) : months
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  if (parsed === 1.5) return 6
  if (parsed <= 12) return Math.round(Math.min(parsed, 9) * 4)
  return Math.round(parsed)
}

function resolveJourneyType(org) {
  // Explicit journey type takes priority
  if (org.journeyType && ['4W', '6W', '3M', '6M', '9M'].includes(org.journeyType)) {
    return { journeyType: org.journeyType, source: 'explicit' }
  }

  // Calculate from weeks
  if (org.programDurationWeeks) {
    const journeyType = journeyTypeFromDurationWeeks(org.programDurationWeeks)
    if (journeyType) return { journeyType, source: 'weeks' }
  }

  // Calculate from months
  if (org.programDuration) {
    const weeks = resolveDurationWeeksFromProgramDuration(org.programDuration)
    const journeyType = journeyTypeFromDurationWeeks(weeks)
    if (journeyType) return { journeyType, source: 'months', weeks }
  }

  return { journeyType: null, source: 'none' }
}

async function main() {
  console.log('🚀 Starting journey_type backfill migration...\n')

  // Initialize Firebase Admin
  const serviceAccountPath = resolve(__dirname, '../../serviceAccountKey.json')

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

  // Get all organizations
  const orgsSnapshot = await db.collection('organizations').get()

  console.log(`Found ${orgsSnapshot.size} organizations to process\n`)

  let updated = 0
  let skipped = 0
  let noData = 0
  const errors = []

  for (const doc of orgsSnapshot.docs) {
    const org = doc.data()
    const orgId = doc.id
    const orgName = org.name || orgId

    try {
      // Check if journey type already exists
      if (org.journeyType && ['4W', '6W', '3M', '6M', '9M'].includes(org.journeyType)) {
        console.log(`✓ ${orgName}: Already has journeyType = ${org.journeyType}`)
        skipped++
        continue
      }

      // Resolve journey type
      const result = resolveJourneyType(org)

      if (!result.journeyType) {
        console.log(`⚠ ${orgName}: Cannot determine journey type (no duration data)`)
        noData++
        continue
      }

      // Update the organization
      const updateData = {
        journeyType: result.journeyType,
        updatedAt: FieldValue.serverTimestamp(),
      }

      // Also set programDurationWeeks if not present
      if (!org.programDurationWeeks && result.weeks) {
        updateData.programDurationWeeks = result.weeks
      }

      await db.collection('organizations').doc(orgId).update(updateData)

      console.log(`✓ ${orgName}: Set journeyType = ${result.journeyType} (from ${result.source})`)
      updated++
    } catch (error) {
      console.error(`✗ ${orgName}: Error - ${error.message}`)
      errors.push({ orgId, orgName, error: error.message })
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('Migration Summary:')
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped (already has journeyType): ${skipped}`)
  console.log(`  No duration data: ${noData}`)
  console.log(`  Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(({ orgId, orgName, error }) => {
      console.log(`  - ${orgName} (${orgId}): ${error}`)
    })
  }

  console.log('\n✅ Migration complete!')
}

main().catch((error) => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})
