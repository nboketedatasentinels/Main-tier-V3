import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
const { serverTimestamp } = admin.firestore.FieldValue

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedDir = path.resolve(__dirname, '..', 'database', 'seed-data')

const loadJson = async (filename) => {
  const content = await readFile(path.join(seedDir, filename), 'utf-8')
  return JSON.parse(content)
}

const upsertDocument = async (collectionName, docId, payload) => {
  const docRef = db.collection(collectionName).doc(docId)
  const existing = await docRef.get()
  const createdAt = existing.exists ? existing.data()?.createdAt : serverTimestamp()

  await docRef.set(
    {
      ...payload,
      createdAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

const seedWindowConfigs = async () => {
  const activityDefinitions = await loadJson('activity-definitions.json')
  const windowTargets = await loadJson('window-targets.json')

  console.log('Seeding activity definitions...')
  for (const definition of activityDefinitions) {
    await upsertDocument('activityDefinitions', definition.id, definition)
    console.log(`Upserted activity definition: ${definition.id}`)
  }

  console.log('Seeding window targets...')
  for (const target of windowTargets) {
    await upsertDocument('windowTargets', target.id, target)
    console.log(`Upserted window target: ${target.id}`)
  }

  console.log('Seed complete.')
}

seedWindowConfigs().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
