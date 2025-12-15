import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { SuperAdminDashboard } from './SuperAdminDashboard'
import { CompanyAdminDashboard } from './CompanyAdminDashboard'

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth()

  // Super admins get the super admin dashboard
  if (profile?.role === UserRole.SUPER_ADMIN) {
    return <SuperAdminDashboard />
  }

  // Company admins and regular admins get the company admin dashboard
  // (Since the route is protected by requireAdmin, we know they have admin access)
  return <CompanyAdminDashboard />
}

export default AdminDashboard
