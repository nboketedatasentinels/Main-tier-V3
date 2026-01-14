import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import type { UserProfile } from '@/types'

const normalizeCode = (value?: string | null) => value?.trim().toUpperCase() || null

export const auditOrganizationFields = async () => {
  console.log('🔍 [Org Audit] Loading organizations and profiles...')

  const [orgSnapshot, profileSnapshot] = await Promise.all([
    getDocs(collection(db, ORG_COLLECTION)),
    getDocs(collection(db, 'profiles')),
  ])

  const orgById = new Map<string, { id: string; code?: string | null }>()
  const orgByCode = new Map<string, { id: string; code?: string | null }>()

  orgSnapshot.docs.forEach((docItem) => {
    const data = docItem.data() as { code?: string | null }
    const code = normalizeCode(data.code)
    orgById.set(docItem.id, { id: docItem.id, code })
    if (code) {
      orgByCode.set(code, { id: docItem.id, code })
    }
  })

  let checked = 0
  let updatesQueued = 0
  let unresolved = 0
  let missingCompanyId = 0
  let missingCompanyCode = 0

  let batch = writeBatch(db)
  let batchCount = 0

  const commitBatch = async () => {
    if (!batchCount) return
    await batch.commit()
    batch = writeBatch(db)
    batchCount = 0
  }

  for (const docItem of profileSnapshot.docs) {
    checked += 1
    const data = docItem.data() as UserProfile
    const companyId = data.companyId ?? data.organizationId ?? null
    const companyCode = normalizeCode(data.companyCode ?? data.organizationCode)

    if (!companyId && !companyCode) {
      continue
    }

    const updatePayload: Partial<UserProfile> = {}
    let resolvedId = companyId
    let resolvedCode = companyCode

    if (companyId && !companyCode) {
      missingCompanyCode += 1
      const org = orgById.get(companyId)
      if (org?.code) {
        resolvedCode = org.code
      } else {
        unresolved += 1
      }
    }

    if (companyCode && !companyId) {
      missingCompanyId += 1
      const org = orgByCode.get(companyCode)
      if (org?.id) {
        resolvedId = org.id
      } else {
        unresolved += 1
      }
    }

    if (resolvedId && resolvedId !== data.companyId) {
      updatePayload.companyId = resolvedId
      updatePayload.organizationId = resolvedId
    }

    if (resolvedCode && resolvedCode !== data.companyCode) {
      updatePayload.companyCode = resolvedCode
      updatePayload.organizationCode = resolvedCode
    }

    if (Object.keys(updatePayload).length) {
      batch.update(doc(db, 'profiles', docItem.id), updatePayload)
      updatesQueued += 1
      batchCount += 1
      if (batchCount >= 400) {
        await commitBatch()
      }
    }
  }

  await commitBatch()

  console.log('✅ [Org Audit] Completed', {
    checkedProfiles: checked,
    updatesQueued,
    missingCompanyId,
    missingCompanyCode,
    unresolved,
  })
}

if (process.argv[1]?.includes('auditOrganizationFields')) {
  auditOrganizationFields().catch((error) => {
    console.error('🔴 [Org Audit] Failed', error)
    process.exitCode = 1
  })
}
