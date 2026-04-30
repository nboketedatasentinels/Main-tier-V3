#!/usr/bin/env node

/**
 * Read-only blast-radius check: for a given org, find every learner where
 * impact_logs > 0 but points_transactions sum is zero (or where ledger is
 * empty despite recorded activity). This tells us whether the zero-points
 * bug is just one user or org-wide.
 *
 * Usage:
 *   node scripts/audit-org-zero-points.mjs --code ORGPJW
 *   node scripts/audit-org-zero-points.mjs --org <orgId>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const valueOf = (name) => (flag(name) ? args[args.indexOf(name) + 1] : null)

const orgId = valueOf('--org')
const orgCode = valueOf('--code')
if (!orgId && !orgCode) {
  console.error('Provide --org <orgId> or --code <orgCode>')
  process.exit(1)
}

const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore()

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fmt = (n) => num(n).toLocaleString('en-US')

const main = async () => {
  console.log(`Scanning org: ${orgId ?? orgCode}\n`)

  let q = db.collection('profiles')
  q = orgId ? q.where('companyId', '==', orgId) : q.where('companyCode', '==', orgCode)
  const profiles = await q.get()
  console.log(`profiles found: ${profiles.size}\n`)

  const rows = []
  for (const p of profiles.docs) {
    const uid = p.id
    const data = p.data() || {}

    const [ledgerSnap, txSnap, impactSnap, pendingSnap] = await Promise.all([
      db.collection('pointsLedger').where('uid', '==', uid).get(),
      db.collection('points_transactions').where('userId', '==', uid).get(),
      db.collection('impact_logs').where('userId', '==', uid).get(),
      db.collection('points_verification_requests')
        .where('user_id', '==', uid)
        .where('status', '==', 'pending')
        .get(),
    ])

    let ledgerSum = 0
    for (const d of ledgerSnap.docs) ledgerSum += num(d.data().points)
    let txSum = 0
    let txZero = 0
    for (const d of txSnap.docs) {
      const pts = num(d.data().points)
      txSum += pts
      if (pts === 0) txZero += 1
    }
    let pendingSum = 0
    for (const d of pendingSnap.docs) pendingSum += num(d.data().points)

    rows.push({
      uid,
      name: data.fullName ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() ?? '(no name)',
      email: data.email ?? '',
      stored: num(data.totalPoints),
      ledgerEntries: ledgerSnap.size,
      ledgerSum,
      txEntries: txSnap.size,
      txZeroEntries: txZero,
      txSum,
      impactLogs: impactSnap.size,
      pendingClaims: pendingSnap.size,
      pendingSum,
    })
  }

  // Sort: most likely-affected first (most impact logs, zero stored)
  rows.sort((a, b) => {
    const aHurt = a.impactLogs > 0 && a.stored === 0 ? 1 : 0
    const bHurt = b.impactLogs > 0 && b.stored === 0 ? 1 : 0
    if (aHurt !== bHurt) return bHurt - aHurt
    return b.impactLogs - a.impactLogs
  })

  console.log(
    'name'.padEnd(28),
    'stored'.padStart(8),
    'ledger#'.padStart(8),
    'ledgerΣ'.padStart(9),
    'tx#'.padStart(5),
    'tx=0'.padStart(5),
    'txΣ'.padStart(8),
    'logs'.padStart(5),
    'pend'.padStart(5),
  )
  console.log('-'.repeat(95))
  for (const r of rows) {
    console.log(
      r.name.slice(0, 27).padEnd(28),
      fmt(r.stored).padStart(8),
      String(r.ledgerEntries).padStart(8),
      fmt(r.ledgerSum).padStart(9),
      String(r.txEntries).padStart(5),
      String(r.txZeroEntries).padStart(5),
      fmt(r.txSum).padStart(8),
      String(r.impactLogs).padStart(5),
      String(r.pendingClaims).padStart(5),
    )
  }

  console.log('\n' + '='.repeat(95))
  const affected = rows.filter((r) => r.impactLogs > 0 && r.stored === 0)
  const txZeroAffected = rows.filter((r) => r.txEntries > 0 && r.txZeroEntries > 0)
  console.log(`Learners with impact logs but stored=0: ${affected.length} / ${rows.length}`)
  console.log(`Learners with at least one tx where points=0: ${txZeroAffected.length} / ${rows.length}`)
  const totalZeroTx = rows.reduce((s, r) => s + r.txZeroEntries, 0)
  const totalTx = rows.reduce((s, r) => s + r.txEntries, 0)
  console.log(`Total zero-point transactions across org: ${totalZeroTx} / ${totalTx}`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
