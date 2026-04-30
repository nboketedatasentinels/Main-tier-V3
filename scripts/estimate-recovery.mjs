#!/usr/bin/env node

/**
 * Read-only: for a uid, examine their impact_logs and estimate the
 * "true" total points using the rule that scp (Social Credit Points,
 * the source-platform metric) should equal points when both are
 * present. Many synced entries arrive with `points: 0` even when
 * `scp > 0`, which is the bug.
 *
 * Reports:
 *   - sum of points already correctly on entries
 *   - sum of recoverable points (entries where scp > 0 AND points = 0)
 *   - sum of "no-op" entries (scp = 0 AND points = 0)
 *   - any conflict (both nonzero but unequal)
 *
 * Usage:
 *   node scripts/estimate-recovery.mjs --uid <uid>
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

initializeApp({ credential: cert(JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))) })
const db = getFirestore()

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fmt = (n) => num(n).toLocaleString('en-US')

const main = async () => {
  const snap = await db.collection('impact_logs').where('userId', '==', uid).get()

  let alreadyCorrect = 0
  let recoverable = 0
  let zeroNoop = 0
  let conflict = 0
  const recoverableEntries = []

  for (const d of snap.docs) {
    const data = d.data() || {}
    const points = num(data.points)
    const scp = num(data.scp)

    if (points > 0 && scp === 0) {
      // points without scp — keep as-is, count as already correct
      alreadyCorrect += points
    } else if (points > 0 && scp > 0 && Math.abs(points - scp) < 0.01) {
      alreadyCorrect += points
    } else if (points > 0 && scp > 0 && Math.abs(points - scp) >= 0.01) {
      conflict += 1
      console.log(`  CONFLICT  ${d.id}  points=${points}  scp=${scp}  title="${data.title}"`)
    } else if (points === 0 && scp > 0) {
      recoverable += scp
      recoverableEntries.push({
        id: d.id,
        scp,
        title: data.title,
        date: data.date,
        usdValue: num(data.usdValue),
        peopleImpacted: num(data.peopleImpacted),
        hours: num(data.hours),
      })
    } else {
      zeroNoop += 1
    }
  }

  console.log(`\nFor uid=${uid}:`)
  console.log(`  Total impact_logs:                  ${snap.size}`)
  console.log(`  Already-correct points:             ${fmt(alreadyCorrect)}`)
  console.log(`  Recoverable (scp > 0, points = 0):  ${fmt(recoverable)}    [${recoverableEntries.length} entries]`)
  console.log(`  Zero-effort entries (no scp):       ${zeroNoop}`)
  console.log(`  Conflicts (points ≠ scp, both > 0): ${conflict}`)
  console.log(`  ────────────────────────────────────────`)
  console.log(`  TRUE TOTAL (estimate):              ${fmt(alreadyCorrect + recoverable)} points`)

  if (recoverableEntries.length > 0) {
    console.log('\nRecoverable entries detail:')
    console.log('  date        scp     usdValue   people  hours  title')
    for (const e of recoverableEntries) {
      console.log(`  ${(e.date ?? '?').padEnd(10)}  ${String(e.scp).padStart(6)}  ${fmt(e.usdValue).padStart(9)}  ${String(e.peopleImpacted).padStart(6)}  ${String(e.hours).padStart(5)}  ${(e.title ?? '').slice(0, 50)}`)
    }
  }

  // Also report aggregate impact (separate from points)
  let totalUsd = 0
  let totalHours = 0
  let totalPeople = 0
  for (const d of snap.docs) {
    const data = d.data() || {}
    totalUsd += num(data.usdValue)
    totalHours += num(data.hours)
    totalPeople += num(data.peopleImpacted)
  }
  console.log('\nImpact totals (across all 34 entries — already correct on entries):')
  console.log(`  USD value:        $${fmt(totalUsd)}`)
  console.log(`  Hours invested:   ${fmt(totalHours)}`)
  console.log(`  People impacted:  ${fmt(totalPeople)}`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
