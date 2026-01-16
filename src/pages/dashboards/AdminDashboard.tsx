import React from 'react'
import { PartnerDashboardPage as PartnerDashboard } from '@/pages/partner/PartnerDashboardPage'
import { DashboardErrorBoundary } from '@/components/ui/DashboardErrorBoundary'

/**
 * AdminDashboard component
 * Renders the unified Partner dashboard for all admin/partner roles.
 * Route guards ensure only authorized users can access this component.
 */
export const AdminDashboard: React.FC = () => {
  return (
    <DashboardErrorBoundary context="Partner Dashboard">
      <PartnerDashboard />
    </DashboardErrorBoundary>
  )
}

export default AdminDashboard
