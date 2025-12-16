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
  // The route guard (ProtectedRoute) now ensures only authorized admins can see this.
  // We can directly render the intended dashboard component.
  return <CompanyAdminDashboard />
}

export default AdminDashboard
