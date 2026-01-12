import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/role'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'
import { PartnerAdminDashboard } from './PartnerAdminDashboard'
import { DashboardErrorBoundary } from '@/components/ui/DashboardErrorBoundary'

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
  const isPartner = normalizedRole === 'partner' || normalizedRole === 'admin'
  const isSuperAdmin = normalizedRole === 'super_admin'

  if (isPartner && !isCompanyAdmin) {
    return (
      <DashboardErrorBoundary context="Partner Admin Dashboard">
        <PartnerAdminDashboard />
      </DashboardErrorBoundary>
    )
  }

  if (isCompanyAdmin) {
    return (
      <DashboardErrorBoundary context="Company Admin Dashboard">
        <CompanyAdminDashboard />
      </DashboardErrorBoundary>
    )
  }

  // default to partner view for broader admin roles
  if (isSuperAdmin) {
    return (
      <DashboardErrorBoundary context="Partner Admin Dashboard">
        <PartnerAdminDashboard />
      </DashboardErrorBoundary>
    )
  }

  return (
    <DashboardErrorBoundary context="Partner Admin Dashboard">
      <PartnerAdminDashboard />
    </DashboardErrorBoundary>
  )
}

export default AdminDashboard
