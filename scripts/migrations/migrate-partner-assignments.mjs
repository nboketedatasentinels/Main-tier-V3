#!/usr/bin/env node

/**
 * Migration: Move partner assignments from profiles to partners collection.
 *
 * This script:
 * - Scans partner profiles for assignedOrganizations
 * - Normalizes organization IDs (by document ID or organization code)
 * - Creates/updates partners/{uid} with assignedOrganizations entries
 *
 * Usage:
 * 1. Set FIREBASE_PROJECT_ID environment variable
 * 2. Ensure Firebase Admin credentials are configured
 * 3. Run: node scripts/migrations/migrate-partner-assignments.mjs
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
const profilesCollection = db.collection('profiles')
const partnersCollection = db.collection('partners')
const organizationsCollection = db.collection('organizations')

const batchSize = 250

const normalizeAssignments = (entries = [], orgLookup) => {
  const normalized = []
  const seen = new Set()

  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    const normalizedId = orgLookup.toOrganizationId(trimmed)
    if (!normalizedId) continue
    if (seen.has(normalizedId)) continue
    seen.add(normalizedId)
    normalized.push(normalizedId)
  }

  return normalized
}

const buildOrgLookup = async () => {
  const snapshot = await organizationsCollection.get()
  const byId = new Map()
  const byCode = new Map()

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : ''
    byId.set(docSnap.id, { id: docSnap.id, code: data.code, status: data.status })
    if (code) {
      byCode.set(code, docSnap.id)
    }
  })

  return {
    byId,
    toOrganizationId: (value) => {
      if (byId.has(value)) return value
      const codeMatch = byCode.get(value.toUpperCase())
      return codeMatch || null
    },
  }
}

const migratePartners = async (orgLookup) => {
  let lastDoc = null
  let processed = 0
  let updated = 0

  while (true) {
    let query = profilesCollection
      .where('role', '==', 'partner')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(batchSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const snapshot = await query.get()
    if (snapshot.empty) break

    const batch = db.batch()

    for (const profileDoc of snapshot.docs) {
      processed += 1
      const profileData = profileDoc.data() || {}
      const assigned = Array.isArray(profileData.assignedOrganizations)
        ? profileData.assignedOrganizations
        : []
      const normalizedIds = normalizeAssignments(assigned, orgLookup)
      const assignedOrganizations = normalizedIds.map((orgId) => {
        const orgData = orgLookup.byId.get(orgId) || {}
        return {
          organizationId: orgId,
          companyCode: orgData.code || '',
          status: orgData.status || 'active',
        }
      })

      const partnerRef = partnersCollection.doc(profileDoc.id)
      batch.set(
        partnerRef,
        {
          assignedOrganizations,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      updated += 1
    }

    await batch.commit()
    console.log(`Migrated ${updated} partner records (processed ${processed})`)
    lastDoc = snapshot.docs[snapshot.docs.length - 1]
  }
}

const run = async () => {
  console.log('Building organization lookup...')
  const orgLookup = await buildOrgLookup()
  console.log(`Loaded ${orgLookup.byId.size} organizations`)
  console.log('Migrating partner assignments from profiles to partners...')
  await migratePartners(orgLookup)
  console.log('Partner assignment migration completed')
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed', error)
    process.exit(1)
  })
