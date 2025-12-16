import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { SuperAdminDashboard } from './SuperAdminDashboard'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'

/**
 * AdminDashboard component
 * Renders appropriate dashboard based on admin role
 * Route guards ensure only admins can access this component
 */
export const AdminDashboard: React.FC = () => {
  const { isSuperAdmin } = useAuth()

  // Super admins get the super admin dashboard
  if (isSuperAdmin) {
    return <SuperAdminDashboard />
  }

  // All other admins (partners) get the company admin dashboard
  return <CompanyAdminDashboard />
}

export default AdminDashboard
