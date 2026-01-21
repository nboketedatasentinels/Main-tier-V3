import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'

export const canPartnerAccessOrganization = async (
  partnerId: string,
  organizationId: string
): Promise<boolean> => {
  if (!partnerId || !organizationId) return false

  // Check 1: Legacy partner_organizations collection
  const legacySnap = await getDoc(
    doc(db, 'partner_organizations', `${partnerId}_${organizationId}`)
  )
  if (legacySnap.exists()) return true

  // Check 2: Modern partners collection with assignedOrganizations array
  const partnerSnap = await getDoc(doc(db, 'partners', partnerId))
  if (!partnerSnap.exists()) return false

  const data = partnerSnap.data() as {
    assignedOrganizations?: Array<string | { organizationId?: string; companyCode?: string }>
  }

  const assignments = data.assignedOrganizations || []
  const normalizedOrgId = organizationId.trim().toLowerCase()

  return assignments.some((assignment) => {
    if (typeof assignment === 'string') {
      return assignment.trim().toLowerCase() === normalizedOrgId
    }
    const assignedId = assignment.organizationId?.trim().toLowerCase()
    const assignedCode = assignment.companyCode?.trim().toLowerCase()
    return assignedId === normalizedOrgId || assignedCode === normalizedOrgId
  })
}

export const fetchPartnerOrganizationIds = async (partnerId: string): Promise<string[]> => {
  if (!partnerId) return []

  const snap = await getDocs(
    query(collection(db, 'partner_organizations'), where('partnerId', '==', partnerId))
  )

  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as { organizationId?: string }
      if (data.organizationId) return data.organizationId.trim()
      const [, organizationId] = docSnap.id.split('_')
      return organizationId?.trim() || ''
    })
    .filter((organizationId): organizationId is string => !!organizationId)
}
