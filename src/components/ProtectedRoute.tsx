import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/role'
import { AccountStatus } from '@/types'

type Props = {
  children: React.ReactNode
  requiredRoles?: any[] // UserRole[] but keep tolerant
  requireSuperAdmin?: boolean
  requireAdmin?: boolean
  requireMentor?: boolean
  requireAmbassador?: boolean
  requirePaid?: boolean
  restrictMentor?: boolean // Prevent mentors from accessing learner-specific routes
  requireOrganization?: string // Require access to specific organization
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
  const {
    user,
    profile,
    loading,
    profileLoading,
    isAdmin,
    isSuperAdmin,
    isMentor,
    isAmbassador,
    isPaid,
    canAccessOrganization,
  } = useAuth()
  const location = useLocation()

  // Block render until auth + profile are known
  if (loading || profileLoading) return null

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

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

  // Check for super admin requirement
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />
  }

  // Check for admin requirement (any admin type)
  if (requireAdmin && !isAdmin) {
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
    const userRole = normalizeRole(profile?.role)
    const allowed = requiredRoles.map(normalizeRole)

    if (!allowed.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}
