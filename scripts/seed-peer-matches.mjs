/**
 * Seed Script: Create Peer Matches
 *
 * This script directly creates peer matches in Firestore for testing purposes.
 * It bypasses the Cloud Function, allowing immediate testing of the PeerConnectPage.
 *
 * Usage:
 *   node scripts/seed-peer-matches.mjs
 *
 * Environment Variables:
 *   FIREBASE_SERVICE_ACCOUNT - JSON string of service account credentials (optional)
 *   FIREBASE_PROJECT_ID - Project ID (optional, inferred from service account)
 */

import admin from 'firebase-admin'

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  // Project ID from .firebaserc
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || 'transformation-tier'

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    })
  } else {
    // Try to use Firebase CLI credentials via gcloud ADC
    try {
      admin.initializeApp({
        projectId,
      })
    } catch (e) {
      console.error('\nFirebase Admin SDK initialization failed.')
      console.error('Please run one of the following to authenticate:\n')
      console.error('  Option 1: gcloud auth application-default login')
      console.error('  Option 2: Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file')
      console.error('  Option 3: Set FIREBASE_SERVICE_ACCOUNT to the JSON content of a service account key\n')
      process.exit(1)
    }
  }
}

const db = admin.firestore()
const { serverTimestamp } = admin.firestore.FieldValue

/**
 * Get the current match window key
 */
function getMatchWindowKey(preferredDay = 1) {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const diff = (dayOfWeek - preferredDay + 7) % 7
  const windowStart = new Date(now)
  windowStart.setUTCDate(now.getUTCDate() - diff)
  return `weekly-${windowStart.toISOString().slice(0, 10)}`
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Group users by their organization
 */
function groupUsersByOrganization(users) {
  const groups = new Map()

  for (const user of users) {
    let orgKey = null

    if (user.cohortIdentifier) {
      orgKey = `cohort:${user.cohortIdentifier}`
    } else if (user.corporateVillageId) {
      orgKey = `village:${user.corporateVillageId}`
    } else if (user.companyId) {
      orgKey = `company:${user.companyId}`
    } else if (user.organizationId) {
      orgKey = `org:${user.organizationId}`
    } else if (user.companyCode) {
      orgKey = `code:${user.companyCode}`
    } else if (user.organizationCode) {
      orgKey = `orgcode:${user.organizationCode}`
    }

    if (orgKey) {
      const existing = groups.get(orgKey) || []
      existing.push(user)
      groups.set(orgKey, existing)
    }
  }

  return groups
}

/**
 * Get match reason based on organization key
 */
function getMatchReason(orgKey) {
  if (orgKey.startsWith('cohort:')) return 'Shared cohort'
  if (orgKey.startsWith('village:')) return 'Same corporate village'
  if (orgKey.startsWith('company:')) return 'Same company'
  if (orgKey.startsWith('org:')) return 'Same organization'
  return 'Same company code'
}

/**
 * Create peer matches for a group of users
 */
async function createMatchesForGroup(users, orgKey, matchReason) {
  if (users.length < 2) {
    console.log(`  Skipping ${orgKey}: only ${users.length} user(s), need at least 2`)
    return { created: 0, skipped: users.length }
  }

  // Filter to users with weekly/biweekly matching enabled (or no preference set)
  const eligibleUsers = users.filter(
    (u) =>
      !u.matchRefreshPreference ||
      u.matchRefreshPreference === 'weekly' ||
      u.matchRefreshPreference === 'biweekly'
  )

  if (eligibleUsers.length < 2) {
    console.log(`  Skipping ${orgKey}: only ${eligibleUsers.length} eligible user(s)`)
    return { created: 0, skipped: users.length }
  }

  // Shuffle users for random matching
  const shuffledUsers = shuffleArray(eligibleUsers)

  const batch = db.batch()
  let created = 0
  let skipped = 0

  for (let i = 0; i < shuffledUsers.length; i++) {
    const user = shuffledUsers[i]
    const peerIndex = (i + 1) % shuffledUsers.length
    const peer = shuffledUsers[peerIndex]

    if (user.id === peer.id) {
      skipped++
      continue
    }

    const preferredMatchDay = user.preferredMatchDay ?? 1
    const refreshPreference = user.matchRefreshPreference || 'weekly'
    const matchKey = getMatchWindowKey(preferredMatchDay)
    const matchDocId = `${user.id}-${matchKey}`

    // Check if match already exists
    const existingMatch = await db.collection('peer_weekly_matches').doc(matchDocId).get()

    if (existingMatch.exists) {
      console.log(`  Match already exists for ${user.email || user.id}`)
      skipped++
      continue
    }

    const matchData = {
      peerId: peer.id,
      userId: user.id,
      matchKey: matchKey,
      matchRefreshPreference: refreshPreference,
      preferredMatchDay: preferredMatchDay,
      matchReason: matchReason,
      matchStatus: 'new',
      refreshCount: 1,
      createdAt: serverTimestamp(),
      lastRefreshAt: serverTimestamp(),
      automatedMatch: true,
      seededMatch: true, // Mark as seeded for identification
    }

    batch.set(db.collection('peer_weekly_matches').doc(matchDocId), matchData)

    // Update user's lastMatchRefreshDate
    batch.update(db.collection('profiles').doc(user.id), {
      lastMatchRefreshDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Create notification for the user
    const notificationData = {
      userId: user.id,
      type: 'peer_match',
      title: 'New Peer Match!',
      message: `You've been matched with ${peer.fullName || peer.email || 'a peer'} for this week's peer connection.`,
      read: false,
      createdAt: serverTimestamp(),
      metadata: {
        matchId: matchDocId,
        peerId: peer.id,
        peerName: peer.fullName || peer.email || 'Peer',
        matchReason: matchReason,
      },
    }

    batch.set(db.collection('notifications').doc(), notificationData)

    created++
    console.log(`  Matched: ${user.email || user.id} <-> ${peer.email || peer.id}`)
  }

  if (created > 0) {
    await batch.commit()
  }

  return { created, skipped }
}

/**
 * Main function to seed peer matches
 */
async function seedPeerMatches() {
  console.log('\n=== Peer Matching Seed Script ===\n')
  console.log(`Match Window Key: ${getMatchWindowKey()}\n`)

  const startTime = Date.now()
  let totalCreated = 0
  let totalSkipped = 0
  let totalUsers = 0
  let groupsProcessed = 0

  try {
    // Fetch all profiles with organization associations
    console.log('Fetching profiles with organization associations...')
    const profilesSnapshot = await db.collection('profiles').get()

    const users = profilesSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (u) =>
          u.companyId ||
          u.companyCode ||
          u.organizationId ||
          u.organizationCode ||
          u.corporateVillageId ||
          u.villageId ||
          u.cohortIdentifier
      )

    totalUsers = users.length
    console.log(`Found ${totalUsers} users with organization associations\n`)

    if (totalUsers === 0) {
      console.log('No users with organization associations found.')
      console.log('\nTo test peer matching, users need at least one of:')
      console.log('  - companyId')
      console.log('  - companyCode')
      console.log('  - organizationId')
      console.log('  - organizationCode')
      console.log('  - corporateVillageId')
      console.log('  - villageId')
      console.log('  - cohortIdentifier')
      process.exit(0)
    }

    // Group users by organization
    const groups = groupUsersByOrganization(users)
    console.log(`Users grouped into ${groups.size} organizations/villages:\n`)

    // Process each group
    for (const [orgKey, orgUsers] of groups) {
      const matchReason = getMatchReason(orgKey)
      console.log(`Processing ${orgKey} (${orgUsers.length} users)...`)

      try {
        const result = await createMatchesForGroup(orgUsers, orgKey, matchReason)
        totalCreated += result.created
        totalSkipped += result.skipped
        groupsProcessed++
      } catch (error) {
        console.error(`  Error processing ${orgKey}:`, error.message)
      }
    }

    const duration = Date.now() - startTime

    console.log('\n=== Summary ===')
    console.log(`Total users found: ${totalUsers}`)
    console.log(`Groups processed: ${groupsProcessed}`)
    console.log(`Matches created: ${totalCreated}`)
    console.log(`Matches skipped: ${totalSkipped}`)
    console.log(`Duration: ${duration}ms`)
    console.log('\nPeer matches seeded successfully!')
    console.log('\nNext steps:')
    console.log('1. Visit /peer as one of the matched users')
    console.log('2. You should see your peer match in the "Peer Matching" tab')
    console.log('3. Check Firestore > peer_weekly_matches collection')
  } catch (error) {
    console.error('Seed script failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Run the seed script
seedPeerMatches()
