// Sets pillar='transforming_business' on existing 6W orgs that don't have a pillar yet.
// Safe to re-run: only updates orgs where pillar is currently missing.

import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!admin.apps.length) {
  const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db = admin.firestore()
const TARGET_PILLAR = 'transforming_business'

const snap = await db.collection('organizations').where('journeyType', '==', '6W').get()

console.log(`Found ${snap.size} orgs with journeyType='6W'\n`)

let updated = 0
let alreadySet = 0
let skipped = 0

for (const docSnap of snap.docs) {
  const data = docSnap.data()
  if (data.pillar) {
    console.log(`  SKIP  ${data.name || docSnap.id}: pillar already set to '${data.pillar}'`)
    alreadySet++
    continue
  }
  if (docSnap.id === '_collection_init') {
    console.log(`  SKIP  ${docSnap.id}: placeholder doc`)
    skipped++
    continue
  }
  await docSnap.ref.update({
    pillar: TARGET_PILLAR,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  console.log(`  SET   ${data.name || docSnap.id}: pillar = '${TARGET_PILLAR}'`)
  updated++
}

console.log(`\nDone. Updated ${updated}, already set ${alreadySet}, skipped ${skipped}.`)
process.exit(0)
