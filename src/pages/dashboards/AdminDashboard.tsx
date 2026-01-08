import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/role'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'
import { PartnerAdminDashboard } from './PartnerAdminDashboard'

/**
 * AdminDashboard component
 * Renders appropriate dashboard based on admin role
 * Route guards ensure only admins can access this component
 */
export const AdminDashboard: React.FC = () => {
  const { profile, claimsRole } = useAuth()
  const rawRole = claimsRole || profile?.role || ''
  const rawRoleString = rawRole
    .toString()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  const normalizedRole = normalizeRole(rawRole)

  const isCompanyAdmin = rawRoleString.includes('company_admin') || rawRoleString.includes('company')
  const isPartner = normalizedRole === 'partner'
  const isSuperAdmin = normalizedRole === 'super_admin'

  if (isPartner && !isCompanyAdmin) {
    return <PartnerAdminDashboard />
  }

  if (isCompanyAdmin) {
    return <CompanyAdminDashboard />
  }

  // default to partner view for broader admin roles
  if (isSuperAdmin) {
    return <PartnerAdminDashboard />
  }

  return <PartnerAdminDashboard />
}

export default AdminDashboard
