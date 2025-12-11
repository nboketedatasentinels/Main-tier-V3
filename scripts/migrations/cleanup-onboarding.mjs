import admin from 'firebase-admin'

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id,
  })
}

const db = admin.firestore()
const fieldValue = admin.firestore.FieldValue

const deleteBatch = async (query) => {
  const snapshot = await query.get()
  if (snapshot.empty) return 0

  const batch = db.batch()
  snapshot.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
  return snapshot.size
}

const deleteCollection = async (collectionPath) => {
  let totalDeleted = 0
  let deleted
  do {
    deleted = await deleteBatch(db.collection(collectionPath).limit(500))
    totalDeleted += deleted
  } while (deleted > 0)
  return totalDeleted
}

const cleanUserPoints = async () => {
  let totalDeleted = 0
  let snapshot = await db.collection('user_points').limit(500).get()

  while (!snapshot.empty) {
    const batch = db.batch()
    let batchCount = 0

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (typeof data.source === 'string' && data.source.toLowerCase().includes('onboarding')) {
        batch.delete(doc.ref)
        batchCount += 1
      }
    })

    if (batchCount > 0) {
      await batch.commit()
      totalDeleted += batchCount
    }

    const lastDoc = snapshot.docs[snapshot.docs.length - 1]
    snapshot = await db.collection('user_points').startAfter(lastDoc).limit(500).get()
  }

  return totalDeleted
}

const markProfilesOnboarded = async () => {
  const snapshot = await db.collection('profiles').get()
  let updated = 0

  for (const doc of snapshot.docs) {
    await doc.ref.update({
      isOnboarded: true,
      onboardingSnapshot: fieldValue.delete(),
      updatedAt: new Date().toISOString(),
    })
    updated += 1
  }

  return updated
}

const main = async () => {
  console.log('Starting onboarding cleanup...')

  const updatedProfiles = await markProfilesOnboarded()
  console.log(`Updated profiles: ${updatedProfiles}`)

  const deletedSteps = await deleteCollection('onboarding_steps')
  console.log(`Deleted onboarding_steps documents: ${deletedSteps}`)

  const deletedProgress = await deleteCollection('onboarding_progress')
  console.log(`Deleted onboarding_progress documents: ${deletedProgress}`)

  const deletedAnalytics = await deleteCollection('onboarding_analytics')
  console.log(`Deleted onboarding_analytics documents: ${deletedAnalytics}`)

  const deletedUserPoints = await cleanUserPoints()
  console.log(`Deleted user_points records referencing onboarding: ${deletedUserPoints}`)

  console.log('Onboarding cleanup complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
