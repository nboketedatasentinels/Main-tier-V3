import { supabase } from '@/services/supabase'
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
  const { data, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return false
  return (data.company_id as string | null)?.trim() === organizationId.trim()
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
