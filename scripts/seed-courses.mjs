import admin from 'firebase-admin'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('ts-node/register/transpile-only')

const { COURSE_DETAILS_MAPPING, COURSE_METADATA_MAPPING } = require('../src/utils/courseMappings.ts')

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

const buildCoursePayload = (title, details, metadata) => {
  const payload = {
    name: title,
    title,
    slug: details.slug,
    description: details.description,
    link: details.link,
    points: details.points,
    price: details.price,
  }

  if (metadata?.estimatedMinutes) {
    payload.estimatedMinutes = metadata.estimatedMinutes
  }

  if (metadata?.difficulty) {
    payload.difficulty = metadata.difficulty
  }

  return payload
}

const upsertCourse = async (docId, payload) => {
  const docRef = db.collection('courses').doc(docId)
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

const seedCourses = async () => {
  const entries = Object.entries(COURSE_DETAILS_MAPPING)
  console.log(`Seeding ${entries.length} courses...`)

  for (const [title, details] of entries) {
    if (!details?.slug) {
      console.warn(`Skipping course without slug: ${title}`)
      continue
    }

    const metadata = COURSE_METADATA_MAPPING[title]
    const payload = buildCoursePayload(title, details, metadata)
    await upsertCourse(details.slug, payload)
    console.log(`Upserted course: ${details.slug}`)
  }

  console.log('Course seeding complete.')
}

seedCourses().catch((error) => {
  console.error('Course seeding failed:', error)
  process.exit(1)
})
