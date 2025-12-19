import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'
import { PartnerAdminDashboard } from './PartnerAdminDashboard'

/**
 * AdminDashboard component
 * Renders appropriate dashboard based on admin role
 * Route guards ensure only admins can access this component
 */
export const AdminDashboard: React.FC = () => {
  const { profile, claimsRole } = useAuth()
  const normalizedRole = (claimsRole || profile?.role || '')
    .toString()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  const isCompanyAdmin = normalizedRole.includes('company_admin') || normalizedRole.includes('company')
  const isPartner = normalizedRole.includes('partner')

  if (isPartner && !isCompanyAdmin) {
    return <PartnerAdminDashboard />
  }

  if (isCompanyAdmin) {
    return <CompanyAdminDashboard />
  }

  // default to partner view for broader admin roles
  return <PartnerAdminDashboard />
}

export default AdminDashboard
