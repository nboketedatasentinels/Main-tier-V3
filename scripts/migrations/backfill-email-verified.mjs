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
const idField = admin.firestore.FieldPath.documentId()

const updateBatch = async (query) => {
  const snapshot = await query.get()
  if (snapshot.empty) {
    return { updated: 0, scanned: 0, lastDoc: null }
  }

  const batch = db.batch()
  let updated = 0

  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    if (data.emailVerified !== true) {
      batch.update(doc.ref, {
        emailVerified: true,
        updatedAt: fieldValue.serverTimestamp(),
      })
      updated += 1
    }
  })

  if (updated > 0) {
    await batch.commit()
  }

  return {
    updated,
    scanned: snapshot.size,
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
  }
}

const backfillEmailVerified = async () => {
  console.log('Starting emailVerified backfill for user profiles...')

  let totalUpdated = 0
  let totalScanned = 0
  let lastDoc = null

  while (true) {
    let query = db.collection('users').orderBy(idField).limit(500)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const { updated, scanned, lastDoc: newLastDoc } = await updateBatch(query)
    totalUpdated += updated
    totalScanned += scanned

    console.log(`Scanned ${totalScanned} user profiles. Updated ${totalUpdated}.`)

    if (!newLastDoc) {
      break
    }

    lastDoc = newLastDoc
  }

  console.log('EmailVerified backfill complete.')
  console.log(`Total profiles scanned: ${totalScanned}`)
  console.log(`Total profiles updated: ${totalUpdated}`)
}

backfillEmailVerified()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('EmailVerified backfill failed:', error)
    process.exit(1)
  })
