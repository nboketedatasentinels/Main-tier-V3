import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'

export const canPartnerAccessOrganization = async (
  partnerId: string,
  organizationId: string
): Promise<boolean> => {
  if (!partnerId || !organizationId) return false

  const snap = await getDoc(
    doc(db, 'partner_organizations', `${partnerId}_${organizationId}`)
  )

  return snap.exists()
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
