#!/usr/bin/env node

/**
 * Lists every profile whose normalized role is 'partner'.
 *
 * Covers legacy values too: `partner`, `admin`, `company_admin` all
 * normalize to `partner` in the app (see src/utils/role.ts).
 *
 * Usage:
 *   node scripts/list-partner-emails.mjs
 *   node scripts/list-partner-emails.mjs --json     # raw JSON output
 *   node scripts/list-partner-emails.mjs --csv      # csv output
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json')
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (err) {
  console.error('❌ Could not read serviceAccountKey.json at', serviceAccountPath)
  console.error('   Place your Firebase service account key there and re-run.')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const PARTNER_ROLE_VALUES = new Set(['partner', 'admin', 'company_admin'])

const args = process.argv.slice(2)
const outputJson = args.includes('--json')
const outputCsv = args.includes('--csv')

async function main() {
  const snapshot = await db.collection('profiles').get()
  const partners = []

  snapshot.forEach((doc) => {
    const data = doc.data() || {}
    const rawRole = (data.role || '').toString().trim().toLowerCase()
    if (!PARTNER_ROLE_VALUES.has(rawRole)) return

    partners.push({
      id: doc.id,
      email: data.email || null,
      name: data.fullName || data.firstName || data.name || null,
      role: rawRole,
      organizationId: data.organizationId || data.companyId || null,
      organizationCode: data.companyCode || null,
      assignedOrganizations: Array.isArray(data.assignedOrganizations) ? data.assignedOrganizations : [],
    })
  })

  partners.sort((a, b) => (a.email || '').localeCompare(b.email || ''))

  if (outputJson) {
    console.log(JSON.stringify(partners, null, 2))
    return
  }

  if (outputCsv) {
    console.log('email,name,role,userId,organizationId,assignedOrganizations')
    partners.forEach((p) => {
      const orgs = p.assignedOrganizations.join('|')
      console.log(`${p.email || ''},"${p.name || ''}",${p.role},${p.id},${p.organizationId || ''},"${orgs}"`)
    })
    return
  }

  console.log(`\n🤝 Found ${partners.length} partner account${partners.length === 1 ? '' : 's'}\n`)
  console.log('='.repeat(70))
  partners.forEach((p, idx) => {
    console.log(`\n${idx + 1}. ${p.email || '(no email)'}`)
    if (p.name) console.log(`   Name: ${p.name}`)
    console.log(`   Role: ${p.role}${p.role !== 'partner' ? '  ← legacy alias' : ''}`)
    console.log(`   User ID: ${p.id}`)
    if (p.organizationId) console.log(`   Org: ${p.organizationId}${p.organizationCode ? ` (${p.organizationCode})` : ''}`)
    if (p.assignedOrganizations.length) {
      console.log(`   Assigned orgs: ${p.assignedOrganizations.join(', ')}`)
    }
  })
  console.log('\n' + '='.repeat(70))
  console.log(`Tip: re-run with --csv or --json for machine-readable output.\n`)
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
