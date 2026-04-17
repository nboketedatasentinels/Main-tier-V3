import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('../serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
const auth = admin.auth()

const EMAIL = 'internal@data-sentinels.com'
const PASSWORD = '664689.t4l2026'

async function run() {
  // Get or create user
  let uid
  try {
    const existing = await auth.getUserByEmail(EMAIL)
    uid = existing.uid
    console.log(`User exists: ${uid}`)

    // Update password
    await auth.updateUser(uid, { password: PASSWORD })
    console.log('Password updated.')
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email: EMAIL, password: PASSWORD })
      uid = created.uid
      console.log(`User created: ${uid}`)
    } else {
      throw err
    }
  }

  // Set Firestore profile with super_admin role
  const profileRef = db.collection('profiles').doc(uid)
  await profileRef.set({
    uid,
    email: EMAIL,
    role: 'super_admin',
    displayName: 'Internal Admin',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log('Firestore profile set to super_admin.')
  console.log(`\nDone. Login with:\n  Email: ${EMAIL}\n  Password: ${PASSWORD}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
