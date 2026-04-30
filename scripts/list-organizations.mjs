#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const filterArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const filter = filterArg ? filterArg.toLowerCase() : null

const snap = await db.collection('organizations').get()
console.log(`Total organizations: ${snap.size}\n`)

const rows = snap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((o) => {
    if (!filter) return true
    const blob = `${o.id} ${o.code ?? ''} ${o.name ?? ''}`.toLowerCase()
    return blob.includes(filter)
  })
  .sort((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)))

if (!rows.length) {
  console.log(filter ? `No orgs matched "${filter}".` : 'No organizations.')
  process.exit(0)
}

for (const o of rows) {
  console.log(`docId=${o.id}`)
  console.log(`  code=${o.code ?? '(none)'}`)
  console.log(`  name=${o.name ?? '(none)'}`)
  console.log(`  status=${o.status ?? '(none)'}  journeyType=${o.journeyType ?? '(none)'}`)
  console.log('')
}

process.exit(0)
