#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

initializeApp({ credential: cert(JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))) })
const db = getFirestore()

const uid = process.argv[2]
if (!uid) {
  console.error('Usage: node scripts/inspect-tx.mjs <uid>')
  process.exit(1)
}

const snap = await db.collection('points_transactions').where('userId', '==', uid).limit(5).get()
console.log(`Found ${snap.size} (showing 5)`)
for (const d of snap.docs) {
  console.log('\n---', d.id, '---')
  console.log(JSON.stringify(d.data(), null, 2))
}
