import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'
import { AccountStatus } from '@/types'
import { normalizeRole } from '@/utils/role'
import { AppLoader } from '@/components/ui/AppLoader'

type Props = {
  children: React.ReactNode
  requiredRoles?: Array<UserRole | string>
  requireSuperAdmin?: boolean
  requireAdmin?: boolean
  requireMentor?: boolean
  requireAmbassador?: boolean
  requirePaid?: boolean
  restrictMentor?: boolean
  requireOrganization?: string
}

export const ProtectedRoute: React.FC<Props> = ({
  children,
  requiredRoles,
  requireSuperAdmin,
  requireAdmin,
  requireMentor,
  requireAmbassador,
  requirePaid,
  restrictMentor,
  requireOrganization,
}) => {
  // Note: We use a hybrid approach for role checking:
  // - Admin/super admin checks use normalizeRole for consistency with role mappings
  // - Mentor/ambassador/paid checks use flags from AuthContext for simplicity
  // This is intentional to balance consistency with developer ergonomics
  const {
    user,
    profile,
    loading,
    profileLoading,
    isMentor,
    isAmbassador,
    isPaid,
    canAccessOrganization,
  } = useAuth()
  const location = useLocation()

  // Block render until auth + profile are known
  if (loading || profileLoading) return <AppLoader />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

  // Get normalized role for admin/super_admin comparisons
  // (these require normalization due to partner/company_admin/admin variations)
  const userRole = normalizeRole(profile?.role)

  // Check account status
  const accountStatus = profile.accountStatus?.toString().toLowerCase()
  if (accountStatus === AccountStatus.INACTIVE || accountStatus === 'inactive') {
    return <Navigate to="/login" replace state={{ error: 'Account is inactive' }} />
  }

  if (accountStatus === AccountStatus.SUSPENDED || accountStatus === 'suspended') {
    return <Navigate to="/suspended" replace />
  }

  // Check for mentor restriction (prevent mentors from accessing learner routes)
  if (restrictMentor && isMentor) {
    return <Navigate to="/mentor/dashboard" replace />
  }

  // Super admin requirement - check normalized role
  if (requireSuperAdmin && userRole !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />
  }

  // Admin requirement - allow both partner and super_admin
  if (requireAdmin && userRole !== 'partner' && userRole !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />
  }

  // Check for mentor requirement
  if (requireMentor && !isMentor) {
    return <Navigate to="/unauthorized" replace />
  }

  // Check for ambassador requirement
  if (requireAmbassador && !isAmbassador) {
    return <Navigate to="/unauthorized" replace />
  }

  // Check for paid membership requirement
  if (requirePaid && !isPaid) {
    return <Navigate to="/upgrade" replace />
  }

  // Check for organization access requirement
  if (requireOrganization && !canAccessOrganization(requireOrganization)) {
    return <Navigate to="/unauthorized" replace />
  }

  // Check for specific role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    const allowedRoles = requiredRoles.map(normalizeRole)

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}
