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
  const { profile } = useAuth()
  const normalizedRole = profile?.role?.toString().toLowerCase()
  const isPartner = normalizedRole === 'partner' || normalizedRole === 'company_admin'

  if (isPartner) {
    return <PartnerAdminDashboard />
  }

  // fallback to company admin experience
  return <CompanyAdminDashboard />
}

export default AdminDashboard
