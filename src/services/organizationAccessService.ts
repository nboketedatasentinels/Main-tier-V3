import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { canPartnerAccessOrganization } from '@/services/partnerAccessService'

const getNormalizedRole = (role: string) =>
  role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

const companyAdminCheck = async (
  userId: string,
  organizationId: string
): Promise<boolean> => {
  if (!userId || !organizationId) return false
  const profileSnap = await getDoc(doc(db, 'profiles', userId))
  if (!profileSnap.exists()) return false
  const data = profileSnap.data() as { companyId?: string | null }
  return data.companyId?.trim() === organizationId.trim()
}

export const canAccessOrganization = async ({
  role,
  userId,
  organizationId,
}: {
  role: string
  userId: string
  organizationId: string
}): Promise<boolean> => {
  if (!role || !userId || !organizationId) return false

  const normalizedRole = getNormalizedRole(role)

  if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') return true
  if (normalizedRole === 'company_admin') return companyAdminCheck(userId, organizationId)
  if (normalizedRole === 'partner' || normalizedRole === 'admin' || normalizedRole === 'administrator') {
    return canPartnerAccessOrganization(userId, organizationId)
  }

  return false
}
