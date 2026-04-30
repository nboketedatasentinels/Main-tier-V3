#!/usr/bin/env node

/**
 * Read-only: dump impact_logs entries for a uid so we can see exactly
 * what categories / activities / point-bearing fields they carry.
 *
 * Usage:
 *   node scripts/inspect-impact-logs.mjs --uid <uid>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const uid = args[args.indexOf('--uid') + 1]
if (!uid) {
  console.error('Provide --uid <uid>')
  process.exit(1)
}

const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore()

const ts = (v) => {
  if (!v) return '(none)'
  if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 16)
  if (v instanceof Date) return v.toISOString().slice(0, 16)
  return String(v).slice(0, 16)
}

const main = async () => {
  const snap = await db.collection('impact_logs').where('userId', '==', uid).get()
  console.log(`Found ${snap.size} impact_logs for uid=${uid}\n`)

  const byCategory = new Map()
  const byActivity = new Map()
  const allFieldNames = new Set()

  for (const d of snap.docs) {
    const data = d.data() || {}
    for (const k of Object.keys(data)) allFieldNames.add(k)
    const cat = data.category ?? data.categoryKey ?? '(no category)'
    const act = data.activityId ?? data.activity_id ?? data.activityKey ?? data.kind ?? '(no activity)'
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1)
    byActivity.set(act, (byActivity.get(act) ?? 0) + 1)
  }

  console.log('All field names seen across the 34 entries:')
  console.log('  ' + [...allFieldNames].sort().join(', '))
  console.log()

  console.log('By category:')
  for (const [k, v] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(35)}  ${v}`)
  }
  console.log()
  console.log('By activity:')
  for (const [k, v] of [...byActivity.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(35)}  ${v}`)
  }

  console.log('\nFirst 3 full entries (so we can see exact shape):')
  for (const d of snap.docs.slice(0, 3)) {
    console.log('---', d.id, '---')
    console.log(JSON.stringify(d.data(), null, 2))
  }

  // Also pull journey_activities catalog (any) so we know what point values
  // each activity is "supposed" to award.
  console.log('\n---\njourney_activities catalog (sample):')
  const cat = await db.collection('journey_activities').limit(5).get()
  console.log(`(${cat.size} sample docs)`)
  for (const d of cat.docs) {
    const x = d.data() || {}
    console.log(`  ${d.id}  points=${x.points ?? '?'}  category=${x.category ?? '?'}  journeyType=${x.journeyType ?? '?'}`)
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
